import { NextResponse } from "next/server";

import { processCreemEvents } from "../../../lib/creem/processor";

export const runtime = "nodejs";

const authorizeCron = (request: Request) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const authHeader = request.headers.get("authorization") ?? "";
  return authHeader === `Bearer ${secret}`;
};

export async function POST(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  try {
    const result = await processCreemEvents(25);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PROCESS_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}
