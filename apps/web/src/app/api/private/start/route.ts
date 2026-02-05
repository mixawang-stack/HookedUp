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
    const { data: existingMatch } = await supabase
      .from("Match")
      .select("id")
      .eq("user1Id", user1Id)
      .eq("user2Id", user2Id)
      .maybeSingle();

    let matchId = existingMatch?.id ?? null;
    if (!matchId) {
      const { data: insertedMatch, error: matchError } = await supabase
        .from("Match")
        .insert({
          id: crypto.randomUUID(),
          user1Id,
          user2Id,
          matchedAt: new Date().toISOString()
        })
        .select("id")
        .maybeSingle();

      if (matchError || !insertedMatch?.id) {
        return NextResponse.json(
          {
            error: "MATCH_CREATE_FAILED",
            details: matchError?.message ?? null
          },
          { status: 500 }
        );
      }
      matchId = insertedMatch.id;
    }

    const { data: existingConversation } = await supabase
      .from("Conversation")
      .select("id")
      .eq("matchId", matchId)
      .maybeSingle();

    let conversationId = existingConversation?.id ?? null;
    if (!conversationId) {
      const { data: conversation, error: convoError } = await supabase
        .from("Conversation")
        .insert({
          id: crypto.randomUUID(),
          matchId
        })
        .select("id")
        .maybeSingle();

      if (convoError || !conversation?.id) {
        return NextResponse.json(
          {
            error: "CONVERSATION_CREATE_FAILED",
            details: convoError?.message ?? null
          },
          { status: 500 }
        );
      }
      conversationId = conversation.id;
    }

    if (convoError || !conversation?.id) {
      return NextResponse.json(
        { error: "CONVERSATION_CREATE_FAILED" },
        { status: 500 }
      );
    }

    await Promise.all([
      supabase.from("ConversationParticipant").upsert(
        {
          conversationId,
          userId: user1Id,
          isMuted: false
        },
        { onConflict: "conversationId,userId" }
      ),
      supabase.from("ConversationParticipant").upsert(
        {
          conversationId,
          userId: user2Id,
          isMuted: false
        },
        { onConflict: "conversationId,userId" }
      )
    ]);

    return NextResponse.json({ conversationId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
