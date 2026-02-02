import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { getSupabaseAdmin } from "../../../_lib/supabaseAdmin";
import { requireUser } from "../../../_lib/auth";

const normalizePair = (user1Id: string, user2Id: string) =>
  user1Id < user2Id
    ? { userAId: user1Id, userBId: user2Id }
    : { userAId: user2Id, userBId: user1Id };

const hashConsentPayload = (payload: unknown) => {
  const raw = JSON.stringify(payload);
  return createHash("sha256").update(raw).digest("hex");
};

export async function POST(
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

    const { data: record } = await supabase
      .from("ConsentRecord")
      .select(
        "id,matchId,userAId,userBId,termsVersion,hash,confirmedAtA,confirmedAtB"
      )
      .eq("matchId", matchId)
      .eq("userAId", userAId)
      .eq("userBId", userBId)
      .maybeSingle();

    if (!record) {
      return NextResponse.json(
        { error: "CONSENT_NOT_INITIALIZED" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const updateData: { confirmedAtA?: string; confirmedAtB?: string } = {};

    if (user.id === userAId) {
      updateData.confirmedAtA = record.confirmedAtA ?? now;
    } else if (user.id === userBId) {
      updateData.confirmedAtB = record.confirmedAtB ?? now;
    } else {
      return NextResponse.json({ error: "NOT_MATCH_MEMBER" }, { status: 403 });
    }

    const payload = {
      matchId,
      userAId,
      userBId,
      termsVersion: record.termsVersion,
      confirmedAtA: updateData.confirmedAtA ?? record.confirmedAtA ?? null,
      confirmedAtB: updateData.confirmedAtB ?? record.confirmedAtB ?? null
    };
    const hash = hashConsentPayload(payload);

    const { data, error } = await supabase
      .from("ConsentRecord")
      .update({ ...updateData, hash })
      .eq("id", record.id)
      .select(
        "id,matchId,userAId,userBId,termsVersion,hash,confirmedAtA,confirmedAtB"
      )
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json(
        { error: "CONSENT_CONFIRM_FAILED" },
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
