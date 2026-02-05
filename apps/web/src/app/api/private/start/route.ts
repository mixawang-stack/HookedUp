import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../_lib/supabaseAdmin";
import { requireUser } from "../../_lib/auth";

const normalizePair = (userA: string, userB: string) =>
  userA < userB ? [userA, userB] : [userB, userA];

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const targetUserId = String(body?.targetUserId ?? "");

    if (!targetUserId) {
      return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    }
    if (targetUserId === user.id) {
      return NextResponse.json({ error: "CANNOT_MESSAGE_SELF" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: target } = await supabase
      .from("User")
      .select("id,role")
      .eq("id", targetUserId)
      .maybeSingle();
    if (!target) {
      return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
    }
    if (target.role === "OFFICIAL") {
      return NextResponse.json({ error: "OFFICIAL_NO_PRIVATE" }, { status: 403 });
    }

    const [user1Id, user2Id] = normalizePair(user.id, targetUserId);
    const { data: match, error: matchError } = await supabase
      .from("Match")
      .upsert(
        {
          user1Id,
          user2Id,
          matchedAt: new Date().toISOString()
        },
        { onConflict: "user1Id,user2Id" }
      )
      .select("id")
      .maybeSingle();

    if (matchError || !match?.id) {
      return NextResponse.json(
        {
          error: "MATCH_CREATE_FAILED",
          details: matchError?.message ?? null
        },
        { status: 500 }
      );
    }

    const { data: conversation, error: convoError } = await supabase
      .from("Conversation")
      .upsert({ matchId: match.id }, { onConflict: "matchId" })
      .select("id")
      .maybeSingle();

    if (convoError || !conversation?.id) {
      return NextResponse.json(
        { error: "CONVERSATION_CREATE_FAILED" },
        { status: 500 }
      );
    }

    await Promise.all([
      supabase.from("ConversationParticipant").upsert(
        {
          conversationId: conversation.id,
          userId: user1Id,
          isMuted: false
        },
        { onConflict: "conversationId,userId" }
      ),
      supabase.from("ConversationParticipant").upsert(
        {
          conversationId: conversation.id,
          userId: user2Id,
          isMuted: false
        },
        { onConflict: "conversationId,userId" }
      )
    ]);

    return NextResponse.json({ conversationId: conversation.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
