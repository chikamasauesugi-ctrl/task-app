"use client";

import { useState } from "react";
import {
  LOCATION_LABELS,
  LOCATION_ORDER,
  REPEAT_LABELS,
  REPEAT_ORDER,
  TRAVEL_MODE_LABELS,
  TRAVEL_MODE_ORDER,
  type LocationType,
  type RepeatFreq,
  type Task,
  type TaskInput,
  type TaskStatus,
  type TravelMode,
} from "../lib/types";
import { dateKeyOf, timeOf } from "../lib/time";
import { fetchTravelMinutes } from "../lib/routes";
import StatusSelect from "./StatusSelect";

const ORIGIN_KEY = "task-app.defaultOrigin";

interface Props {
  /** null なら新規作成、Task なら編集。呼び出し側は key で再マウントさせること */
  editing: Task | null;
  defaultDateKey: string;
  onClose: () => void;
  onSubmit: (values: TaskInput) => void;
  onDelete: (task: Task) => void;
  /** 登録前の追加チェック（移動中の重複など）。エラーメッセージを返すと登録を中止する */
  validate?: (values: TaskInput) => string | null;
  /** その日の直前の予定の場所（移動の起点）を返す。無ければ null */
  suggestOrigin?: (dateKey: string, startTime: string) => string | null;
}

export default function TaskFormModal({
  editing,
  defaultDateKey,
  onClose,
  onSubmit,
  onDelete,
  validate,
  suggestOrigin,
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
  const [travelMode, setTravelMode] = useState<TravelMode>(
    editing?.travelMode ?? "driving"
  );
  const [origin, setOrigin] = useState(() => {
    try {
      return localStorage.getItem(ORIGIN_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcError, setCalcError] = useState("");
  const [error, setError] = useState("");

  // 移動の起点：同じ日の直前の予定の場所。無ければ手入力の出発地を使う
  const suggestedOrigin = suggestOrigin ? suggestOrigin(date, start) : null;

  const handleAutoCalc = async () => {
    setCalcError("");
    if (!address.trim()) {
      setCalcError("住所を入力してください");
      return;
    }
    const from = suggestedOrigin ?? origin.trim();
    if (!from) {
      setCalcError("出発地を入力してください");
      return;
    }
    setCalcLoading(true);
    try {
      const minutes = await fetchTravelMinutes({
        origin: from,
        destination: address.trim(),
        mode: travelMode,
        arrivalAt: `${date}T${start}`,
      });
      setTravelMinutes(minutes);
      if (!suggestedOrigin) {
        try {
          localStorage.setItem(ORIGIN_KEY, from);
        } catch {
          // 保存失敗は無視
        }
      }
    } catch (e) {
      setCalcError(e instanceof Error ? e.message : "経路計算に失敗しました");
    } finally {
      setCalcLoading(false);
    }
  };

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
      travelMode,
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
                <div className="mt-1 flex flex-col gap-1">
                  <span className="text-sm text-zinc-600 dark:text-zinc-300">
                    移動手段
                  </span>
                  <div
                    role="radiogroup"
                    aria-label="移動手段"
                    className="flex flex-wrap gap-2"
                  >
                    {TRAVEL_MODE_ORDER.map((m) => {
                      const selected = m === travelMode;
                      return (
                        <button
                          key={m}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setTravelMode(m)}
                          className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                            selected
                              ? "bg-cyan-700 text-white dark:bg-cyan-600"
                              : "border border-zinc-300 text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                          }`}
                        >
                          {TRAVEL_MODE_LABELS[m]}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {suggestedOrigin ? (
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    出発地：{suggestedOrigin}（直前の予定の場所）
                  </p>
                ) : (
                  <input
                    type="text"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    maxLength={300}
                    placeholder="出発地（例：自宅の住所。直前に場所つきの予定がないため）"
                    aria-label="出発地"
                    className="mt-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-zinc-700"
                  />
                )}
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                  <span>移動時間</span>
                  <input
                    type="number"
                    min={0}
                    max={600}
                    step={1}
                    value={travelMinutes}
                    onChange={(e) =>
                      setTravelMinutes(
                        Math.max(0, Math.floor(Number(e.target.value) || 0))
                      )
                    }
                    aria-label="移動時間（分）"
                    className="w-20 rounded-lg border border-zinc-300 bg-transparent px-2 py-1.5 text-right outline-none focus:border-blue-500 dark:border-zinc-700"
                  />
                  <span>分</span>
                  <button
                    type="button"
                    onClick={() => void handleAutoCalc()}
                    disabled={calcLoading}
                    className="rounded-lg border border-cyan-700 px-3 py-1.5 text-sm font-medium text-cyan-700 hover:bg-cyan-50 disabled:opacity-50 dark:border-cyan-600 dark:text-cyan-400 dark:hover:bg-cyan-950/40"
                  >
                    {calcLoading ? "計算中…" : "経路から自動計算"}
                  </button>
                </div>
                {calcError && (
                  <p role="alert" className="mt-1 text-xs font-medium text-red-600">
                    {calcError}
                  </p>
                )}
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
