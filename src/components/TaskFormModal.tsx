"use client";

import { useState } from "react";
import {
  LOCATION_LABELS,
  LOCATION_ORDER,
  REPEAT_LABELS,
  REPEAT_ORDER,
  type LocationType,
  type RepeatFreq,
  type Task,
  type TaskInput,
  type TaskStatus,
} from "../lib/types";
import { dateKeyOf, timeOf } from "../lib/time";
import StatusSelect from "./StatusSelect";

interface Props {
  /** null なら新規作成、Task なら編集。呼び出し側は key で再マウントさせること */
  editing: Task | null;
  defaultDateKey: string;
  onClose: () => void;
  onSubmit: (values: TaskInput) => void;
  onDelete: (task: Task) => void;
  /** 登録前の追加チェック（移動中の重複など）。エラーメッセージを返すと登録を中止する */
  validate?: (values: TaskInput) => string | null;
}

export default function TaskFormModal({
  editing,
  defaultDateKey,
  onClose,
  onSubmit,
  onDelete,
  validate,
}: Props) {
  const [title, setTitle] = useState(editing?.title ?? "");
  const [date, setDate] = useState(
    editing ? dateKeyOf(editing.startAt) : defaultDateKey
  );
  const [start, setStart] = useState(
    editing ? timeOf(editing.startAt) : "09:00"
  );
  const [end, setEnd] = useState(editing ? timeOf(editing.endAt) : "10:00");
  const [memo, setMemo] = useState(editing?.memo ?? "");
  const [status, setStatus] = useState<TaskStatus>(
    editing?.status ?? "not_started"
  );
  const [repeat, setRepeat] = useState<RepeatFreq>(editing?.repeat ?? "none");
  const [locationType, setLocationType] = useState<LocationType>(
    editing?.locationType ?? "none"
  );
  const [address, setAddress] = useState(editing?.address ?? "");
  const [travelMinutes, setTravelMinutes] = useState(
    editing?.travelMinutes ?? 0
  );
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !start || !end) {
      setError("開始時間と終了時間は必須です");
      return;
    }
    if (end <= start) {
      setError("終了時間は開始時間より後にしてください");
      return;
    }
    const values: TaskInput = {
      title: title.trim(),
      startAt: `${date}T${start}`,
      endAt: `${date}T${end}`,
      memo: memo.trim(),
      status,
      repeat,
      locationType,
      address: locationType === "place" ? address.trim() : "",
      travelMinutes: locationType === "place" ? travelMinutes : 0,
    };
    const validationError = validate?.(values);
    if (validationError) {
      setError(validationError);
      return;
    }
    onSubmit(values);
    onClose();
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
        aria-label={editing ? "タスクを編集" : "タスクを登録"}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-2xl dark:bg-zinc-900"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">
            {editing ? "タスクを編集" : "タスクを登録"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="grid h-8 w-8 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
              タスク名
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="例：打ち合わせ"
              className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 outline-none focus:border-blue-500 dark:border-zinc-700"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
              日付 <span className="text-red-500">*</span>
            </span>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 outline-none focus:border-blue-500 dark:border-zinc-700 dark:[color-scheme:dark]"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                開始時間 <span className="text-red-500">*</span>
              </span>
              <input
                type="time"
                required
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 outline-none focus:border-blue-500 dark:border-zinc-700 dark:[color-scheme:dark]"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                終了時間 <span className="text-red-500">*</span>
              </span>
              <input
                type="time"
                required
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 outline-none focus:border-blue-500 dark:border-zinc-700 dark:[color-scheme:dark]"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
              詳細・メモ
            </span>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="メモ（任意）"
              className="resize-y rounded-lg border border-zinc-300 bg-transparent px-3 py-2 outline-none focus:border-blue-500 dark:border-zinc-700"
            />
          </label>

          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
              実施形式
            </span>
            <div
              role="radiogroup"
              aria-label="実施形式"
              className="flex flex-wrap gap-2"
            >
              {LOCATION_ORDER.map((l) => {
                const selected = l === locationType;
                return (
                  <button
                    key={l}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setLocationType(l)}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                      selected
                        ? "bg-teal-600 text-white dark:bg-teal-500"
                        : "border border-zinc-300 text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {LOCATION_LABELS[l]}
                  </button>
                );
              })}
            </div>
            {locationType === "place" && (
              <>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  maxLength={300}
                  placeholder="住所（例：東京都千代田区丸の内1-1-1）"
                  aria-label="住所"
                  className="mt-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 outline-none focus:border-blue-500 dark:border-zinc-700"
                />
                <label className="mt-1 flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                  <span>移動時間</span>
                  <input
                    type="number"
                    min={0}
                    max={600}
                    step={5}
                    value={travelMinutes}
                    onChange={(e) =>
                      setTravelMinutes(
                        Math.max(0, Math.floor(Number(e.target.value) || 0))
                      )
                    }
                    aria-label="移動時間（分）"
                    className="w-20 rounded-lg border border-zinc-300 bg-transparent px-2 py-1.5 text-right outline-none focus:border-blue-500 dark:border-zinc-700"
                  />
                  <span>分（手動入力。経路からの自動計算は今後対応）</span>
                </label>
              </>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
              繰り返し
            </span>
            <div
              role="radiogroup"
              aria-label="繰り返し"
              className="flex flex-wrap gap-2"
            >
              {REPEAT_ORDER.map((r) => {
                const selected = r === repeat;
                return (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setRepeat(r)}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                      selected
                        ? "bg-indigo-600 text-white dark:bg-indigo-500"
                        : "border border-zinc-300 text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {REPEAT_LABELS[r]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
              ステータス
            </span>
            <StatusSelect value={status} onChange={setStatus} />
          </div>

          {error && (
            <p role="alert" className="text-sm font-medium text-red-600">
              {error}
            </p>
          )}

          <div className="mt-2 flex items-center justify-between gap-3">
            {editing ? (
              <button
                type="button"
                onClick={() => {
                  onDelete(editing);
                  onClose();
                }}
                className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/50"
              >
                削除
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700"
              >
                {editing ? "保存" : "登録"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
