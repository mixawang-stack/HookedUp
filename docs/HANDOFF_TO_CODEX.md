# HANDOFF TO CODEX

This document reflects the current architecture after migrating from NestJS to Supabase + Next.js Route Handlers.

Repository overview
- Monorepo
- Frontend: `apps/web` (Next.js App Router)
- Admin: `apps/admin` (Next.js App Router)
- Backend: Supabase (Postgres + Auth + Storage + Realtime)
- Server routes: `apps/web/src/app/api/*`

Core data + auth
- Supabase Auth is the source of truth for sessions.
- App data is read via Supabase client with RLS.
- Sensitive writes are handled in server routes using `SUPABASE_SERVICE_ROLE_KEY`.

Server routes (apps/web/src/app/api)
- `POST /api/match/swipe` (creates swipe, match, conversation, participants)
- `GET  /api/consent/:matchId`
- `POST /api/consent/:matchId/init`
- `POST /api/consent/:matchId/confirm`
- `POST /api/intent/request`
- `POST /api/intent/confirm`
- `POST /api/reports`
- `POST /api/creem/webhook` (payment hook)

Environment variables
- Client: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Server: `SUPABASE_SERVICE_ROLE_KEY`
- Versions: `CONSENT_TERMS_VERSION`, `INTENT_TERMS_VERSION`
- Optional: TURN config for WebRTC

RLS
- Reference snapshot stored at `docs/rls.sql`.
- Apply updates via Supabase SQL Editor.
- Client is read-only for sensitive tables (Match/Swipe/Consent/Intent/Report).
- Writes go through server routes.

Notes
- Realtime chat/call uses Supabase Realtime (postgres_changes + broadcast).
- If changing terms, update version env vars.
