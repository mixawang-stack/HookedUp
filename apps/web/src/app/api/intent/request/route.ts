import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../_lib/supabaseAdmin";
import { requireUser } from "../../_lib/auth";

const INTENT_TERMS_VERSION = process.env.INTENT_TERMS_VERSION ?? "v1";

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const conversationId = String(body?.conversationId ?? "");
    if (!conversationId) {
      return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: participants } = await supabase
      .from("ConversationParticipant")
      .select("userId")
      .eq("conversationId", conversationId);

    const isMember = (participants ?? []).some(
      (p) => p.userId === user.id
    );
    if (!isMember) {
      return NextResponse.json({ error: "NOT_MEMBER" }, { status: 403 });
    }
    const other = (participants ?? []).find((p) => p.userId !== user.id);
    if (!other) {
      return NextResponse.json(
        { error: "PARTICIPANT_MISSING" },
        { status: 400 }
      );
    }

    const { data: existing } = await supabase
      .from("IntentOffline")
      .select("*")
      .eq("conversationId", conversationId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(existing);
    }

    const { data, error } = await supabase
      .from("IntentOffline")
      .insert({
        conversationId,
        requesterId: user.id,
        responderId: other.userId,
        status: "PENDING",
        termsVersion: INTENT_TERMS_VERSION
      })
      .select("*")
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json(
        { error: "INTENT_CREATE_FAILED" },
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
