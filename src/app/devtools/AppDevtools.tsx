import { TanStackDevtools } from "@tanstack/solid-devtools";
import { useQueryClient } from "@tanstack/solid-query";
import { SolidQueryDevtoolsPanel } from "@tanstack/solid-query-devtools";
import { useRouter } from "@tanstack/solid-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/solid-router-devtools";

export function AppDevtools() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return (
    <TanStackDevtools
      config={{ hideInAutomation: true }}
      plugins={[
        {
          name: "TanStack Query",
          render: () => <SolidQueryDevtoolsPanel client={queryClient} />,
        },
        {
          name: "TanStack Router",
          render: () => <TanStackRouterDevtoolsPanel router={router} />,
        },
      ]}
    />
  );
}
