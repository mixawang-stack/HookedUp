# HookedUp? MVP

## Security & Privacy (MVP)

- **At-rest encryption**: Message content is stored encrypted with AES-256-GCM. The API decrypts on read for match members.
- **Key rotation**: `CRYPTO_KEY_ID` identifies the active key; `CRYPTO_KEY_PREVIOUS` allows decrypting older payloads.
- **Verification files**: Uploaded verification files are encrypted at rest; encryption metadata is stored (encrypted) in `metadataJson`.
- **Verification reasons**: Rejection reasons are stored encrypted and decrypted only for authorized views.
- **Reports**: `Report.detail` is stored encrypted and only decrypted for the reporter/admin.
- **Rekeying**: Use `pnpm -C apps/api crypto:rekey` after changing keys to re-encrypt existing records.

- **GDPR endpoints**:
  - `GET /me/export` returns user-owned data only.
  - `DELETE /me` performs a soft delete, removes tokens, scrubs message content, and clears verification file references + local files.
  - Export/delete are recorded in audit logs.

## Moderation

- `mute` (SUSPENDED) blocks chat and WebRTC signaling but still allows login.
- `ban` blocks login, match, and chat.

## Environment

`CRYPTO_KEY` must be a 32-byte key in base64 (AES-256-GCM). Example in `apps/api/.env.example`.

## Known Limitations

- No end-to-end encryption yet (server decrypts for authorized access).
- No file encryption at rest (local disk storage only).
- No background job for data retention or delayed deletes.
- Moderation actions other than `ban` are not enforced yet (warn/mute stored for audit).
- TURN is optional; without it, WebRTC may fail in restricted networks.
