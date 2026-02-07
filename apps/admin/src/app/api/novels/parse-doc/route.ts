import { createClient } from "@supabase/supabase-js";
import WordExtractor from "word-extractor";
import mammoth from "mammoth";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const getAdminClient = () =>
  createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

const getBearerToken = (request: Request) => {
  const header = request.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return "";
  return header.slice("bearer ".length).trim();
};

const parseDocFile = async (buffer: Buffer) => {
  const extractor = new WordExtractor();
  const doc = await extractor.extract(buffer);
  return doc.getBody();
};

const parseDocxFile = async (arrayBuffer: ArrayBuffer) => {
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value ?? "";
};

const readToArrayBuffer = async (data: unknown) => {
  if (!data) {
    throw new Error("EMPTY_FILE");
  }
  if (data instanceof ArrayBuffer) {
    return data;
  }
  if (ArrayBuffer.isView(data)) {
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  }
  const blobLike = data as { arrayBuffer?: () => Promise<ArrayBuffer> };
  if (typeof blobLike.arrayBuffer === "function") {
    return await blobLike.arrayBuffer();
  }
  // Fallback for ReadableStream or Response-like bodies in Node
  try {
    return await new Response(data as BodyInit).arrayBuffer();
  } catch {
    throw new Error("UNSUPPORTED_FILE_STREAM");
  }
};

export async function POST(request: Request) {
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "SUPABASE_ADMIN_NOT_CONFIGURED" },
      { status: 500 }
    );
  }
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  let payload: { bucket?: string; path?: string } = {};
  try {
    payload = (await request.json()) as { bucket?: string; path?: string };
  } catch {
    return NextResponse.json({ error: "INVALID_PAYLOAD" }, { status: 400 });
  }
  const bucket = payload.bucket?.trim() ?? "";
  const path = payload.path?.trim() ?? "";
  if (!bucket || !path) {
    return NextResponse.json({ error: "MISSING_STORAGE_PATH" }, { status: 400 });
  }

  const supabase = getAdminClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(
    token
  );
  if (userError || !userData?.user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .download(path);
  if (error || !data) {
    return NextResponse.json({ error: "DOWNLOAD_FAILED" }, { status: 500 });
  }
  const arrayBuffer = await readToArrayBuffer(data);
  const lowerPath = path.toLowerCase();

  try {
    if (lowerPath.endsWith(".docx")) {
      const text = await parseDocxFile(arrayBuffer);
      return NextResponse.json({ text });
    }
    if (lowerPath.endsWith(".doc")) {
      const text = await parseDocFile(Buffer.from(arrayBuffer));
      return NextResponse.json({ text });
    }
    return NextResponse.json({ error: "UNSUPPORTED_FILE" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "PARSE_FAILED";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
