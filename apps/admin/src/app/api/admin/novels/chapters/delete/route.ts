import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "../../../../_lib/supabaseAdmin";
import { requireAdminUser } from "../../../../_lib/auth";

export const runtime = "nodejs";

type Payload = { id?: string };

export async function DELETE(request: Request) {
  try {
    await requireAdminUser(request);
    const payload = (await request.json()) as Payload;
    const id = payload?.id?.trim();
    if (!id) {
      return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("NovelChapter").delete().eq("id", id);
    if (error) {
      return NextResponse.json(
        { error: "CHAPTER_DELETE_FAILED", details: error.message },
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
