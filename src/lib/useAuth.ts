"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

/**
 * Supabase 認証。
 * enabled=false（.env 未設定）のときはログイン不要の localStorage モードで動く。
 */
export function useAuth() {
  const enabled = supabase !== null;
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      // ログイン直後だけ渡されるリフレッシュトークンを保存（常時カレンダー連携用）
      const refreshToken = s?.provider_refresh_token;
      if (refreshToken && s?.user && supabase) {
        void supabase
          .from("google_tokens")
          .upsert({
            user_id: s.user.id,
            refresh_token: refreshToken,
            updated_at: Date.now(),
          })
          .then(({ error }) => {
            if (error)
              console.error("Google連携トークンの保存エラー:", error.message);
          });
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        // ログイン時にカレンダー権限もまとめて取得し、
        // オフライン用リフレッシュトークンをもらう（常時連携）
        scopes:
          "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events",
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  return { enabled, session, loading, signInWithGoogle, signOut };
}
