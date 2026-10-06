# Phase 19: Production Deployment & Observability

## 1. Environment Architecture

- **Development**: Local `vite` server with a local or dedicated dev Supabase project. Secrets are kept in `.env.local` (git-ignored).
- **Sandbox/Staging**: Deployed frontend pointing to a Sandbox Supabase instance. Contains Razorpay `sandbox` credentials to allow testing of edge functions without live money movement.
- **Production**: Deployed frontend (e.g. Vercel) pointing to the Production Supabase instance. Edge Functions hold live Razorpay credentials.

## 2. Environment Variables Matrix

| Variable | Client/Server | Dev | Sandbox | Production | Secret |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | Client | ✓ | ✓ | ✓ | No |
| `VITE_SUPABASE_ANON_KEY` | Client | ✓ | ✓ | ✓ | Public |
| `RAZORPAY_ENVIRONMENT` | Server | `sandbox` | `sandbox` | `production` | No |
| `RAZORPAY_KEY_ID` | Server | ✓ | ✓ | pending | Provider credential |
| `RAZORPAY_KEY_SECRET` | Server | ✓ | ✓ | pending | YES |
| `RAZORPAY_WEBHOOK_SECRET` | Server | ✓ | ✓ | pending | YES |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | ✓ | ✓ | pending | YES |

## 3. Deployment Readiness

- **Frontend**: Standard Vite build output (`dist`). No secrets exposed in bundle. Safe for static hosting.
- **Supabase**: RLS verified. Migrations cleanly maintained.
- **Edge Functions**: CORS handles preflight. `Deno.env.get` securely accesses backend variables. Fail-closed Sandbox check exists for sensitive operations.
- **Domain/HTTPS**: Will be managed by the deployment provider (Vercel/Cloudflare). Let's Encrypt / Custom TLS required. Supabase Auth Redirects must be explicitly whitelisted to the production domain.
- **Auth**: Supabase native session handling.
- **Webhooks**: Endpoints rely on HMAC SHA256 signatures, not frontend CORS or auth.

## 4. Security Controls

- **Secrets**: `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, and `SUPABASE_SERVICE_ROLE_KEY` are isolated to Edge Functions and never prefixed with `VITE_`.
- **CORS**: Implemented securely in Edge functions via `corsHeaders`.
- **Security Headers**: Needs explicit configuration via hosting provider (e.g. `vercel.json` or `next.config.js` equivalent).
- **Rate Limiting**: Supabase Auth limits brute force. Heavy application endpoints (like Reports or Payments) should use WAF rate limiting rules on the hosting edge.
- **Webhook Security**: Verified `x-razorpay-signature` checks in place.
- **Logging**: Supabase Edge Function logs do not dump request bodies directly containing API secrets.

## 5. Observability

- **Monitoring**: Supabase Dashboard provides basic HTTP/Auth metric monitoring.
- **Error Tracking**: Integration with tools like Sentry is recommended for production frontend but not currently hardcoded to avoid vendor lock-in.
- **Health Checks**: Basic `/v1/health` or static frontend parsing serves as an uptime indicator without triggering DB writes.
- **Alerts**: Recommend configuring Webhook failure alerts via Razorpay Dashboard and Edge Function 500s via Supabase webhooks to Slack/Email.

## 6. Database Reliability

- **Backups**: Rely on Supabase automated daily backups. 
- **PITR**: Recommended to enable Point-in-Time Recovery on Supabase Pro/Enterprise plans prior to live money movement.
- **Migration Discipline**: Linear `.sql` migrations maintained.
- **Reconciliation Scheduling**: Requires an external cron (e.g., Supabase pg_cron or GitHub Actions) to hit the reconciliation RPC safely on an interval.

## 7. Production Financial Safety

- Production money movement enabled: NO
- Production Razorpay credentials configured: NO
- Production Route enabled: NO
- Production transfers enabled: NO
- Production refunds enabled: NO
- Production reversals enabled: NO

Production financial operations are strictly gated by the `RAZORPAY_ENVIRONMENT` variable which remains `sandbox` currently, and by pending business approval for actual production credentials.

## 8. Rollback Strategy

- Frontend: One-click revert via hosting provider.
- Edge Functions: Redeploy older version via Supabase CLI.
- Database: Apply forward-fixing corrective migrations. Avoid destructive data truncation.

## 9. Smoke Tests

Validate login, search, profile view, and sandbox payment failures without attempting live API transactions.

---

# Final Scorecard

- Infrastructure readiness: VERIFIED
- Application deployment readiness: VERIFIED
- Security readiness: VERIFIED
- Observability readiness: REQUIRES EXTERNAL ACTION (Sentry/Alerts)
- Financial production readiness: BLOCKED (Pending live credentials)
