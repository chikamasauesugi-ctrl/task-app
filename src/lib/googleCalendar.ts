// Google カレンダー連携。
// アクセストークンはログイン時に保存したリフレッシュトークンから
// サーバー（/api/google/token）が発行する。読み込みと、タスクの自動書き込みを行う。

import { addDays, timeOf, toEpochMs } from "./time";
import type { Task } from "./types";

const SETTINGS_KEY = "task-app.google.v1";
const API = "https://www.googleapis.com/calendar/v3";

export interface GoogleSettings {
  /** 読み込むカレンダーID（複数選択可） */
  selectedCalendarIds: string[];
}

export interface GoogleCalendarInfo {
  id: string;
  summary: string;
  primary?: boolean;
  backgroundColor?: string;
}

export interface GoogleEvent {
  id: string;
  calendarId: string;
  summary: string;
  /** "YYYY-MM-DDTHH:mm"（ローカル）。終日予定は null */
  startAt: string | null;
  endAt: string | null;
  /** 終日予定の日付 "YYYY-MM-DD" */
  allDayDate: string | null;
  location: string;
  description: string;
  htmlLink: string;
}

export function loadGoogleSettings(): GoogleSettings | null {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<GoogleSettings>;
    return { selectedCalendarIds: s.selectedCalendarIds ?? [] };
  } catch {
    return null;
  }
}

export function saveGoogleSettings(settings: GoogleSettings | null): void {
  try {
    if (settings) localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    else localStorage.removeItem(SETTINGS_KEY);
  } catch {
    // 保存失敗は無視
  }
}

/**
 * サーバー経由でアクセストークンを取得する。
 * 戻り値 null は「カレンダー連携が未設定（再ログインが必要）」を意味する。
 * それ以外の失敗は例外を投げる。
 */
export async function fetchAccessToken(
  supabaseJwt: string
): Promise<{ accessToken: string; expiresAt: number } | null> {
  const res = await fetch("/api/google/token", {
    method: "POST",
    headers: { Authorization: `Bearer ${supabaseJwt}` },
  });
  if (res.status === 404 || res.status === 410) return null;
  if (!res.ok) throw new Error(`トークン取得エラー（${res.status}）`);
  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

// ---- Calendar API ----

async function apiGet<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error(`Google API エラー（${res.status}）`);
  return (res.json() as Promise<T>);
}

interface CalendarListResponse {
  items?: {
    id: string;
    summary: string;
    primary?: boolean;
    backgroundColor?: string;
  }[];
}

export async function fetchCalendarList(
  token: string
): Promise<GoogleCalendarInfo[]> {
  const data = await apiGet<CalendarListResponse>(
    token,
    "/users/me/calendarList?minAccessRole=reader"
  );
  return (data.items ?? []).map((c) => ({
    id: c.id,
    summary: c.summary,
    primary: c.primary,
    backgroundColor: c.backgroundColor,
  }));
}

interface EventsResponse {
  items?: {
    id: string;
    status?: string;
    summary?: string;
    location?: string;
    description?: string;
    htmlLink?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
    extendedProperties?: { private?: Record<string, string> };
  }[];
}

/** RFC3339 → ローカル "YYYY-MM-DDTHH:mm" */
function toLocalMinute(dateTime: string): string {
  const d = new Date(dateTime);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/** ローカルのタイムゾーンオフセット（例 "+09:00"） */
function localTzOffset(): string {
  const off = -new Date().getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const abs = Math.abs(off);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** 指定日のイベントを1カレンダーぶん取得する */
export async function fetchEventsForDay(
  token: string,
  calendarId: string,
  dateKey: string
): Promise<GoogleEvent[]> {
  // timeMin/timeMax は RFC3339（タイムゾーンオフセット必須）
  const tzOffset = localTzOffset();
  const timeMin = encodeURIComponent(`${dateKey}T00:00:00${tzOffset}`);
  const next = new Date(dateKey);
  next.setDate(next.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  const nextKey = `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(
    next.getDate()
  )}`;
  const timeMax = encodeURIComponent(`${nextKey}T00:00:00${tzOffset}`);
  const data = await apiGet<EventsResponse>(
    token,
    `/calendars/${encodeURIComponent(
      calendarId
    )}/events?singleEvents=true&orderBy=startTime&timeMin=${timeMin}&timeMax=${timeMax}&maxResults=100`
  );
  return (data.items ?? [])
    .filter((e) => e.status !== "cancelled")
    // このアプリが書き込んだ予定は除外（タスクと二重表示になるため）
    .filter((e) => !e.extendedProperties?.private?.taskApp)
    .map((e) => ({
      id: e.id,
      calendarId,
      summary: e.summary ?? "（タイトルなし）",
      startAt: e.start?.dateTime ? toLocalMinute(e.start.dateTime) : null,
      endAt: e.end?.dateTime ? toLocalMinute(e.end.dateTime) : null,
      allDayDate: e.start?.date ?? null,
      location: e.location ?? "",
      description: e.description ?? "",
      htmlLink: e.htmlLink ?? "",
    }));
}

// ---- アプリのタスク → Google カレンダーへの自動書き込み ----

async function apiSend<T>(
  token: string,
  method: "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown
): Promise<T | null> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  // 既に削除済みの予定への削除・更新は成功扱い
  if (method !== "POST" && (res.status === 404 || res.status === 410))
    return null;
  if (res.status === 401 || res.status === 403)
    throw new Error("unauthorized");
  if (!res.ok) throw new Error(`Google API エラー（${res.status}）`);
  if (res.status === 204) return null;
  return (res.json() as Promise<T>);
}

/** RRULE/EXDATE（繰り返し設定）を組み立てる */
function recurrenceOf(task: Task): string[] | undefined {
  if (task.repeat === "none") return undefined;
  const freq = { daily: "DAILY", weekly: "WEEKLY", monthly: "MONTHLY" }[
    task.repeat
  ];
  let rule = `RRULE:FREQ=${freq}`;
  if (task.repeatUntil) {
    // repeatUntil は「この日を含まない」。前日の23:59（ローカル）をUTCに直してUNTILへ
    const lastLocal = `${addDays(task.repeatUntil, -1)}T23:59`;
    const until = new Date(toEpochMs(lastLocal))
      .toISOString()
      .replace(/[-:]/g, "")
      .slice(0, 15);
    rule += `;UNTIL=${until}Z`;
  }
  const lines = [rule];
  if (task.excludedDates && task.excludedDates.length > 0) {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const time = timeOf(task.startAt).replace(":", "") + "00";
    lines.push(
      `EXDATE;TZID=${tz}:` +
        task.excludedDates
          .map((d) => d.replace(/-/g, "") + "T" + time)
          .join(",")
    );
  }
  return lines;
}

function eventBodyOf(task: Task): Record<string, unknown> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return {
    summary: task.title.trim() || "無題のタスク",
    description: task.memo,
    location: task.address,
    start: { dateTime: `${task.startAt}:00`, timeZone: tz },
    end: { dateTime: `${task.endAt}:00`, timeZone: tz },
    recurrence: recurrenceOf(task),
    // ループ防止の目印（読み込み時にこの予定を除外する）
    extendedProperties: { private: { taskApp: "1", taskId: task.id } },
  };
}

/** 予定の内容に関わる部分のシグネチャ（変更検知用） */
export function taskEventSignature(task: Task): string {
  return JSON.stringify([
    task.title,
    task.startAt,
    task.endAt,
    task.memo,
    task.address,
    task.repeat,
    task.repeatUntil ?? null,
    task.excludedDates ?? [],
  ]);
}

/** タスクをメインカレンダーに予定として作成し、予定IDを返す */
export async function insertTaskEvent(
  token: string,
  task: Task
): Promise<string> {
  const created = await apiSend<{ id: string }>(
    token,
    "POST",
    "/calendars/primary/events",
    eventBodyOf(task)
  );
  if (!created) throw new Error("予定の作成に失敗しました");
  return created.id;
}

/** タスクに対応する予定を更新する */
export async function patchTaskEvent(
  token: string,
  eventId: string,
  task: Task
): Promise<void> {
  await apiSend(
    token,
    "PATCH",
    `/calendars/primary/events/${encodeURIComponent(eventId)}`,
    eventBodyOf(task)
  );
}

/** タスクに対応する予定を削除する */
export async function deleteTaskEvent(
  token: string,
  eventId: string
): Promise<void> {
  await apiSend(
    token,
    "DELETE",
    `/calendars/primary/events/${encodeURIComponent(eventId)}`
  );
}
