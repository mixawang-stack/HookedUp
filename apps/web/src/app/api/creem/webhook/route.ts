import crypto from "crypto";
import { NextResponse } from "next/server";

import { insertWebhookEvent } from "../../../lib/creem/store";
import { verifyCreemRequest } from "../../../lib/creem/verify";

export const runtime = "nodejs";

const hashRawBody = (rawBody: string) =>
  crypto.createHash("sha256").update(rawBody).digest("hex");

const toEventId = (payload: Record<string, unknown>, rawBody: string) =>
  (payload?.id as string | undefined) ??
  (payload?.event_id as string | undefined) ??
  ((payload?.data as Record<string, unknown> | undefined)?.id as
    | string
    | undefined) ??
  hashRawBody(rawBody);

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifyCreemRequest(request, rawBody)) {
    return NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 401 });
  }

  let payload: Record<string, unknown> = {};
  let eventType = "unknown";
  let createdAt: string | null = null;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
    eventType = String(payload?.type ?? "unknown");
    createdAt = (payload?.created_at as string | undefined) ?? null;
  } catch {
    payload = { raw: rawBody };
  }

  const eventId = toEventId(payload, rawBody);

  const { error } = await insertWebhookEvent({
    provider: "creem",
    eventId,
    type: eventType,
    payload,
    createdAt
  });

  if (error) {
    const code = (error as { code?: string }).code ?? "";
    if (code === "23505" || String(error.message || "").includes("duplicate")) {
      return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
    }
    return NextResponse.json({ error: "EVENT_INSERT_FAILED" }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
