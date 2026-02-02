import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { getSupabaseAdmin } from "../_lib/supabaseAdmin";
import { requireUser } from "../_lib/auth";

export const runtime = "nodejs";

type TracePayload = {
  content: string;
  imageUrl?: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
};

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const payload = (await request.json()) as TracePayload;
    const content = (payload?.content ?? "").trim();
    if (!content) {
      return NextResponse.json({ error: "CONTENT_REQUIRED" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("Trace").insert({
      id: randomUUID(),
      authorId: user.id,
      content,
      imageUrl: payload.imageUrl ?? null,
      imageWidth: payload.imageWidth ?? null,
      imageHeight: payload.imageHeight ?? null
    });
    if (error) {
      return NextResponse.json({ error: "INSERT_FAILED" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
