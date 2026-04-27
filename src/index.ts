import "dotenv/config";

import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { cors } from "hono/cors";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { albumVideoRoutes } from "./routes/albumVideo.routes.js";
import { AppError, formatErrorResponse } from "./utils/errors.js";
import { env } from "./utils/env.js";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    maxAge: 86400
  })
);

app.get("/health", (c) =>
  c.json({
    ok: true,
    service: "lyrics-to-album-video-service"
  })
);

app.route("/album-video", albumVideoRoutes);
app.use("/*", serveStatic({ root: "./public" }));

app.notFound((c) =>
  c.json(
    formatErrorResponse(new AppError("Route not found", 404, "NOT_FOUND")),
    404
  )
);

app.onError((error, c) => {
  if (error instanceof AppError) {
    return c.json(formatErrorResponse(error), error.statusCode);
  }

  if (error instanceof HTTPException) {
    return c.json(
      formatErrorResponse(
        new AppError(
          error.message || "HTTP error",
          error.status as ContentfulStatusCode,
          "HTTP_ERROR"
        )
      ),
      error.status as ContentfulStatusCode
    );
  }

  console.error("Unhandled error", error);

  return c.json(
    formatErrorResponse(
      new AppError("Internal server error", 500, "INTERNAL_SERVER_ERROR")
    ),
    500
  );
});

serve(
  {
    fetch: app.fetch,
    port: env.PORT
  },
  (info) => {
    console.log(
      `Lyrics-to-Album-Video service listening on http://localhost:${info.port}`
    );
  }
);
