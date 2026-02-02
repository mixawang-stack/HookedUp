import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../_lib/supabaseAdmin";
import { requireAdminUser } from "../../_lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAdminUser(request);
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("Novel")
      .select(
        `
        id,
        title,
        coverImageUrl,
        description,
        tagsJson,
        status,
        category,
        isFeatured,
        chapterCount,
        createdAt,
        chapters:NovelChapter(count)
      `
      )
      .order("createdAt", { ascending: false });

    if (error) {
      return NextResponse.json({ error: "FAILED_TO_LOAD" }, { status: 500 });
    }

    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status =
      message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
