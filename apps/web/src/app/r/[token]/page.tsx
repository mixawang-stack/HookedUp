"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

export default function ShareLinkPage() {
  const params = useParams();
  const router = useRouter();
  const tokenParam =
    typeof params.token === "string" ? params.token : params.token?.[0];

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [status, setStatus] = useState("Resolving share link...");

  const authHeader = useMemo(() => {
    if (!accessToken) {
      return null;
    }
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  useEffect(() => {
    setAccessToken(localStorage.getItem("accessToken"));
  }, []);

  useEffect(() => {
    if (!tokenParam) {
      setStatus("Invalid share link.");
      return;
    }
    if (!accessToken) {
      const redirect = encodeURIComponent(`/r/${tokenParam}`);
      router.replace(`/login?redirect=${redirect}`);
      return;
    }

    const resolve = async () => {
      try {
        const res = await fetch(`${API_BASE}/r/${tokenParam}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.message ?? `HTTP ${res.status}`);
        }
        const data = (await res.json()) as { roomId?: string };
        if (!data?.roomId) {
          throw new Error("ROOM_NOT_FOUND");
        }

        const joinRes = await fetch(`${API_BASE}/rooms/${data.roomId}/join`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeader
          },
          body: JSON.stringify({})
        });
        if (!joinRes.ok) {
          const body = await joinRes.json().catch(() => ({}));
          throw new Error(body?.message ?? `HTTP ${joinRes.status}`);
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
  }, [accessToken, authHeader, router, tokenParam]);

  return (
    <main className="ui-page flex min-h-screen items-center justify-center px-4 py-8">
      <p className="text-sm text-text-secondary">{status}</p>
    </main>
  );
}
