import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { getSupabaseAdmin } from "../../../_lib/supabaseAdmin";
import { requireUser } from "../../../_lib/auth";

const CONSENT_TERMS_VERSION = process.env.CONSENT_TERMS_VERSION ?? "v1";

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

    const { data: existing } = await supabase
      .from("ConsentRecord")
      .select(
        "id,matchId,userAId,userBId,termsVersion,hash,confirmedAtA,confirmedAtB"
      )
      .eq("matchId", matchId)
      .eq("userAId", userAId)
      .eq("userBId", userBId)
      .maybeSingle();

    if (existing) {
      if (existing.termsVersion === CONSENT_TERMS_VERSION) {
        return NextResponse.json(existing);
      }

      const payload = {
        matchId,
        userAId,
        userBId,
        termsVersion: CONSENT_TERMS_VERSION,
        confirmedAtA: null,
        confirmedAtB: null
      };
      const hash = hashConsentPayload(payload);

      const { data, error } = await supabase
        .from("ConsentRecord")
        .update({
          termsVersion: CONSENT_TERMS_VERSION,
          confirmedAtA: null,
          confirmedAtB: null,
          hash
        })
        .eq("id", existing.id)
        .select(
          "id,matchId,userAId,userBId,termsVersion,hash,confirmedAtA,confirmedAtB"
        )
        .maybeSingle();

      if (error || !data) {
        return NextResponse.json(
          { error: "CONSENT_CREATE_FAILED" },
          { status: 500 }
        );
      }

      return NextResponse.json(data);
    }

    const payload = {
      matchId,
      userAId,
      userBId,
      termsVersion: CONSENT_TERMS_VERSION,
      confirmedAtA: null,
      confirmedAtB: null
    };
    const hash = hashConsentPayload(payload);

    const { data, error } = await supabase
      .from("ConsentRecord")
      .insert({
        matchId,
        userAId,
        userBId,
        termsVersion: CONSENT_TERMS_VERSION,
        hash
      })
      .select(
        "id,matchId,userAId,userBId,termsVersion,hash,confirmedAtA,confirmedAtB"
      )
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json(
        { error: "CONSENT_CREATE_FAILED" },
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
