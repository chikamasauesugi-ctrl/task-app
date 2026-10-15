"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteTaskEvent,
  fetchCalendarList,
  fetchEventsForDay,
  insertTaskEvent,
  loadGoogleSettings,
  patchTaskEvent,
  requestAccessToken,
  saveGoogleSettings,
  taskEventSignature,
  type GoogleCalendarInfo,
  type GoogleEvent,
  type GoogleSettings,
} from "./googleCalendar";
import type { Task } from "./types";

export type GoogleStatus =
  | "disconnected" // 未設定
  | "connecting"
  | "connected"
  | "expired" // 再接続が必要（トークン失効など）
  | "error";

export function useGoogleCalendar() {
  const [settings, setSettings] = useState<GoogleSettings | null>(() =>
    typeof window === "undefined" ? null : loadGoogleSettings()
  );
  const [status, setStatus] = useState<GoogleStatus>(() =>
    typeof window !== "undefined" && loadGoogleSettings()
      ? "connecting"
      : "disconnected"
  );
  const [error, setError] = useState("");
  const [calendars, setCalendars] = useState<GoogleCalendarInfo[]>([]);
  const [eventsByDay, setEventsByDay] = useState<
    Record<string, GoogleEvent[]>
  >({});
  const tokenRef = useRef<string | null>(null);
  const loadingDaysRef = useRef<Set<string>>(new Set());

  // 設定済みなら起動時にサイレント再接続を試みる（同意画面は出さない）
  useEffect(() => {
    if (!settings || tokenRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await requestAccessToken(settings.clientId, true);
        if (cancelled) return;
        tokenRef.current = token;
        const cals = await fetchCalendarList(token);
        if (cancelled) return;
        setCalendars(cals);
        setStatus("connected");
      } catch {
        if (!cancelled) setStatus("expired");
      }
    })();
    return () => {
      cancelled = true;
    };
    // 初回マウント時のみでよい（settings 変更時は connect 側で処理）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 同意画面を出して接続する（初回、または再接続） */
  const connect = useCallback(
    async (clientId: string) => {
      setStatus("connecting");
      setError("");
      try {
        const token = await requestAccessToken(clientId, false);
        tokenRef.current = token;
        const cals = await fetchCalendarList(token);
        setCalendars(cals);
        const selected =
          settings && settings.clientId === clientId
            ? settings.selectedCalendarIds
            : cals.filter((c) => c.primary).map((c) => c.id);
        const next: GoogleSettings = {
          clientId,
          selectedCalendarIds: selected,
        };
        setSettings(next);
        saveGoogleSettings(next);
        setEventsByDay({});
        setStatus("connected");
      } catch (e) {
        setStatus("error");
        setError(e instanceof Error ? e.message : "接続に失敗しました");
      }
    },
    [settings]
  );

  const disconnect = useCallback(() => {
    tokenRef.current = null;
    setSettings(null);
    saveGoogleSettings(null);
    setCalendars([]);
    setEventsByDay({});
    setStatus("disconnected");
    setError("");
  }, []);

  const setSelectedCalendars = useCallback(
    (ids: string[]) => {
      if (!settings) return;
      const next: GoogleSettings = { ...settings, selectedCalendarIds: ids };
      setSettings(next);
      saveGoogleSettings(next);
      setEventsByDay({}); // 選択が変わったので読み直す
    },
    [settings]
  );

  /** 指定日の予定を読み込む（キャッシュ済みなら何もしない。force で再取得） */
  const loadDay = useCallback(
    async (dateKey: string, force = false) => {
      const token = tokenRef.current;
      if (!token || !settings || settings.selectedCalendarIds.length === 0)
        return;
      if (!force && eventsByDay[dateKey]) return;
      if (loadingDaysRef.current.has(dateKey)) return;
      loadingDaysRef.current.add(dateKey);
      try {
        const lists = await Promise.all(
          settings.selectedCalendarIds.map((id) =>
            fetchEventsForDay(token, id, dateKey)
          )
        );
        const merged = lists
          .flat()
          .sort((a, b) => (a.startAt ?? "") < (b.startAt ?? "") ? -1 : 1);
        setEventsByDay((prev) => ({ ...prev, [dateKey]: merged }));
      } catch (e) {
        if (e instanceof Error && e.message === "unauthorized") {
          tokenRef.current = null;
          setStatus("expired");
        } else {
          // 取得失敗した日は空としてキャッシュし、無限リトライを防ぐ
          console.error("Googleカレンダー取得エラー:", e);
          setEventsByDay((prev) => ({ ...prev, [dateKey]: prev[dateKey] ?? [] }));
        }
      } finally {
        loadingDaysRef.current.delete(dateKey);
      }
    },
    [settings, eventsByDay]
  );

  const eventsForDay = useCallback(
    (dateKey: string): GoogleEvent[] => eventsByDay[dateKey] ?? [],
    [eventsByDay]
  );

  const syncingRef = useRef(false);

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
      const token = tokenRef.current;
      if (!token || syncingRef.current) return;
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
          // 書き込み権限がない古いトークンなど → 再接続を促す
          tokenRef.current = null;
          setStatus("expired");
        } else {
          console.error("Googleカレンダー書き込みエラー:", e);
        }
      } finally {
        syncingRef.current = false;
      }
    },
    []
  );

  return {
    settings,
    status,
    error,
    calendars,
    connect,
    disconnect,
    setSelectedCalendars,
    loadDay,
    eventsForDay,
    syncTasks,
  };
}
