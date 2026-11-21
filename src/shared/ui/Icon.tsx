import { createElement, type IconNode } from "lucide";

interface IconProps {
  icon: IconNode;
  class?: string;
  /** Names the icon for assistive tech; without it the icon is decoration. */
  label?: string;
  role?: string;
  "data-slot"?: string;
  /** Where the icon sits in a button, which pads that side less. */
  "data-icon"?: "inline-start" | "inline-end";
}

/** A Lucide icon, drawn from the icon's nodes. */
export function Icon(props: IconProps) {
  const attributes = () => {
    const given: Record<string, string> = props.label
      ? { "aria-label": props.label }
      : { "aria-hidden": "true" };
    if (props.class) given.class = props.class;
    if (props.role) given.role = props.role;
    if (props["data-slot"]) given["data-slot"] = props["data-slot"];
    if (props["data-icon"]) given["data-icon"] = props["data-icon"];
    return given;
  };
  return <>{createElement(props.icon, attributes())}</>;
}
