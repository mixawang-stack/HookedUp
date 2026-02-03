import crypto from "crypto";
import { NextResponse } from "next/server";

import { insertWebhookEvent } from "../../../lib/creem/store";
import { verifyCreemRequest } from "../../../lib/creem/verify";

export const runtime = "nodejs";

const toEventId = (payload: Record<string, unknown>, rawBody: string) => {
  const id = (payload?.id as string | undefined) ?? "";
  if (id) return id;
  return crypto.createHash("sha256").update(rawBody).digest("hex");
};

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifyCreemRequest(request, rawBody)) {
    return NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 401 });
  }

  let payload: Record<string, unknown> = {};
  let eventType = "unknown";
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
    eventType = String(payload?.type ?? "unknown");
  } catch {
    payload = { raw: rawBody };
  }

  const eventId = toEventId(payload, rawBody);

  const { error } = await insertWebhookEvent({
    provider: "CREEM",
    eventId,
    type: eventType,
    payload
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
