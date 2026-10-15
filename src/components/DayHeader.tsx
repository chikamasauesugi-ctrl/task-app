"use client";

import { formatDateHeading } from "../lib/time";

interface Props {
  dateKey: string;
  todayKey: string;
  trashCount: number;
  /** Google連携の状態インジケーター（green=接続中, amber=要再接続, none=未設定） */
  googleIndicator: "green" | "amber" | "none";
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onOpenTrash: () => void;
  onOpenGoogle: () => void;
  /** ログイン中のメールアドレス（Supabase未設定時は null） */
  userEmail?: string | null;
  onSignOut?: (() => void) | null;
}

export default function DayHeader({
  dateKey,
  todayKey,
  trashCount,
  googleIndicator,
  onPrev,
  onNext,
  onToday,
  onOpenTrash,
  onOpenGoogle,
  userEmail,
  onSignOut,
}: Props) {
  const isToday = dateKey === todayKey;
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold tracking-wide">
            {formatDateHeading(dateKey)}
            {isToday && (
              <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                今日
              </span>
            )}
          </h1>
        </div>
        <nav className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onPrev}
            aria-label="前日へ"
            className="grid h-9 w-9 place-items-center rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            ◀
          </button>
          <button
            type="button"
            onClick={onToday}
            disabled={isToday}
            className="h-9 rounded-lg border border-zinc-200 px-3 text-sm font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            今日
          </button>
          <button
            type="button"
            onClick={onNext}
            aria-label="翌日へ"
            className="grid h-9 w-9 place-items-center rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            ▶
          </button>
          <button
            type="button"
            onClick={onOpenGoogle}
            aria-label="Googleカレンダー連携"
            className="relative ml-1 grid h-9 w-9 place-items-center rounded-lg border border-zinc-200 text-sm font-bold text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            G
            {googleIndicator !== "none" && (
              <span
                className={`absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full ${
                  googleIndicator === "green" ? "bg-emerald-500" : "bg-amber-500"
                }`}
              />
            )}
          </button>
          <button
            type="button"
            onClick={onOpenTrash}
            aria-label={`ゴミ箱（${trashCount}件）`}
            className="relative ml-1 grid h-9 w-9 place-items-center rounded-lg border border-zinc-200 text-base hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            🗑
            {trashCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {trashCount}
              </span>
            )}
          </button>
          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              title={userEmail ?? undefined}
              className="ml-1 h-9 rounded-lg border border-zinc-200 px-2.5 text-xs text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              ログアウト
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
