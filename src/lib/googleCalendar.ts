// Google カレンダー読み込み（一方向・閲覧のみ）
// ブラウザ上で Google Identity Services のアクセストークンを取得し、
// Calendar API を直接呼び出す。アプリから Google への書き戻しはしない。

const SETTINGS_KEY = "task-app.google.v1";
const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const API = "https://www.googleapis.com/calendar/v3";

export interface GoogleSettings {
  clientId: string;
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
    if (!s.clientId) return null;
    return {
      clientId: s.clientId,
      selectedCalendarIds: s.selectedCalendarIds ?? [],
    };
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

// ---- Google Identity Services ----

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}

interface TokenClient {
  requestAccessToken: (opts: { prompt: string }) => void;
}

interface GoogleGlobal {
  accounts: {
    oauth2: {
      initTokenClient: (opts: {
        client_id: string;
        scope: string;
        callback: (res: TokenResponse) => void;
        error_callback?: (err: { type?: string; message?: string }) => void;
      }) => TokenClient;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleGlobal;
  }
}

let gisLoading: Promise<void> | null = null;

/** GIS スクリプトを一度だけ読み込む */
export function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoading) return gisLoading;
  gisLoading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      gisLoading = null;
      reject(new Error("Google のスクリプトを読み込めませんでした"));
    };
    document.head.appendChild(s);
  });
  return gisLoading;
}

/**
 * アクセストークンを取得する。
 * silent=true なら同意画面を出さず、既に許可済みの場合だけ成功する。
 */
export async function requestAccessToken(
  clientId: string,
  silent: boolean
): Promise<string> {
  await loadGis();
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (res) => {
        if (res.access_token) resolve(res.access_token);
        else reject(new Error(res.error ?? "トークンを取得できませんでした"));
      },
      error_callback: (err) =>
        reject(new Error(err.message ?? err.type ?? "認証に失敗しました")),
    });
    client.requestAccessToken({ prompt: silent ? "none" : "consent" });
  });
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
