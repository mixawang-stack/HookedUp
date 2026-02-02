import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { getSupabaseAdmin } from "../../../_lib/supabaseAdmin";
import { requireAdminUser } from "../../../_lib/auth";

export const runtime = "nodejs";

type Payload = {
  novelId?: string;
  status?: "DRAFT" | "PUBLISHED";
};

export async function POST(request: Request) {
  try {
    const admin = await requireAdminUser(request);
    const payload = (await request.json()) as Payload;
    const novelId = payload?.novelId?.trim();
    const status = payload?.status;
    if (!novelId || (status !== "DRAFT" && status !== "PUBLISHED")) {
      return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: novel, error: novelError } = await supabase
      .from("Novel")
      .select("id,title,description")
      .eq("id", novelId)
      .maybeSingle();
    if (novelError || !novel) {
      return NextResponse.json({ error: "NOVEL_NOT_FOUND" }, { status: 404 });
    }

    const { data: room } = await supabase
      .from("Room")
      .select("id,status")
      .eq("novelId", novelId)
      .maybeSingle();

    const now = new Date().toISOString();
    if (status === "PUBLISHED") {
      const { error: updateError } = await supabase
        .from("Novel")
        .update({ status: "PUBLISHED", updatedAt: now })
        .eq("id", novelId);
      if (updateError) {
        return NextResponse.json({ error: "NOVEL_UPDATE_FAILED" }, { status: 500 });
      }

      if (room?.id) {
        const { error: roomUpdateError } = await supabase
          .from("Room")
          .update({
            title: `${novel.title} Discussion Room`,
            description: novel.description ?? null,
            status: "LIVE",
            endsAt: null
          })
          .eq("id", room.id);
        if (roomUpdateError) {
          return NextResponse.json({ error: "ROOM_UPDATE_FAILED" }, { status: 500 });
        }
      } else {
        const { error: roomInsertError } = await supabase.from("Room").insert({
          id: randomUUID(),
          title: `${novel.title} Discussion Room`,
          description: novel.description ?? null,
          status: "LIVE",
          isOfficial: true,
          allowSpectators: true,
          capacity: null,
          createdById: admin.id,
          novelId
        });
        if (roomInsertError) {
          return NextResponse.json({ error: "ROOM_CREATE_FAILED" }, { status: 500 });
        }
      }
    } else {
      const { error: updateError } = await supabase
        .from("Novel")
        .update({ status: "DRAFT", updatedAt: now })
        .eq("id", novelId);
      if (updateError) {
        return NextResponse.json({ error: "NOVEL_UPDATE_FAILED" }, { status: 500 });
      }

      if (room?.id) {
        const { error: roomUpdateError } = await supabase
          .from("Room")
          .update({ status: "ENDED", endsAt: now })
          .eq("id", room.id);
        if (roomUpdateError) {
          return NextResponse.json({ error: "ROOM_UPDATE_FAILED" }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status =
      message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
