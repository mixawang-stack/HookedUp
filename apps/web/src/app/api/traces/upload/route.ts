import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../_lib/supabaseAdmin";
import { requireUser } from "../../_lib/auth";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const STORAGE_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "uploads";

const toSafeFileName = (name: string) => {
  const extMatch = name.match(/\.([^.]+)$/);
  const ext = extMatch ? `.${extMatch[1]}` : "";
  const base = name.replace(/\.[^.]+$/, "");
  const safeBase = base.replace(/[^\w.-]+/g, "_").replace(/_+/g, "_");
  const safeExt = ext.replace(/[^\w.]+/g, "");
  return `${safeBase || "file"}${safeExt}`;
};

export async function POST(request: Request) {
  try {
    await requireUser(request);
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "FILE_REQUIRED" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "INVALID_FILE_TYPE" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "FILE_TOO_LARGE" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const path = `traces/${Date.now()}-${randomUUID()}-${toSafeFileName(
      file.name
    )}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, buffer, { contentType: file.type, upsert: true });
    if (error) {
      return NextResponse.json({ error: "UPLOAD_FAILED" }, { status: 500 });
    }

    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return NextResponse.json({
      imageUrl: data.publicUrl,
      width: null,
      height: null
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
