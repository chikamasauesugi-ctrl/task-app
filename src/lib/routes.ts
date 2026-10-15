"use client";

import { supabase } from "./supabaseClient";
import type { TravelMode } from "./types";

function localTzOffset(): string {
  const off = -new Date().getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const abs = Math.abs(off);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

const ERROR_MESSAGES: Record<string, string> = {
  server_not_configured:
    "経路APIキーが未設定です（.env.local / Vercel に GOOGLE_MAPS_API_KEY を設定）",
  api_key_rejected:
    "経路APIキーが拒否されました（Routes API の有効化とキーの制限を確認）",
  not_found: "経路が見つかりませんでした。住所を確認してください",
  unauthorized: "ログインが必要です",
  bad_request: "出発地と到着地を入力してください",
};

/** 2地点間の移動時間（分）をサーバー経由で計算する */
export async function fetchTravelMinutes(args: {
  origin: string;
  destination: string;
  mode: TravelMode;
  /** 到着希望のローカル日時 "YYYY-MM-DDTHH:mm" */
  arrivalAt: string;
}): Promise<number> {
  let jwt = "";
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    jwt = data.session?.access_token ?? "";
  }
  const res = await fetch("/api/route", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
    body: JSON.stringify({ ...args, tzOffset: localTzOffset() }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(
      ERROR_MESSAGES[body.error ?? ""] ?? `経路計算エラー（${res.status}）`
    );
  }
  const data = (await res.json()) as { minutes: number };
  return data.minutes;
}
