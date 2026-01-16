import { createHash } from "crypto";

export function hashConsentPayload(payload: unknown): string {
  const raw = JSON.stringify(payload);
  return createHash("sha256").update(raw).digest("hex");
}
