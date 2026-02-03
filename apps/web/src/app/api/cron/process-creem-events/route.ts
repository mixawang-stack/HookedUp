import { NextResponse } from "next/server";

import { processCreemEvents } from "../../../lib/creem/processor";

export const runtime = "nodejs";

export async function POST() {
  try {
    const result = await processCreemEvents(25);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PROCESS_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET() {
  return POST();
}
