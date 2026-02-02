"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { getSupabaseClient } from "../../lib/supabaseClient";
import { useSupabaseSession } from "../../lib/useSupabaseSession";

export default function ShareLinkPage() {
  const params = useParams();
  const router = useRouter();
  const tokenParam =
    typeof params.token === "string" ? params.token : params.token?.[0];

  const { user, ready } = useSupabaseSession();
  const [status, setStatus] = useState("Resolving share link...");

  useEffect(() => {
    if (!tokenParam) {
      setStatus("Invalid share link.");
      return;
    }
    if (!ready) {
      return;
    }
    if (!user) {
      const redirect = encodeURIComponent(`/r/${tokenParam}`);
      router.replace(`/login?redirect=${redirect}`);
      return;
    }

    const resolve = async () => {
      try {
        const supabase = getSupabaseClient();
        if (!supabase) {
          throw new Error("Supabase is not configured.");
        }
        const { data, error } = await supabase
          .from("RoomShareLink")
          .select("roomId,expiresAt,revokedAt")
          .eq("token", tokenParam)
          .maybeSingle();
        if (error || !data?.roomId) {
          throw new Error("ROOM_NOT_FOUND");
        }
        if (data.revokedAt) {
          throw new Error("This link has been revoked.");
        }
        if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
          throw new Error("This link has expired.");
        }

        const { error: joinError } = await supabase
          .from("RoomMembership")
          .upsert(
            {
              roomId: data.roomId,
              userId: user.id,
              role: "MEMBER",
              mode: "PARTICIPANT"
            },
            { onConflict: "roomId,userId" }
          );
        if (joinError) {
          throw new Error("Failed to join room.");
        }

        window.dispatchEvent(new Event("active-room-changed"));
        router.replace(`/rooms/${data.roomId}`);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to resolve share link.";
        setStatus(message);
      }
    };

    resolve();
  }, [ready, user, router, tokenParam]);

  return (
    <main className="ui-page flex min-h-screen items-center justify-center px-4 py-8">
      <p className="text-sm text-text-secondary">{status}</p>
    </main>
  );
}
