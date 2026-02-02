import { NextResponse } from "next/server";
import WordExtractor from "word-extractor";
import { getSupabaseAdmin } from "../../_lib/supabaseAdmin";
import { requireAdminUser } from "../../_lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await requireAdminUser(request);
    const body = await request.json().catch(() => ({}));
    const bucket = String(body?.bucket ?? "");
    const path = String(body?.path ?? "");

    if (!bucket || !path) {
      return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error || !data) {
      return NextResponse.json({ error: "DOWNLOAD_FAILED" }, { status: 500 });
    }

    const arrayBuffer = await data.arrayBuffer();
    const extractor = new WordExtractor();
    const document = await extractor.extract(Buffer.from(arrayBuffer));
    const text = document.getBody() ?? "";

    return NextResponse.json({ text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
