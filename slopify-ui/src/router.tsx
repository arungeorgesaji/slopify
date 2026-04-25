import {
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router"
import { SlopifyShell } from "@/components/slopify-shell"
import { HomePage } from "@/routes/home-page"

const rootRoute = createRootRoute({
  component: SlopifyShell,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
})

const routeTree = rootRoute.addChildren([indexRoute])

export const router = createRouter({ routeTree })

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
