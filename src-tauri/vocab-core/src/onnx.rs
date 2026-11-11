//! Loads ONNX graphs into tract, working around what tract 0.23 cannot run as
//! exported in MOSS-TTS-Nano and opus-mt, and runs them on the GPU when there
//! is one.

use std::collections::HashSet;
use std::path::Path;
use std::sync::{Arc, OnceLock};

use anyhow::{Context, bail, ensure};
use tract_onnx::pb::attribute_proto::AttributeType;
use tract_onnx::pb::tensor_proto::DataType;
use tract_onnx::pb::tensor_shape_proto::dimension::Value as DimValue;
use tract_onnx::pb::type_proto::Value as TypeValue;
use tract_onnx::pb::{AttributeProto, GraphProto, ModelProto, NodeProto};
use tract_onnx::prelude::*;
use tract_onnx::tract_core::ops::konst::Const;

pub type Graph = Arc<dyn Runnable>;

/// Loads `dir/name` with its external weights from `dir`. `inputs` are the
/// input names in order, checked against the file; a fact in place of a
/// name pins that input's shape. Each pair in `same_dimensions` names one
/// dimension the file names two ways, and tract cannot tell are equal.
pub fn load(
    dir: &Path,
    name: &str,
    inputs: &[(&str, Option<InferenceFact>)],
    same_dimensions: &[(&str, &str)],
) -> TractResult<Graph> {
    let onnx = tract_onnx::onnx()
        // The exported value infos name dimensions that pinned inputs contradict.
        .with_ignore_value_info(true)
        .with_ignore_output_shapes(true);
    let mut proto = onnx.proto_model_for_path(dir.join(name))?;
    rewrite(&mut proto, same_dimensions)?;
    let dir = dir.to_str().context("the model folder is not UTF-8")?;
    let mut model = onnx.parse(&proto, Some(dir))?.model;
    for (index, (expected, fact)) in inputs.iter().enumerate() {
        let actual = &model.node(model.input_outlets()?[index].node).name;
        ensure!(
            actual == expected,
            "{name} takes {actual} where {expected} was expected"
        );
        if let Some(fact) = fact {
            model.set_input_fact(index, fact.clone())?;
        }
    }
    let model = model.into_typed()?.into_decluttered()?;
    if let Some(gpu) = gpu() {
        match gpu.prepare(model.clone()) {
            Ok(graph) => return Ok(graph.into()),
            Err(error) => log::warn!("{name} runs on the CPU: the GPU cannot run it: {error:#}"),
        }
    }
    let mut model = model.into_optimized()?;
    fold_constant_reductions(&mut model)?;
    Ok(Arc::new(model.into_runnable()?))
}

/// tract's wgpu runtime, on Vulkan, Metal or Direct3D 12. Operations it has
/// no kernel for still run on the CPU, within the same graph.
fn gpu() -> Option<&'static dyn Runtime> {
    static GPU: OnceLock<Option<&'static dyn Runtime>> = OnceLock::new();
    *GPU.get_or_init(|| {
        let gpu = tract_wgpu::try_wgpu_context().and_then(|_| runtime_for_name("wgpu"));
        match gpu {
            Ok(gpu) => gpu,
            Err(error) => {
                log::info!("The models run on the CPU: no GPU: {error:#}");
                None
            }
        }
    })
}

fn rewrite(proto: &mut ModelProto, same_dimensions: &[(&str, &str)]) -> TractResult<()> {
    let graph = proto.graph.as_mut().context("the model has no graph")?;
    rename_dimensions(graph, same_dimensions);
    replace_squeeze_ifs(graph)?;
    run_integer_cumsums_in_i32(graph);
    Ok(())
}

/// Renames the first of each pair to the second in the inputs' and outputs' shapes.
fn rename_dimensions(graph: &mut GraphProto, same_dimensions: &[(&str, &str)]) {
    let values = graph.input.iter_mut().chain(&mut graph.output);
    let types = values.filter_map(|value| value.r#type.as_mut()?.value.as_mut());
    for TypeValue::TensorType(tensor) in types {
        let dims = tensor.shape.iter_mut().flat_map(|shape| &mut shape.dim);
        for dim in dims {
            let Some(DimValue::DimParam(name)) = &mut dim.value else {
                continue;
            };
            if let Some((_, same)) = same_dimensions.iter().find(|(from, _)| from == name) {
                *name = (*same).to_owned();
            }
        }
    }
}

/// The codec ends with PyTorch's `squeeze(1)`, exported as `If(dim 1 == 1,
/// Squeeze, Identity)`, which tract cannot type. Its result is only ever
/// reshaped, and squeezing does not move any element, so `Identity` is the
/// same.
fn replace_squeeze_ifs(graph: &mut GraphProto) -> TractResult<()> {
    let only_reshaped = |output: &str| {
        graph
            .node
            .iter()
            .filter(|node| node.input.iter().any(|input| input == output))
            .all(|node| node.op_type == "Reshape" && node.input[0] == output)
    };
    let mut squeezes = Vec::new();
    for (index, node) in graph.node.iter().enumerate() {
        if node.op_type != "If" {
            continue;
        }
        let branch = |name: &str| {
            let attribute = node
                .attribute
                .iter()
                .find(|attribute| attribute.name == name);
            attribute.and_then(|attribute| attribute.g.as_ref())
        };
        let (Some(then_branch), Some(else_branch)) = (branch("then_branch"), branch("else_branch"))
        else {
            bail!("{} has no branches", node.name);
        };
        let squeezes_only = then_branch
            .node
            .iter()
            .all(|node| matches!(node.op_type.as_str(), "Squeeze" | "Constant"));
        let [identity] = else_branch.node.as_slice() else {
            bail!("{} is not a squeeze", node.name);
        };
        ensure!(
            squeezes_only && identity.op_type == "Identity" && only_reshaped(&node.output[0]),
            "{} is not a squeeze before a reshape",
            node.name
        );
        squeezes.push((index, identity.input[0].clone()));
    }
    for (index, input) in squeezes {
        let node = &mut graph.node[index];
        node.op_type = "Identity".into();
        node.input = vec![input];
        node.attribute.clear();
    }
    Ok(())
}

/// Position ids are the `CumSum` of the attention mask cast to int64, which
/// tract types as a symbolic dimension that its `CumSum` cannot add up.
fn run_integer_cumsums_in_i32(graph: &mut GraphProto) {
    let int64 = DataType::Int64 as i64;
    let int64_casts: HashSet<String> = graph
        .node
        .iter()
        .filter(|node| node.op_type == "Cast")
        .filter(|node| {
            node.attribute
                .iter()
                .any(|a| a.name == "to" && a.i == int64)
        })
        .map(|node| node.output[0].clone())
        .collect();
    let mut nodes = Vec::with_capacity(graph.node.len());
    for mut node in std::mem::take(&mut graph.node) {
        if node.op_type != "CumSum" || !int64_casts.contains(&node.input[0]) {
            nodes.push(node);
            continue;
        }
        let input = format!("{}/i32_input", node.name);
        let output = format!("{}/i32_output", node.name);
        let to_i32 = cast(
            format!("{}/to_i32", node.name),
            &node.input[0],
            &input,
            DataType::Int32,
        );
        let to_i64 = cast(
            format!("{}/to_i64", node.name),
            &output,
            &node.output[0],
            DataType::Int64,
        );
        node.input[0] = input;
        node.output[0] = output;
        nodes.extend([to_i32, node, to_i64]);
    }
    graph.node = nodes;
}

fn cast(name: String, input: &str, output: &str, to: DataType) -> NodeProto {
    NodeProto {
        name,
        op_type: "Cast".into(),
        input: vec![input.into()],
        output: vec![output.into()],
        attribute: vec![AttributeProto {
            name: "to".into(),
            r#type: AttributeType::Int as i32,
            i: to as i64,
            ..Default::default()
        }],
        ..Default::default()
    }
}

/// An int8 matmul subtracts the column sums of its weights, which tract
/// recomputes on every run: it will not fold `Const -> Cast -> Reduce`
/// because the cast alone is four times the size of the weights. Folding the
/// small sums makes a decoding step about fifteen times faster.
fn fold_constant_reductions(model: &mut TypedModel) -> TractResult<()> {
    const MAX_FOLDED_BYTES: i64 = 1 << 20;
    let mut patch = TypedModelPatch::default();
    for node in model.nodes() {
        let [output] = node.outputs.as_slice() else {
            continue;
        };
        let small = output
            .fact
            .mem_size()
            .as_i64()
            .is_some_and(|size| size <= MAX_FOLDED_BYTES);
        if node.op_is::<Const>() || node.inputs.is_empty() || output.fact.konst.is_some() || !small
        {
            continue;
        }
        let Some(inputs) = node
            .inputs
            .iter()
            .map(|&outlet| constant_within_one_step(model, outlet))
            .collect::<Option<TVec<_>>>()
        else {
            continue;
        };
        if let Ok(Some(mut values)) = node.op.eval_out_of_plan(inputs) {
            let folded = patch.add_const(&node.name, values.remove(0).into_arc_tensor())?;
            patch.shunt_outside(model, node.id.into(), folded)?;
        }
    }
    patch.apply(model)?;
    model.compact()
}

/// The constant at `outlet`, or computed from one by its single-input node.
fn constant_within_one_step(model: &TypedModel, outlet: OutletId) -> Option<TValue> {
    let fact = model.outlet_fact(outlet).ok()?;
    if let Some(constant) = &fact.konst {
        return Some(constant.clone().into_tvalue());
    }
    let node = model.node(outlet.node);
    let [input] = node.inputs.as_slice() else {
        return None;
    };
    let constant = model.outlet_fact(*input).ok()?.konst.clone()?;
    let mut values = node
        .op
        .eval_out_of_plan(tvec![constant.into_tvalue()])
        .ok()??;
    Some(values.swap_remove(outlet.slot))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn node(op_type: &str, inputs: &[&str], output: &str) -> NodeProto {
        NodeProto {
            name: format!("/{output}"),
            op_type: op_type.into(),
            input: inputs.iter().map(|&input| input.into()).collect(),
            output: vec![output.into()],
            ..Default::default()
        }
    }

    fn branch(name: &str, nodes: Vec<NodeProto>) -> AttributeProto {
        AttributeProto {
            name: name.into(),
            r#type: AttributeType::Graph as i32,
            g: Some(GraphProto {
                node: nodes,
                ..Default::default()
            }),
            ..Default::default()
        }
    }

    fn squeeze_if(consumer: &str) -> GraphProto {
        let mut squeeze = node("If", &["is_one"], "squeezed");
        squeeze.attribute = vec![
            branch(
                "then_branch",
                vec![
                    node("Constant", &[], "axis"),
                    node("Squeeze", &["audio", "axis"], "then"),
                ],
            ),
            branch("else_branch", vec![node("Identity", &["audio"], "else")]),
        ];
        GraphProto {
            node: vec![squeeze, node(consumer, &["squeezed", "shape"], "reshaped")],
            ..Default::default()
        }
    }

    #[test]
    fn replaces_a_squeeze_before_a_reshape_with_identity() {
        let mut graph = squeeze_if("Reshape");

        replace_squeeze_ifs(&mut graph).unwrap();

        let identity = &graph.node[0];
        assert_eq!(identity.op_type, "Identity");
        assert_eq!(identity.input, ["audio"]);
        assert_eq!(identity.output, ["squeezed"]);
        assert!(identity.attribute.is_empty());
    }

    #[test]
    fn refuses_a_squeeze_whose_shape_matters() {
        let mut graph = squeeze_if("Add");

        assert!(replace_squeeze_ifs(&mut graph).is_err());
    }

    #[test]
    fn sums_an_int64_cast_in_i32_and_casts_back() {
        let mut to_int64 = node("Cast", &["mask"], "mask_i64");
        to_int64.attribute = cast(String::new(), "", "", DataType::Int64).attribute;
        let mut graph = GraphProto {
            node: vec![
                to_int64,
                node("CumSum", &["mask_i64", "axis"], "positions"),
                node("CumSum", &["probabilities", "axis"], "cdf"),
            ],
            ..Default::default()
        };

        run_integer_cumsums_in_i32(&mut graph);

        let ops: Vec<_> = graph
            .node
            .iter()
            .map(|node| node.op_type.as_str())
            .collect();
        assert_eq!(ops, ["Cast", "Cast", "CumSum", "Cast", "CumSum"]);
        let [_, to_i32, cumsum, to_i64, untouched] = graph.node.as_slice() else {
            unreachable!();
        };
        assert_eq!(to_i32.input, ["mask_i64"]);
        assert_eq!(to_i32.attribute[0].i, DataType::Int32 as i64);
        assert_eq!(cumsum.input, [to_i32.output[0].as_str(), "axis"]);
        assert_eq!(to_i64.input, cumsum.output);
        assert_eq!(to_i64.output, ["positions"]);
        assert_eq!(untouched.input, ["probabilities", "axis"]);
    }
}
