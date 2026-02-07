import { createClient } from "@supabase/supabase-js";
import WordExtractor from "word-extractor";
import mammoth from "mammoth";
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { Readable } from "stream";

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
  const tempPath = path.join(os.tmpdir(), `hookedup-doc-${crypto.randomUUID()}.doc`);
  await fs.writeFile(tempPath, buffer);
  try {
    const doc = await extractor.extract(tempPath);
    return doc.getBody();
  } finally {
    await fs.unlink(tempPath).catch(() => undefined);
  }
};

const parseDocxFile = async (arrayBuffer: ArrayBuffer) => {
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value ?? "";
};

const readNodeStream = async (stream: Readable) => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
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
  const readableLike = data as { getReader?: () => unknown };
  if (typeof readableLike.getReader === "function") {
    return await new Response(data as BodyInit).arrayBuffer();
  }
  if (data instanceof Readable) {
    const buffer = await readNodeStream(data);
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  }
  throw new Error("UNSUPPORTED_FILE_STREAM");
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
