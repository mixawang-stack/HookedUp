import { useEffect, useState } from "react";
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

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setReady(true);
      return;
    }

    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session ?? null);
        setUser(data.session?.user ?? null);
        setReady(true);
      })
      .catch(() => {
        setSession(null);
        setUser(null);
        setReady(true);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        setReady(true);
      }
    );

    return () => {
      subscription?.subscription.unsubscribe();
    };
  }, []);

  return { session, user, ready };
};
