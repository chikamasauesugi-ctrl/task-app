"use client";

import type { GoogleCalendarInfo } from "../lib/googleCalendar";
import type { GoogleStatus } from "../lib/useGoogleCalendar";

interface Props {
  status: GoogleStatus;
  calendars: GoogleCalendarInfo[];
  selectedIds: string[];
  onChangeSelected: (ids: string[]) => void;
  onReload: () => void;
  /** カレンダー許可つきの再ログインを開始する */
  onReauth: () => void;
  onDisconnect: () => void;
  onClose: () => void;
}

/** Google カレンダー連携の設定モーダル（ログインと連動した常時接続） */
export default function GoogleModal({
  status,
  calendars,
  selectedIds,
  onChangeSelected,
  onReload,
  onReauth,
  onDisconnect,
  onClose,
}: Props) {
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

        {status === "connecting" && (
          <p className="py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
            接続しています…
          </p>
        )}

        {(status === "needs_reauth" ||
          status === "error" ||
          status === "disconnected") && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              カレンダー連携には、Googleログイン時のカレンダー許可が必要です。
              下のボタンからログインし直して、カレンダーの項目に
              <b>チェックを入れて</b>許可してください。
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              一度許可すれば、以後は自動で連携が維持されます。
              アプリで作成したタスクは Google カレンダーにも自動で作成されます。
            </p>
            <button
              type="button"
              onClick={onReauth}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
            >
              Googleでログインして連携を有効にする
            </button>
          </div>
        )}

        {status === "connected" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              連携中（自動で維持されます）。読み込むカレンダーを選んでください。
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
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              アプリで作成したタスクはメインカレンダーに自動で書き込まれます。
            </p>
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
