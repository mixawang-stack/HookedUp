import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../_lib/supabaseAdmin";
import { requireUser } from "../../_lib/auth";

const normalizePair = (userA: string, userB: string) =>
  userA < userB ? [userA, userB] : [userB, userA];

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const toUserId = String(body?.toUserId ?? "");
    const action = String(body?.action ?? "");

    if (!toUserId || (action !== "LIKE" && action !== "PASS")) {
      return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    }
    if (toUserId === user.id) {
      return NextResponse.json({ error: "CANNOT_SWIPE_SELF" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    if (action === "LIKE") {
      const { data: target } = await supabase
        .from("User")
        .select("role")
        .eq("id", toUserId)
        .maybeSingle();
      if (!target) {
        return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
      }
      if (target.role === "OFFICIAL") {
        return NextResponse.json(
          { error: "OFFICIAL_NO_PRIVATE" },
          { status: 403 }
        );
      }
    }

    const { error: swipeError } = await supabase.from("Swipe").upsert(
      {
        fromUserId: user.id,
        toUserId,
        action
      },
      { onConflict: "fromUserId,toUserId" }
    );
    if (swipeError) {
      return NextResponse.json({ error: "SWIPE_FAILED" }, { status: 500 });
    }

    let matchCreated = false;
    let matchId: string | null = null;

    if (action === "LIKE") {
      const { data: reverse } = await supabase
        .from("Swipe")
        .select("action")
        .eq("fromUserId", toUserId)
        .eq("toUserId", user.id)
        .maybeSingle();

      if (reverse?.action === "LIKE") {
        const [user1Id, user2Id] = normalizePair(user.id, toUserId);
        const { data: match, error: matchError } = await supabase
          .from("Match")
          .upsert(
            {
              user1Id,
              user2Id
            },
            { onConflict: "user1Id,user2Id" }
          )
          .select("id")
          .maybeSingle();

        if (!matchError && match?.id) {
          matchCreated = true;
          matchId = match.id;

          const { data: conversation } = await supabase
            .from("Conversation")
            .upsert({ matchId }, { onConflict: "matchId" })
            .select("id")
            .maybeSingle();

          if (conversation?.id) {
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
          }
        }
      }
    }

    return NextResponse.json({ matchCreated, matchId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
