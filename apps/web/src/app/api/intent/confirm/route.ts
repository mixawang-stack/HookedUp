import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../_lib/supabaseAdmin";
import { requireUser } from "../../_lib/auth";

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const intentId = String(body?.intentId ?? "");
    if (!intentId) {
      return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: intent } = await supabase
      .from("IntentOffline")
      .select("*")
      .eq("id", intentId)
      .maybeSingle();

    if (!intent) {
      return NextResponse.json({ error: "INTENT_NOT_FOUND" }, { status: 404 });
    }

    if (intent.requesterId !== user.id && intent.responderId !== user.id) {
      return NextResponse.json({ error: "NOT_MEMBER" }, { status: 403 });
    }

    const now = new Date().toISOString();
    const updateData: Record<string, string> = {};

    if (user.id === intent.requesterId) {
      updateData.requesterConfirmedAt = intent.requesterConfirmedAt ?? now;
    } else if (user.id === intent.responderId) {
      updateData.responderConfirmedAt = intent.responderConfirmedAt ?? now;
    }

    const requesterConfirmed =
      updateData.requesterConfirmedAt ?? intent.requesterConfirmedAt;
    const responderConfirmed =
      updateData.responderConfirmedAt ?? intent.responderConfirmedAt;

    if (requesterConfirmed && responderConfirmed) {
      updateData.status = "CONFIRMED";
      updateData.confirmedAt = now;
    }

    const { data, error } = await supabase
      .from("IntentOffline")
      .update(updateData)
      .eq("id", intentId)
      .select("*")
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json(
        { error: "INTENT_CONFIRM_FAILED" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
