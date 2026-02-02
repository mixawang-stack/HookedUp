import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { getSupabaseAdmin } from "../../_lib/supabaseAdmin";
import { requireUser } from "../../_lib/auth";

export const runtime = "nodejs";

type LikePayload = {
  traceId?: string;
  like?: boolean;
};

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const payload = (await request.json()) as LikePayload;
    const traceId = payload?.traceId?.trim();
    if (!traceId) {
      return NextResponse.json({ error: "TRACE_ID_REQUIRED" }, { status: 400 });
    }
    const like = payload.like !== false;
    const supabase = getSupabaseAdmin();

    if (like) {
      const { error } = await supabase.from("TraceLike").insert({
        id: randomUUID(),
        traceId,
        userId: user.id
      });
      if (error) {
        return NextResponse.json({ error: "LIKE_FAILED" }, { status: 500 });
      }
    } else {
      const { error } = await supabase
        .from("TraceLike")
        .delete()
        .eq("traceId", traceId)
        .eq("userId", user.id);
      if (error) {
        return NextResponse.json({ error: "UNLIKE_FAILED" }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
