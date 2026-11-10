import type { ComponentType } from "react";
import { useSelector } from "@tanstack/react-store";
import { backgroundAtom, type Background } from "@/shared/config/preferences.ts";
import { FirefliesBackground } from "@/app/layouts/FirefliesBackground.tsx";
import { InkBackground } from "@/app/layouts/InkBackground.tsx";
import { MistBackground } from "@/app/layouts/MistBackground.tsx";
import { PyrefliesBackground } from "@/app/layouts/PyrefliesBackground.tsx";
import { SunsetBackground } from "@/app/layouts/SunsetBackground.tsx";
import { SeaBackground } from "@/app/layouts/SeaBackground.tsx";
import { CherryBackground } from "@/app/layouts/CherryBackground.tsx";

const BACKGROUND_COMPONENTS: Record<Background, ComponentType | null> = {
  fireflies: FirefliesBackground,
  sea: SeaBackground,
  cherry: CherryBackground,
  mist: MistBackground,
  sunset: SunsetBackground,
  ink: InkBackground,
  pyreflies: PyrefliesBackground,
  plain: null,
};

/** The background chosen in Settings, behind every page. */
export function PageBackground() {
  const Component = BACKGROUND_COMPONENTS[useSelector(backgroundAtom)];
  return Component && <Component />;
}
