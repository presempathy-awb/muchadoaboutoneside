import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PoemVersionProvider } from "@/lib/poem-version";
import WorksheetStudio from "@/pages/worksheet-studio";
import "./calligraphy-cockpit.css";
import "./calligraphy-shell.css";
import "./calligraphy-desk.css";
import "./calligraphy-theme.css";
import "./calligraphy-motion.css";

const client = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
});
const rootRoute = createRootRoute({
  component: () => (
    <main>
      <Outlet />
    </main>
  ),
});
const cockpit = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => <WorksheetStudio cockpit />,
});
const preview = createRoute({
  getParentRoute: () => rootRoute,
  path: "/cockpit.html",
  component: () => <WorksheetStudio cockpit />,
});
const router = createRouter({
  routeTree: rootRoute.addChildren([cockpit, preview]),
  defaultNotFoundComponent: () => <WorksheetStudio cockpit />,
});
const root = document.getElementById("root");
if (!root) throw new Error("Calligraphy cockpit root is missing.");
createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <PoemVersionProvider>
        <RouterProvider router={router} />
      </PoemVersionProvider>
    </QueryClientProvider>
  </StrictMode>,
);
