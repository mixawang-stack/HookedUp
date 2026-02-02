import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../_lib/supabaseAdmin";
import { requireUser } from "../_lib/auth";

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const targetType = String(body?.targetType ?? "");
    const targetId = String(body?.targetId ?? "");
    const reasonType = String(body?.reasonType ?? "");
    const detail = String(body?.detail ?? "").trim();

    if (!targetType || !targetId || !reasonType) {
      return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("Report").insert({
      reporterId: user.id,
      targetType,
      targetId,
      reasonType,
      detail: detail || null
    });

    if (error) {
      return NextResponse.json(
        { error: "REPORT_CREATE_FAILED" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
