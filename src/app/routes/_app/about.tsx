import { createFileRoute } from "@tanstack/solid-router";
import AboutPage from "@/pages/about/ui/AboutPage.tsx";

export const Route = createFileRoute("/_app/about")({
  component: AboutPage,
});
