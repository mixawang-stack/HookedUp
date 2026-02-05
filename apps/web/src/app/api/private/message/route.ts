import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../_lib/supabaseAdmin";
import { requireUser } from "../../_lib/auth";

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const matchId = String(body?.matchId ?? "");
    const ciphertext = String(body?.ciphertext ?? "").trim();

    if (!matchId || !ciphertext) {
      return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: match } = await supabase
      .from("Match")
      .select("id,user1Id,user2Id")
      .eq("id", matchId)
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
        matchId,
        senderId: user.id,
        ciphertext
      })
      .select("id,matchId,senderId,ciphertext,createdAt")
      .maybeSingle();

    if (messageError || !message) {
      return NextResponse.json(
        { error: "MESSAGE_CREATE_FAILED" },
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
