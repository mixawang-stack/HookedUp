# HookedUp? MVP

## Architecture (current)

- Frontend: Next.js App Router (`apps/web`)
- Admin: Next.js App Router (`apps/admin`)
- Backend: Supabase (Postgres + Auth + Storage + Realtime)
- Server routes: Next.js Route Handlers under `apps/web/src/app/api/*`

## Environment

See `apps/web/.env.example` and `apps/admin/.env.example` for required variables.
Key server-only variables:
- `SUPABASE_SERVICE_ROLE_KEY`
- `CONSENT_TERMS_VERSION`
- `INTENT_TERMS_VERSION`

## Notes

- Realtime chat/call signaling uses Supabase Realtime.
- Sensitive writes (match, consent, intent, report) are performed server-side via Route Handlers.
