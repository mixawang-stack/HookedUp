import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "../../../../_lib/supabaseAdmin";
import { requireAdminUser } from "../../../../_lib/auth";

export const runtime = "nodejs";

type Payload = {
  currentId?: string;
  targetId?: string;
  currentOrder?: number;
  targetOrder?: number;
};

export async function POST(request: Request) {
  try {
    await requireAdminUser(request);
    const payload = (await request.json()) as Payload;
    const currentId = payload?.currentId?.trim();
    const targetId = payload?.targetId?.trim();
    const currentOrder = payload?.currentOrder;
    const targetOrder = payload?.targetOrder;
    if (
      !currentId ||
      !targetId ||
      !currentOrder ||
      !targetOrder ||
      currentOrder < 1 ||
      targetOrder < 1
    ) {
      return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const tempOrder = 1000000 + Math.floor(Math.random() * 100000);

    const { error: tempError } = await supabase
      .from("NovelChapter")
      .update({ orderIndex: tempOrder })
      .eq("id", currentId);
    if (tempError) {
      return NextResponse.json(
        { error: "REORDER_FAILED", details: tempError.message },
        { status: 500 }
      );
    }

    const { error: swapError } = await supabase
      .from("NovelChapter")
      .update({ orderIndex: currentOrder })
      .eq("id", targetId);
    if (swapError) {
      return NextResponse.json(
        { error: "REORDER_FAILED", details: swapError.message },
        { status: 500 }
      );
    }

    const { error: finalizeError } = await supabase
      .from("NovelChapter")
      .update({ orderIndex: targetOrder })
      .eq("id", currentId);
    if (finalizeError) {
      return NextResponse.json(
        { error: "REORDER_FAILED", details: finalizeError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status =
      message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
