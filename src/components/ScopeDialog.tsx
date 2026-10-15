"use client";

import { SCOPE_LABELS, type EditScope } from "../lib/types";

const SCOPES: EditScope[] = ["this", "following", "all"];

interface Props {
  /** "save"（編集の反映）か "delete"（削除） */
  mode: "save" | "delete";
  taskTitle: string;
  onSelect: (scope: EditScope) => void;
  onCancel: () => void;
}

/** 繰り返しタスクの編集・削除時に適用範囲を毎回選択するダイアログ */
export default function ScopeDialog({
  mode,
  taskTitle,
  onSelect,
  onCancel,
}: Props) {
  const title = taskTitle.trim() || "無題のタスク";
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onCancel}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="適用範囲の選択"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-900"
      >
        <h2 className="mb-1 text-lg font-bold">
          繰り返し予定の{mode === "delete" ? "削除" : "変更"}
        </h2>
        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          「{title}」は繰り返し予定です。
          {mode === "delete" ? "削除" : "変更"}する範囲を選んでください。
        </p>
        <div className="flex flex-col gap-2">
          {SCOPES.map((scope) => (
            <button
              key={scope}
              type="button"
              onClick={() => onSelect(scope)}
              className={`rounded-lg border px-4 py-2.5 text-left text-sm font-medium transition ${
                mode === "delete"
                  ? "border-zinc-300 hover:border-red-400 hover:bg-red-50 dark:border-zinc-700 dark:hover:bg-red-950/40"
                  : "border-zinc-300 hover:border-blue-400 hover:bg-blue-50 dark:border-zinc-700 dark:hover:bg-blue-950/40"
              }`}
            >
              {SCOPE_LABELS[scope]}
            </button>
          ))}
          <button
            type="button"
            onClick={onCancel}
            className="mt-1 rounded-lg px-4 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
