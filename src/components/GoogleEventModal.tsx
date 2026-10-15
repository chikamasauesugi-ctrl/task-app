"use client";

import type { Task } from "../lib/types";
import { timeOf } from "../lib/time";

interface Props {
  event: Task;
  onClose: () => void;
}

/** Google由来の予定の詳細（読み取り専用。編集はGoogleカレンダー側で行う） */
export default function GoogleEventModal({ event, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Google予定の詳細"
        onClick={(e) => e.stopPropagation()}
        className="w-full rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-2xl dark:bg-zinc-900"
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <h2 className="min-w-0 text-lg font-bold">
            <span className="mr-2 rounded-full bg-purple-600 px-2 py-0.5 align-middle text-[10px] font-bold text-white dark:bg-purple-500">
              Google
            </span>
            {event.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>
        <p className="text-sm tabular-nums text-zinc-600 dark:text-zinc-300">
          {timeOf(event.startAt)}–{timeOf(event.endAt)}
        </p>
        {event.address && (
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            📍 {event.address}
          </p>
        )}
        {event.memo && (
          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-zinc-500 dark:text-zinc-400">
            {event.memo}
          </p>
        )}
        <p className="mt-4 text-xs text-zinc-400 dark:text-zinc-500">
          この予定の編集は Google カレンダー側で行ってください。
        </p>
        {event.htmlLink && (
          <a
            href={event.htmlLink}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
          >
            Googleカレンダーで開く
          </a>
        )}
      </div>
    </div>
  );
}
