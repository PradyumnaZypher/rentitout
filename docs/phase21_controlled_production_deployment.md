# Phase 21: Controlled Production Deployment

## Architecture Overview
The application is structured for a controlled transition to production:
```text
PUBLIC PRODUCTION WEBSITE (Vite / Vercel)
        ↓
PRODUCTION SUPABASE (Database / Auth / Edge Functions)
        ↓
RAZORPAY SANDBOX (Financial APIs)
```

## Environment Config
- **Application Environment**: Production. All builds are minified, chunked, and deployed via public CDN.
- **Financial Environment**: Sandbox. The application strictly leverages `RAZORPAY_ENVIRONMENT=sandbox` within edge function environments.
- **Environment Variables Matrix**:
  - `VITE_SUPABASE_URL`: Public (Production URL)
  - `VITE_SUPABASE_ANON_KEY`: Public (Production Anon Key)
  - `RAZORPAY_ENVIRONMENT`: Secret (Set to `sandbox`)
  - `RAZORPAY_KEY_ID`: Secret (Sandbox ID)
  - `RAZORPAY_KEY_SECRET`: Secret (Sandbox Secret)
  - `RAZORPAY_WEBHOOK_SECRET`: Secret (Sandbox Webhook Secret)

## Infrastructure Readiness
- **Frontend Host**: Prepared for live Vercel/Netlify binding.
- **Supabase**: Target project ready.
- **Edge Functions**: Handled natively by Supabase CLI deployment (`supabase functions deploy`).
- **Domain & Auth Redirects**: Custom domains (DNS `A`/`CNAME` records) remain an external manual process. Supabase dashboard must whitelist this specific custom domain in Authentication -> URL Configuration.
- **CORS**: Functions properly gate access.
- **Security Headers**: Configuration must be applied by the CDN edge using appropriate `vercel.json` or `_headers` files upon domain assignment.

## Observability & Health
- Basic `/v1/health` JSON payload confirms function availability without triggering transactional state.
- Sentry integration and explicit WAF policies remain pending on the external domain setup.

## Rollback Strategy
1. **Frontend**: Single-click restore to previous immutable deployment on Vercel/Netlify.
2. **Edge Functions**: Deploy specific branch or previous commit via `supabase functions deploy`.
3. **Database**: Utilize forward-fixing migrations for non-destructive DB schema repairs.

## Financial Safety Control
Sandbox fail-closed logic verified. No production endpoints can be triggered by Edge Functions even if a valid user is interacting with the live production frontend.
