import type { ComponentType } from "react";
import { useSelector } from "@tanstack/react-store";
import { backgroundAtom, type Background } from "@/shared/config/preferences.ts";
import { FirefliesBackground } from "@/app/layouts/FirefliesBackground.tsx";
import { MistBackground } from "@/app/layouts/MistBackground.tsx";
import { SeaBackground } from "@/app/layouts/SeaBackground.tsx";
import { CherryBackground } from "@/app/layouts/CherryBackground.tsx";

const BACKGROUND_COMPONENTS: Record<Background, ComponentType | null> = {
  fireflies: FirefliesBackground,
  sea: SeaBackground,
  cherry: CherryBackground,
  mist: MistBackground,
  plain: null,
};

/** The background chosen in Settings, behind every page. */
export function PageBackground() {
  const Component = BACKGROUND_COMPONENTS[useSelector(backgroundAtom)];
  return Component && <Component />;
}
