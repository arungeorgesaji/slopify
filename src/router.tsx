import {
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router"
import { SlopifyShell } from "@/components/slopify-shell"
import { CreatePage } from "@/routes/create-page"
import { CreateReviewPage } from "@/routes/create-review-page"
import { HomePage } from "@/routes/home-page"
import { IntroPage } from "@/routes/intro-page"
import { LyricsReviewPage } from "@/routes/lyrics-review-page"

const rootRoute = createRootRoute({
  component: SlopifyShell,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: IntroPage,
})

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/app",
  component: HomePage,
})

const createRoutePage = createRoute({
  getParentRoute: () => rootRoute,
  path: "/create",
  component: CreatePage,
})

const createReviewRoutePage = createRoute({
  getParentRoute: () => rootRoute,
  path: "/create/$sessionId",
  component: CreateReviewPage,
})

const lyricsReviewRoutePage = createRoute({
  getParentRoute: () => rootRoute,
  path: "/create/lyrics/$draftId",
  component: LyricsReviewPage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  appRoute,
  createRoutePage,
  lyricsReviewRoutePage,
  createReviewRoutePage,
])

export const router = createRouter({ routeTree })

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
