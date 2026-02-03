import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../_lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("Trace")
      .select(
        `
        id,
        content,
        createdAt,
        novelId,
        imageUrl,
        imageWidth,
        imageHeight,
        author:User(id,maskName,maskAvatarUrl,role,gender,dob)
      `
      )
      .order("createdAt", { ascending: false })
      .limit(60);
    if (error) {
      return NextResponse.json({ error: "FAILED_TO_LOAD" }, { status: 500 });
    }
    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "SUPABASE_ADMIN_NOT_CONFIGURED" ? 500 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
