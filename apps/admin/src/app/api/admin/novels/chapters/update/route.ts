import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "../../../../_lib/supabaseAdmin";
import { requireAdminUser } from "../../../../_lib/auth";

export const runtime = "nodejs";

type Payload = {
  id?: string;
  title?: string;
  content?: string;
  orderIndex?: number;
  isFree?: boolean;
  isPublished?: boolean;
  price?: number | null;
};

export async function PATCH(request: Request) {
  try {
    await requireAdminUser(request);
    const payload = (await request.json()) as Payload;
    const id = payload?.id?.trim();
    if (!id) {
      return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("NovelChapter")
      .update({
        title: payload.title,
        content: payload.content,
        orderIndex: payload.orderIndex,
        isFree: payload.isFree,
        isPublished: payload.isPublished,
        price: payload.price ?? null
      })
      .eq("id", id);
    if (error) {
      return NextResponse.json(
        { error: "CHAPTER_UPDATE_FAILED", details: error.message },
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
