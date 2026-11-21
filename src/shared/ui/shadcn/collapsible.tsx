import type { ValidComponent } from "@solidjs/web";
import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import {
  Collapsible as CollapsiblePrimitive,
  type CollapsibleContentProps,
  type CollapsibleRootProps,
  type CollapsibleTriggerProps,
} from "@kobalte/core/collapsible";

function Collapsible<T extends ValidComponent = "div">(
  props: PolymorphicProps<T, CollapsibleRootProps<T>>
) {
  return <CollapsiblePrimitive data-slot="collapsible" {...props} />;
}

function CollapsibleTrigger<T extends ValidComponent = "button">(
  props: PolymorphicProps<T, CollapsibleTriggerProps<T>>
) {
  return <CollapsiblePrimitive.Trigger data-slot="collapsible-trigger" {...props} />;
}

function CollapsibleContent<T extends ValidComponent = "div">(
  props: PolymorphicProps<T, CollapsibleContentProps<T>>
) {
  return <CollapsiblePrimitive.Content data-slot="collapsible-content" {...props} />;
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
