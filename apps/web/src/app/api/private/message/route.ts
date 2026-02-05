import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../_lib/supabaseAdmin";
import { requireUser } from "../../_lib/auth";

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const matchId = String(body?.matchId ?? "");
    const conversationId = String(body?.conversationId ?? "");
    const ciphertext = String(body?.ciphertext ?? "").trim();

    if ((!matchId && !conversationId) || !ciphertext) {
      return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    let resolvedMatchId = matchId;
    if (!resolvedMatchId && conversationId) {
      const { data: conversation } = await supabase
        .from("Conversation")
        .select("matchId")
        .eq("id", conversationId)
        .maybeSingle();
      resolvedMatchId = conversation?.matchId ?? "";
    }
    if (!resolvedMatchId) {
      return NextResponse.json({ error: "MATCH_NOT_FOUND" }, { status: 404 });
    }

    const { data: match } = await supabase
      .from("Match")
      .select("id,user1Id,user2Id")
      .eq("id", resolvedMatchId)
      .maybeSingle();

    if (!match) {
      return NextResponse.json({ error: "MATCH_NOT_FOUND" }, { status: 404 });
    }
    if (match.user1Id !== user.id && match.user2Id !== user.id) {
      return NextResponse.json({ error: "NOT_MATCH_MEMBER" }, { status: 403 });
    }

    const { data: message, error: messageError } = await supabase
      .from("Message")
      .insert({
        id: crypto.randomUUID(),
        matchId: resolvedMatchId,
        senderId: user.id,
        ciphertext,
        createdAt: new Date().toISOString()
      })
      .select("id,matchId,senderId,ciphertext,createdAt")
      .maybeSingle();

    if (messageError || !message) {
      return NextResponse.json(
        {
          error: "MESSAGE_CREATE_FAILED",
          details: messageError?.message ?? null
        },
        { status: 500 }
      );
    }

    const { data: sender } = await supabase
      .from("User")
      .select("id,maskName,maskAvatarUrl")
      .eq("id", user.id)
      .maybeSingle();

    return NextResponse.json({
      ...message,
      sender: sender ? [sender] : []
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
