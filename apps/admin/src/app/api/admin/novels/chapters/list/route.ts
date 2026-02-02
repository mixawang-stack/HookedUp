import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "../../../../_lib/supabaseAdmin";
import { requireAdminUser } from "../../../../_lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAdminUser(request);
    const { searchParams } = new URL(request.url);
    const novelId = searchParams.get("novelId")?.trim();
    if (!novelId) {
      return NextResponse.json({ error: "NOVEL_ID_REQUIRED" }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("NovelChapter")
      .select("id,title,content,orderIndex,isFree,isPublished,price")
      .eq("novelId", novelId)
      .order("orderIndex", { ascending: true });
    if (error) {
      return NextResponse.json(
        { error: "FAILED_TO_LOAD", details: error.message },
        { status: 500 }
      );
    }
    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status =
      message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
