"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteTaskEvent,
  fetchAccessToken,
  fetchCalendarList,
  fetchEventsForDay,
  insertTaskEvent,
  loadGoogleSettings,
  patchTaskEvent,
  saveGoogleSettings,
  taskEventSignature,
  type GoogleCalendarInfo,
  type GoogleEvent,
  type GoogleSettings,
} from "./googleCalendar";
import { supabase } from "./supabaseClient";
import type { Task } from "./types";

export type GoogleStatus =
  | "disconnected" // Supabase未設定・未ログインなど（機能を使えない）
  | "connecting"
  | "connected"
  | "needs_reauth" // カレンダー許可が未保存・失効 → 再ログインが必要
  | "error";

export function useGoogleCalendar() {
  const [settings, setSettings] = useState<GoogleSettings | null>(() =>
    typeof window === "undefined" ? null : loadGoogleSettings()
  );
  const [status, setStatus] = useState<GoogleStatus>(() =>
    supabase ? "connecting" : "disconnected"
  );
  const [calendars, setCalendars] = useState<GoogleCalendarInfo[]>([]);
  const [eventsByDay, setEventsByDay] = useState<
    Record<string, GoogleEvent[]>
  >({});
  const tokenRef = useRef<{ accessToken: string; expiresAt: number } | null>(
    null
  );
  const loadingDaysRef = useRef<Set<string>>(new Set());
  const syncingRef = useRef(false);

  /** 有効なアクセストークンを返す（期限が近ければサーバーで再発行） */
  const ensureToken = useCallback(async (): Promise<string | null> => {
    if (!supabase) return null;
    const cur = tokenRef.current;
    if (cur && cur.expiresAt > Date.now() + 60_000) return cur.accessToken;
    const { data } = await supabase.auth.getSession();
    const jwt = data.session?.access_token;
    if (!jwt) {
      setStatus("disconnected");
      return null;
    }
    try {
      const token = await fetchAccessToken(jwt);
      if (!token) {
        setStatus("needs_reauth");
        return null;
      }
      tokenRef.current = token;
      setStatus("connected");
      return token.accessToken;
    } catch (e) {
      console.error("Googleトークン取得エラー:", e);
      setStatus("error");
      return null;
    }
  }, []);

  // 起動時に接続を確立してカレンダー一覧を取得
  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      const token = await ensureToken();
      if (!token || cancelled) return;
      try {
        const cals = await fetchCalendarList(token);
        if (cancelled) return;
        setCalendars(cals);
        // 初回はメインカレンダーを既定で選択
        setSettings((prev) => {
          if (prev && prev.selectedCalendarIds.length > 0) return prev;
          const next: GoogleSettings = {
            selectedCalendarIds: cals
              .filter((c) => c.primary)
              .map((c) => c.id),
          };
          saveGoogleSettings(next);
          return next;
        });
      } catch (e) {
        if (!cancelled) {
          console.error("カレンダー一覧の取得エラー:", e);
          if (e instanceof Error && e.message === "unauthorized") {
            tokenRef.current = null;
            setStatus("needs_reauth");
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ensureToken]);

  const setSelectedCalendars = useCallback((ids: string[]) => {
    const next: GoogleSettings = { selectedCalendarIds: ids };
    setSettings(next);
    saveGoogleSettings(next);
    setEventsByDay({}); // 選択が変わったので読み直す
  }, []);

  /** 連携を解除する（保存済みリフレッシュトークンを削除） */
  const disconnect = useCallback(async () => {
    tokenRef.current = null;
    setEventsByDay({});
    if (supabase) {
      await supabase.from("google_tokens").delete().neq("refresh_token", "");
    }
    setStatus("needs_reauth");
  }, []);

  /** 指定日の予定を読み込む（キャッシュ済みなら何もしない。force で再取得） */
  const loadDay = useCallback(
    async (dateKey: string, force = false) => {
      if (!settings || settings.selectedCalendarIds.length === 0) return;
      if (!force && eventsByDay[dateKey]) return;
      if (loadingDaysRef.current.has(dateKey)) return;
      const token = await ensureToken();
      if (!token) return;
      loadingDaysRef.current.add(dateKey);
      try {
        const lists = await Promise.all(
          settings.selectedCalendarIds.map((id) =>
            fetchEventsForDay(token, id, dateKey)
          )
        );
        const merged = lists
          .flat()
          .sort((a, b) => ((a.startAt ?? "") < (b.startAt ?? "") ? -1 : 1));
        setEventsByDay((prev) => ({ ...prev, [dateKey]: merged }));
      } catch (e) {
        if (e instanceof Error && e.message === "unauthorized") {
          tokenRef.current = null;
          setStatus("needs_reauth");
        } else {
          // 取得失敗した日は空としてキャッシュし、無限リトライを防ぐ
          console.error("Googleカレンダー取得エラー:", e);
          setEventsByDay((prev) => ({
            ...prev,
            [dateKey]: prev[dateKey] ?? [],
          }));
        }
      } finally {
        loadingDaysRef.current.delete(dateKey);
      }
    },
    [settings, eventsByDay, ensureToken]
  );

  const eventsForDay = useCallback(
    (dateKey: string): GoogleEvent[] => eventsByDay[dateKey] ?? [],
    [eventsByDay]
  );

  /**
   * アプリのタスクを Google カレンダーへ自動反映する。
   * 新規 → 予定を作成（patchTask で googleEventId を保存）、
   * 変更 → 予定を更新、ゴミ箱入り・完全削除 → 予定を削除。
   */
  const syncTasks = useCallback(
    async (
      next: Task[],
      prev: Task[],
      patchTask: (id: string, patch: { googleEventId: string | null }) => void
    ) => {
      if (syncingRef.current) return;
      const token = await ensureToken();
      if (!token) return;
      syncingRef.current = true;
      try {
        const prevMap = new Map(prev.map((t) => [t.id, t]));
        for (const t of next) {
          if (!t.deletedAt && !t.googleEventId) {
            const eventId = await insertTaskEvent(token, t);
            patchTask(t.id, { googleEventId: eventId });
          } else if (t.deletedAt && t.googleEventId) {
            await deleteTaskEvent(token, t.googleEventId);
            patchTask(t.id, { googleEventId: null });
          } else if (!t.deletedAt && t.googleEventId) {
            const p = prevMap.get(t.id);
            if (p && taskEventSignature(p) !== taskEventSignature(t)) {
              await patchTaskEvent(token, t.googleEventId, t);
            }
          }
        }
        // 完全削除されたタスク（30日経過の自動削除など）の予定も消す
        const nextIds = new Set(next.map((t) => t.id));
        for (const p of prev) {
          if (p.googleEventId && !nextIds.has(p.id)) {
            await deleteTaskEvent(token, p.googleEventId);
          }
        }
      } catch (e) {
        if (e instanceof Error && e.message === "unauthorized") {
          tokenRef.current = null;
          setStatus("needs_reauth");
        } else {
          console.error("Googleカレンダー書き込みエラー:", e);
        }
      } finally {
        syncingRef.current = false;
      }
    },
    [ensureToken]
  );

  return {
    settings,
    status,
    calendars,
    disconnect,
    setSelectedCalendars,
    loadDay,
    eventsForDay,
    syncTasks,
  };
}
