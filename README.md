# slopify-music

## CORS for Vercel + Railway

The frontend sends `x-openai-api-key` and `x-elevenlabs-api-key` headers, so browsers
will issue a CORS preflight for music generation requests.

`app.config.Settings` allows:

- `CORS_ALLOW_ORIGINS`: comma-separated exact origins
- `CORS_ALLOW_ORIGIN_REGEX`: optional regex for dynamic origins such as Vercel previews

Default behavior now includes:

- `http://localhost:5173`
- `http://localhost:5174`
- any `https://*.vercel.app` origin

Recommended Railway variables:

```env
CORS_ALLOW_ORIGINS=https://your-production-site.vercel.app
CORS_ALLOW_ORIGIN_REGEX=^https://([a-zA-Z0-9-]+\\.)*vercel\\.app$
```

If you use a custom frontend domain instead of a `vercel.app` domain, add that exact
origin to `CORS_ALLOW_ORIGINS`.
