import {
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router"
import { SlopifyShell } from "@/components/slopify-shell"
import { CreatePage } from "@/routes/create-page"
import { HomePage } from "@/routes/home-page"

const rootRoute = createRootRoute({
  component: SlopifyShell,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
})

const createRoutePage = createRoute({
  getParentRoute: () => rootRoute,
  path: "/create",
  component: CreatePage,
})

const routeTree = rootRoute.addChildren([indexRoute, createRoutePage])

export const router = createRouter({ routeTree })

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
