import { TanStackDevtools } from "@tanstack/react-devtools";
import { formDevtoolsPlugin } from "@tanstack/react-form-devtools";
import { useQueryClient } from "@tanstack/react-query";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { useRouter } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

export function AppDevtools() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return (
    <TanStackDevtools
      plugins={[
        { name: "TanStack Query", render: <ReactQueryDevtoolsPanel client={queryClient} /> },
        { name: "TanStack Router", render: <TanStackRouterDevtoolsPanel router={router} /> },
        formDevtoolsPlugin(),
      ]}
    />
  );
}
