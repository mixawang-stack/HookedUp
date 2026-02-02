import { useEffect, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { getSupabaseClient } from "./supabaseClient";

type SupabaseSessionState = {
  session: Session | null;
  user: User | null;
  ready: boolean;
};

export const useSupabaseSession = (): SupabaseSessionState => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const refreshingRef = useRef(false);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setReady(true);
      return;
    }

    const syncSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        setSession(data.session ?? null);
        setUser(data.session?.user ?? null);
      } catch {
        setSession(null);
        setUser(null);
      } finally {
        setReady(true);
      }
    };

    const refreshSession = async () => {
      if (refreshingRef.current) return;
      refreshingRef.current = true;
      try {
        const { data } = await supabase.auth.refreshSession();
        setSession(data.session ?? null);
        setUser(data.session?.user ?? null);
      } catch {
        // keep existing state; AuthGate will redirect if needed
      } finally {
        refreshingRef.current = false;
      }
    };

    syncSession();

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        setReady(true);
      }
    );

    const handleFocus = () => {
      if (document.visibilityState && document.visibilityState !== "visible") {
        return;
      }
      refreshSession().catch(() => undefined);
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    const interval = window.setInterval(() => {
      refreshSession().catch(() => undefined);
    }, 10 * 60 * 1000);

    return () => {
      subscription?.subscription.unsubscribe();
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
      window.clearInterval(interval);
    };
  }, []);

  return { session, user, ready };
};
