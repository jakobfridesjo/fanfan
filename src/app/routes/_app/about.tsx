import { createFileRoute } from "@tanstack/react-router";
import AboutPage from "@/pages/about/ui/AboutPage.tsx";

export const Route = createFileRoute("/_app/about")({
  component: AboutPage,
});
