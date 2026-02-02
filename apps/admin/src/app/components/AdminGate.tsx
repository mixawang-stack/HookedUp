"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "../lib/supabaseClient";

const ADMIN_EMAIL = "admin@hookedup.me";

export default function AdminGate() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        setReady(true);
        return;
      }
      const { data } = await supabase.auth.getUser();
      const email = data.user?.email ?? null;
      if (!email || email !== ADMIN_EMAIL) {
        await supabase.auth.signOut();
        router.replace("/login");
        return;
      }
      setReady(true);
    };
    checkAdmin().catch(() => {
      setReady(true);
    });
  }, [router]);

  if (!ready) {
    return null;
  }

  return null;
}
