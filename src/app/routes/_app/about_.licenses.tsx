import { createFileRoute } from "@tanstack/react-router";
import LicensesPage from "@/pages/about/ui/LicensesPage.tsx";

export const Route = createFileRoute("/_app/about_/licenses")({
  component: LicensesPage,
});
