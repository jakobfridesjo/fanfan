import { createFileRoute } from "@tanstack/solid-router";
import SettingsManager from "@/pages/settings/ui/SettingsManager.tsx";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsManager,
});
