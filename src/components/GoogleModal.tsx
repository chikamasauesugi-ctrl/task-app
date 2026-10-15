"use client";

import { useState } from "react";
import type { GoogleCalendarInfo } from "../lib/googleCalendar";
import type { GoogleStatus } from "../lib/useGoogleCalendar";

interface Props {
  status: GoogleStatus;
  error: string;
  savedClientId: string;
  calendars: GoogleCalendarInfo[];
  selectedIds: string[];
  onConnect: (clientId: string) => void;
  onDisconnect: () => void;
  onChangeSelected: (ids: string[]) => void;
  onReload: () => void;
  onClose: () => void;
}

/** Google カレンダー連携の設定モーダル */
export default function GoogleModal({
  status,
  error,
  savedClientId,
  calendars,
  selectedIds,
  onConnect,
  onDisconnect,
  onChangeSelected,
  onReload,
  onClose,
}: Props) {
  const [clientId, setClientId] = useState(savedClientId);

  const toggle = (id: string) => {
    onChangeSelected(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id]
    );
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Googleカレンダー連携"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90dvh] w-full flex-col overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-2xl dark:bg-zinc-900"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Googleカレンダー連携</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="grid h-8 w-8 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>

        {status !== "connected" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Googleカレンダーの予定を読み込んで、同じタイムラインに表示します（読み取り専用。アプリからGoogleへの書き込みはしません）。
            </p>
            <ol className="list-decimal space-y-1 pl-5 text-xs text-zinc-500 dark:text-zinc-400">
              <li>
                Google Cloud Console で OAuth クライアントID（ウェブアプリ）を作成
              </li>
              <li>
                「承認済みの JavaScript 生成元」に{" "}
                <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
                  http://localhost:3000
                </code>{" "}
                を追加
              </li>
              <li>クライアントIDを下に貼り付けて「接続」</li>
            </ol>
            <input
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="OAuth クライアントID（xxxx.apps.googleusercontent.com）"
              aria-label="OAuthクライアントID"
              className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-zinc-700"
            />
            {status === "expired" && (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                接続の有効期限が切れています。「接続」で再接続してください。
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm font-medium text-red-600">
                {error}
              </p>
            )}
            <button
              type="button"
              disabled={!clientId.trim() || status === "connecting"}
              onClick={() => onConnect(clientId.trim())}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {status === "connecting" ? "接続中…" : "Googleに接続"}
            </button>
          </div>
        )}

        {status === "connected" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              接続済み。読み込むカレンダーを選んでください。
            </p>
            <ul className="flex flex-col gap-1">
              {calendars.map((c) => (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(c.id)}
                      onChange={() => toggle(c.id)}
                    />
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ background: c.backgroundColor ?? "#9ca3af" }}
                    />
                    <span className="min-w-0 truncate">
                      {c.summary}
                      {c.primary ? "（メイン）" : ""}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={onDisconnect}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                連携を解除
              </button>
              <button
                type="button"
                onClick={onReload}
                className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-bold text-white hover:bg-blue-700"
              >
                再読み込み
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
