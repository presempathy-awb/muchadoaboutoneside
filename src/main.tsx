import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { AppShell } from "@/components/app-shell";
import { Studio } from "@/pages/studio";
import "./styles.css";

const Foil = lazy(() => import("@/pages/foil"));
const Assembly = lazy(() => import("@/pages/assembly"));
const Archive = lazy(() => import("@/pages/archive"));
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
});
const rootRoute = createRootRoute({ component: AppShell });
const foilHomeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => (
    <Suspense fallback={<RouteLoading />}>
      <Foil />
    </Suspense>
  ),
});
const studioRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/studio",
  validateSearch: (search: Record<string, unknown>) => ({
    part: typeof search.part === "string" ? search.part : undefined,
  }),
  component: Studio,
});
const assemblyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/assembly",
  component: () => (
    <Suspense fallback={<RouteLoading />}>
      <Assembly />
    </Suspense>
  ),
});
const archiveRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/archive",
  component: () => (
    <Suspense fallback={<RouteLoading />}>
      <Archive />
    </Suspense>
  ),
});
const foilRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/foil",
  component: () => (
    <Suspense fallback={<RouteLoading />}>
      <Foil />
    </Suspense>
  ),
});
const router = createRouter({
  routeTree: rootRoute.addChildren([
    foilHomeRoute,
    studioRoute,
    assemblyRoute,
    archiveRoute,
    foilRoute,
  ]),
  defaultNotFoundComponent: () => (
    <div className="empty-state">
      <h1>Page not found</h1>
      <a href="/">Return to the foil edition</a>
    </div>
  ),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function RouteLoading() {
  return (
    <div className="empty-state" role="status">
      Opening the workspace…
    </div>
  );
}
const root = document.getElementById("root");
if (!root) throw new Error("Application root is missing");
createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
