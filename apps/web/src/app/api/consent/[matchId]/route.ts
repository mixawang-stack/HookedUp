import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../_lib/supabaseAdmin";
import { requireUser } from "../../_lib/auth";

const normalizePair = (user1Id: string, user2Id: string) =>
  user1Id < user2Id
    ? { userAId: user1Id, userBId: user2Id }
    : { userAId: user2Id, userBId: user1Id };

export async function GET(
  request: Request,
  { params }: { params: { matchId: string } }
) {
  try {
    const user = await requireUser(request);
    const matchId = params.matchId;
    const supabase = getSupabaseAdmin();

    const { data: match } = await supabase
      .from("Match")
      .select("user1Id,user2Id")
      .eq("id", matchId)
      .maybeSingle();

    if (!match) {
      return NextResponse.json({ error: "MATCH_NOT_FOUND" }, { status: 404 });
    }
    if (match.user1Id !== user.id && match.user2Id !== user.id) {
      return NextResponse.json({ error: "NOT_MATCH_MEMBER" }, { status: 403 });
    }

    const { userAId, userBId } = normalizePair(match.user1Id, match.user2Id);

    const { data } = await supabase
      .from("ConsentRecord")
      .select(
        "id,matchId,userAId,userBId,termsVersion,hash,confirmedAtA,confirmedAtB"
      )
      .eq("matchId", matchId)
      .eq("userAId", userAId)
      .eq("userBId", userBId)
      .maybeSingle();

    return NextResponse.json(data ?? null);
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
