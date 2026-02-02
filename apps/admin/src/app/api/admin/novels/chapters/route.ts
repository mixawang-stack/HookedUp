import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { getSupabaseAdmin } from "../../../_lib/supabaseAdmin";
import { requireAdminUser } from "../../../_lib/auth";

export const runtime = "nodejs";

type Payload = {
  novelId?: string;
  orderIndex?: number;
  title?: string;
};

export async function POST(request: Request) {
  try {
    await requireAdminUser(request);
    const payload = (await request.json()) as Payload;
    const novelId = payload?.novelId?.trim();
    const orderIndex = payload?.orderIndex;
    if (!novelId || !orderIndex || orderIndex < 1) {
      return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
    }
    const title = payload?.title?.trim() || `Chapter ${orderIndex}`;

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("NovelChapter")
      .insert({
        id: randomUUID(),
        novelId,
        title,
        content: "",
        orderIndex,
        isFree: false,
        isPublished: true,
        price: null
      })
      .select()
      .single();
    if (error || !data) {
      return NextResponse.json(
        { error: "CHAPTER_CREATE_FAILED", details: error?.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status =
      message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
