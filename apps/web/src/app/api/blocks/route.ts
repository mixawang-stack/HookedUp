import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../_lib/supabaseAdmin";
import { requireUser } from "../_lib/auth";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("UserBlock")
      .select("blockedId")
      .eq("blockerId", user.id);

    if (error) {
      return NextResponse.json(
        { error: "BLOCKS_LOAD_FAILED" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      blockedIds: (data ?? []).map((row) => row.blockedId)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const targetUserId = String(body?.targetUserId ?? "").trim();
    const action = String(body?.action ?? "block").trim();

    if (!targetUserId) {
      return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (action === "unblock") {
      const { error } = await supabase
        .from("UserBlock")
        .delete()
        .eq("blockerId", user.id)
        .eq("blockedId", targetUserId);
      if (error) {
        return NextResponse.json(
          { error: "BLOCK_REMOVE_FAILED" },
          { status: 500 }
        );
      }
      return NextResponse.json({ ok: true });
    }

    const { error } = await supabase.from("UserBlock").upsert(
      {
        blockerId: user.id,
        blockedId: targetUserId
      },
      { onConflict: "blockerId,blockedId" }
    );
    if (error) {
      return NextResponse.json(
        { error: "BLOCK_CREATE_FAILED" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
