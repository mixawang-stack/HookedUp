# HANDOFF TO CODEX

This document summarizes the current backend implementation and the
frontend integration contract for the HookedUp MVP monorepo.

Repository overview
- Monorepo
- Backend: apps/api (Node.js, NestJS-style controllers, Prisma, PostgreSQL)
- Frontend: apps/web
- UI rules: UI_GUIDE.md and COLOR_GUIDE.md

Backend capabilities already implemented
- Auth: register, login, email verification, refresh/logout, change password
- User: profile, preferences, block/report, GDPR export and delete
- Hall: trace feed (posts), replies, likes
- Match: recommendations, swipe, match list
- Private: conversations, messages, mute/unmute
- Consent: two-party consent records
- Rooms: create/join/leave, invites, share links, join requests, games, messages
- Novels: list, preview, full content, reactions, admin CRUD
- Reports: create and list my reports
- Verifications: age/health/criminal, file access for admins
- Uploads: generic, avatar, image
- Admin: admin login, verifications review, report review, user listing
- Security: AES-256-GCM at-rest encryption for messages and sensitive fields

Module map (apps/api/src)
- admin, auth, chat, consent, hall, intent, match, novels, private,
  reports, rooms, traces, uploads, user, verifications

API endpoints (by controller)

System
- GET /health
- GET /config

Auth
- POST /auth/register
- POST /auth/verify-code
- POST /auth/login
- POST /auth/refresh
- POST /auth/logout
- POST /auth/change-password
- GET  /auth/verify-email

User
- GET  /me
- PATCH /me
- GET  /me/preferences
- PUT  /me/preferences
- GET  /me/export
- DELETE /me
- GET  /users/:id
- POST /users/:id/block
- DELETE /users/:id/block
- POST /users/:id/report

Hall / Traces
- GET  /hall
- POST /traces
- POST /traces/:id/replies
- GET  /traces/me
- GET  /traces/:id
- PATCH /traces/:id
- DELETE /traces/:id
- POST /traces/:id/like
- DELETE /traces/:id/like

Match
- GET  /match/recommendations
- POST /match/swipe
- GET  /match/list

Private
- GET  /private/conversations
- GET  /private/unread-total
- GET  /private/conversations/:id/messages
- POST /private/conversations/:id/messages
- POST /private/conversations/start
- POST /private/conversations/:id/mute
- POST /private/conversations/:id/unmute

Chat
- GET  /chat/:matchId/messages

Consent
- POST /consent/:matchId/init
- POST /consent/:matchId/confirm
- GET  /consent/:matchId

Intent
- POST /intent/offline/request
- POST /intent/offline/confirm

Rooms
- POST /rooms
- GET  /rooms
- GET  /rooms/active
- GET  /rooms/my-active
- GET  /rooms/:id
- POST /rooms/:id/join
- POST /rooms/:id/join-request
- GET  /rooms/:id/join-request
- GET  /rooms/:id/requests
- POST /rooms/:id/requests/:requestId/approve
- POST /rooms/:id/requests/:requestId/reject
- POST /rooms/:id/leave
- GET  /rooms/:id/members/count
- POST /rooms/:id/share-links
- POST /rooms/:id/share-links/:linkId/revoke
- GET  /rooms/:id/invite-candidates
- POST /rooms/:id/invites
- POST /rooms/invites/:inviteId/accept
- POST /rooms/invites/:inviteId/decline
- GET  /rooms/:id/messages
- POST /rooms/:id/messages
- POST /rooms/:id/start
- POST /rooms/:id/end
- GET  /rooms/:id/games/dice
- POST /rooms/:id/games/dice/start
- POST /rooms/:id/games/dice/ask
- POST /rooms/:id/games/dice/respond
- POST /rooms/:id/games/dice/refuse
- POST /rooms/:id/games/dice/skip
- POST /rooms/:id/games/dice/protect/skip
- POST /rooms/:id/games/dice/protect/silent
- POST /rooms/:id/games/dice/protect/observer
- GET  /rooms/:id/games/one-thing
- POST /rooms/:id/games/one-thing/start
- POST /rooms/:id/games/one-thing/share
- POST /rooms/:id/games/one-thing/react
- POST /rooms/:id/game
- GET  /rooms/:id/game

Room share
- GET  /r/:token

Novels (public)
- GET  /novels
- GET  /novels/:id/preview
- GET  /novels/:id/full
- GET  /recommendations
- POST /novels/:id/like
- POST /novels/:id/dislike

Novels (admin)
- GET  /admin/novels
- POST /admin/novels
- PATCH /admin/novels/:id
- DELETE /admin/novels/:id
- GET  /admin/novels/:id/chapters
- POST /admin/novels/:id/chapters
- PATCH /admin/novels/:id/chapters/:chapterId
- DELETE /admin/novels/:id/chapters/:chapterId
- POST /admin/novels/:id/pdf

Reports
- POST /reports
- GET  /me/reports

Admin
- POST /admin/login
- GET  /admin/verifications
- POST /admin/verifications/:id/approve
- POST /admin/verifications/:id/reject
- GET  /admin/reports
- POST /admin/reports/:id/resolve

Admin user listing
- GET  /admin/users
- GET  /admin/users/filters
- GET  /admin/users/:id
- GET  /users
- GET  /users/filters
- GET  /users/:id

Uploads
- POST /uploads
- POST /uploads/avatar
- POST /uploads/image

Verifications
- GET  /verifications/me
- GET  /verifications
- GET  /verifications/:id/file
- POST /verifications/age
- POST /verifications/health
- POST /verifications/criminal-record

Data model summary (apps/api/prisma/schema.prisma)
- User, AdminUser, Preference
- EmailVerificationToken, PendingRegistration, RefreshToken
- Verification
- Report, AuditLog, UserBlock
- Swipe, Match, Message, ConsentRecord, Conversation, ConversationParticipant
- IntentOffline
- RecommendationExposure
- Room, RoomMembership, RoomInvite, RoomShareLink, RoomJoinRequest
- RoomGameSelection, RoomGameState, RoomMessage
- Trace, TraceReply, TraceLike
- Novel, NovelChapter, NovelReaction
- Article

Front-end integration notes
- Base API URL: NEXT_PUBLIC_API_BASE_URL (frontend) or localhost:3001 default
- Auth: Bearer token in Authorization header for protected endpoints
- Uploads: multipart/form-data for avatar and image uploads
- Encryption: message content and sensitive fields are encrypted at rest
- GDPR: GET /me/export and DELETE /me supported
- Moderation: status and role values are enforced on the backend

Open gaps for future MVP scope
- Bookstore module is not present in schema or controllers
- Decide whether /recommendations should be scoped under /novels
- Consider documenting WebSocket events for room and chat gateways

Maintenance notes
- Keep UI work aligned to UI_GUIDE.md and COLOR_GUIDE.md
- Add new modules inside apps/api, do not split into new projects
