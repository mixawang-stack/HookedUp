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
      return NextResponse.json(
        {
          error: "NOVEL_NOT_FOUND",
          details: { novelId, message: novelError?.message ?? null }
        },
        { status: 404 }
      );
    }

    const payloadBase = {
      title: `${novel.title} Discussion Room`,
      description: novel.description ?? null,
      status: "LIVE" as const,
      isOfficial: true,
      allowSpectators: true,
      capacity: 50,
      createdById: admin.id
    };

    const fetchRoomsByNovel = async () => {
      const result = await supabase
        .from("Room")
        .select("id,status,createdAt,isOfficial,title")
        .eq("novelId", novelId)
        .order("createdAt", { ascending: false });
      if (
        result.error &&
        result.error.message?.includes("novelId") &&
        result.error.message?.includes("schema cache")
      ) {
        return { data: [] as Array<{ id: string; status: string | null }>, error: null };
      }
      return result;
    };

    const fetchRoomsByTitle = async () => {
      return await supabase
        .from("Room")
        .select("id,status,createdAt,isOfficial,title")
        .eq("isOfficial", true)
        .eq("title", payloadBase.title)
        .order("createdAt", { ascending: false });
    };

    const safeUpdateRoom = async (roomId: string, update: Record<string, unknown>) => {
      let updateError = (
        await supabase.from("Room").update(update).eq("id", roomId)
      ).error;
      if (
        updateError &&
        updateError.message?.includes("novelId") &&
        updateError.message?.includes("schema cache")
      ) {
        const { novelId: _omit, ...rest } = update as { novelId?: string };
        updateError = (await supabase.from("Room").update(rest).eq("id", roomId)).error;
      }
      return updateError;
    };

    const safeInsertRoom = async (payload: Record<string, unknown>) => {
      let roomInsertError = (await supabase.from("Room").insert(payload)).error;
      if (
        roomInsertError &&
        roomInsertError.message?.includes("novelId") &&
        roomInsertError.message?.includes("schema cache")
      ) {
        const { novelId: _omit, ...rest } = payload as { novelId?: string };
        roomInsertError = (await supabase.from("Room").insert(rest)).error;
      }
      return roomInsertError;
    };

    const { data: roomsByNovel } = await fetchRoomsByNovel();
    let rooms = roomsByNovel ?? [];
    if (rooms.length === 0) {
      const { data: roomsByTitle } = await fetchRoomsByTitle();
      rooms = roomsByTitle ?? [];
    }

    const now = new Date().toISOString();
    if (status === "PUBLISHED") {
      const { error: updateError } = await supabase
        .from("Novel")
        .update({ status: "PUBLISHED", updatedAt: now })
        .eq("id", novelId);
      if (updateError) {
        return NextResponse.json({ error: "NOVEL_UPDATE_FAILED" }, { status: 500 });
      }

      if (rooms.length > 0) {
        const primary = rooms[0];
        const roomUpdateError = await safeUpdateRoom(primary.id, {
          title: payloadBase.title,
          description: payloadBase.description,
          status: payloadBase.status,
          endsAt: null,
          novelId
        });
        if (roomUpdateError) {
          return NextResponse.json({ error: "ROOM_UPDATE_FAILED" }, { status: 500 });
        }
        if (rooms.length > 1) {
          const extraIds = rooms.slice(1).map((room) => room.id);
          await supabase
            .from("Room")
            .update({ status: "ENDED", endsAt: now })
            .in("id", extraIds);
        }
      } else {
        const roomInsertError = await safeInsertRoom({
          id: randomUUID(),
          ...payloadBase,
          novelId
        });
        if (roomInsertError) {
          return NextResponse.json(
            {
              error: "ROOM_CREATE_FAILED",
              details: roomInsertError.message
            },
            { status: 500 }
          );
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

      if (rooms.length > 0) {
        const { error: roomUpdateError } = await supabase
          .from("Room")
          .update({ status: "ENDED", endsAt: now })
          .in(
            "id",
            rooms.map((room) => room.id)
          );
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
