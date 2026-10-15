"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  TRASH_RETENTION_DAYS,
  type EditScope,
  type RepeatFreq,
  type LocationType,
  type Task,
  type TaskInput,
  type TaskStatus,
} from "./types";
import { dateKeyOf, timeOf } from "./time";
import { makeOccurrence, occursOn } from "./recurrence";
import { supabase } from "./supabaseClient";

// 永続化はこのフックに閉じ込める。
// remote=true（Supabaseログイン済み）なら DB、そうでなければ localStorage。
const STORAGE_KEY = "task-app.tasks.v1";

const DAY_MS = 24 * 60 * 60 * 1000;

function newId(): string {
  return `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** 旧形式のデータも読めるよう既定値を補う */
function normalize(t: Partial<Task>): Task | null {
  if (!t.startAt || !t.endAt) return null;
  return {
    id: t.id ?? newId(),
    title: t.title ?? "",
    startAt: t.startAt,
    endAt: t.endAt,
    memo: t.memo ?? "",
    status: t.status ?? "not_started",
    locationType: t.locationType ?? "none",
    address: t.address ?? "",
    travelMinutes: t.travelMinutes ?? 0,
    createdAt: t.createdAt ?? Date.now(),
    repeat: t.repeat ?? "none",
    repeatUntil: t.repeatUntil,
    excludedDates: t.excludedDates,
    occurrenceStatus: t.occurrenceStatus,
    deletedAt: t.deletedAt ?? null,
  };
}

function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const purgeBefore = Date.now() - TRASH_RETENTION_DAYS * DAY_MS;
    return (parsed as Partial<Task>[])
      .map(normalize)
      .filter((t): t is Task => t !== null)
      // 削除から30日経過したものは完全削除
      .filter((t) => !(t.deletedAt && t.deletedAt < purgeBefore));
  } catch {
    return [];
  }
}

// ---- Supabase の行との相互変換（snake_case ↔ camelCase） ----

interface TaskRow {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  memo: string;
  status: TaskStatus;
  location_type: LocationType;
  address: string;
  travel_minutes: number;
  repeat: RepeatFreq;
  repeat_until: string | null;
  excluded_dates: string[] | null;
  occurrence_status: Record<string, TaskStatus> | null;
  deleted_at: number | null;
  created_at: number;
}

function fromRow(r: TaskRow): Task {
  return {
    id: r.id,
    title: r.title,
    startAt: r.start_at,
    endAt: r.end_at,
    memo: r.memo,
    status: r.status,
    locationType: r.location_type,
    address: r.address,
    travelMinutes: r.travel_minutes,
    repeat: r.repeat,
    repeatUntil: r.repeat_until ?? undefined,
    excludedDates: r.excluded_dates ?? undefined,
    occurrenceStatus: r.occurrence_status ?? undefined,
    deletedAt: r.deleted_at,
    createdAt: r.created_at,
  };
}

function toRow(t: Task): TaskRow {
  return {
    id: t.id,
    title: t.title,
    start_at: t.startAt,
    end_at: t.endAt,
    memo: t.memo,
    status: t.status,
    location_type: t.locationType,
    address: t.address,
    travel_minutes: t.travelMinutes,
    repeat: t.repeat,
    repeat_until: t.repeatUntil ?? null,
    excluded_dates: t.excludedDates ?? null,
    occurrence_status: t.occurrenceStatus ?? null,
    deleted_at: t.deletedAt ?? null,
    created_at: t.createdAt,
  };
}

export function useTasks(remote = false) {
  // SSR中は空、ローカルモードでは初期レンダー時に localStorage から読み込む
  const [tasks, setTasks] = useState<Task[]>(() =>
    typeof window === "undefined" || remote ? [] : loadTasks()
  );
  // リモートの初回読み込みが終わるまで保存処理を止める
  const [ready, setReady] = useState(!remote);
  const prevRef = useRef<Task[] | null>(remote ? null : []);

  // リモート：ログイン直後に本人のタスクを読み込む（30日超のゴミはDBからも削除）
  useEffect(() => {
    if (!remote || !supabase) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from("tasks").select("*");
      if (cancelled) return;
      if (!error && data) {
        const purgeBefore = Date.now() - TRASH_RETENTION_DAYS * DAY_MS;
        const all = (data as TaskRow[]).map(fromRow);
        const expired = all.filter(
          (t) => t.deletedAt && t.deletedAt < purgeBefore
        );
        let keep = all.filter(
          (t) => !(t.deletedAt && t.deletedAt < purgeBefore)
        );
        if (expired.length > 0) {
          void supabase
            .from("tasks")
            .delete()
            .in(
              "id",
              expired.map((t) => t.id)
            );
        }
        // 初回ログイン時：DBが空でローカル保存があれば、そのまま引き継ぐ
        if (all.length === 0) {
          const local = loadTasks();
          if (local.length > 0) {
            keep = local;
            void supabase
              .from("tasks")
              .upsert(local.map(toRow))
              .then(({ error: e }) => {
                if (e) console.error("ローカルタスクの移行エラー:", e.message);
              });
          }
        }
        prevRef.current = keep;
        setTasks(keep);
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [remote]);

  // 永続化：リモートは前回との差分を upsert / delete、ローカルは localStorage
  useEffect(() => {
    if (!ready) return;
    if (remote && supabase) {
      const prev = prevRef.current;
      prevRef.current = tasks;
      if (!prev) return;
      const prevMap = new Map(prev.map((t) => [t.id, t]));
      const nextIds = new Set(tasks.map((t) => t.id));
      const upserts = tasks.filter((t) => {
        const p = prevMap.get(t.id);
        return !p || JSON.stringify(p) !== JSON.stringify(t);
      });
      const deletes = prev
        .filter((t) => !nextIds.has(t.id))
        .map((t) => t.id);
      if (upserts.length > 0) {
        void supabase
          .from("tasks")
          .upsert(upserts.map(toRow))
          .then(({ error }) => {
            if (error) console.error("Supabase 保存エラー:", error.message);
          });
      }
      if (deletes.length > 0) {
        void supabase
          .from("tasks")
          .delete()
          .in("id", deletes)
          .then(({ error }) => {
            if (error) console.error("Supabase 削除エラー:", error.message);
          });
      }
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch {
      // 保存失敗（容量超過など）は黙って無視
    }
  }, [tasks, remote, ready]);

  const addTask = useCallback((input: TaskInput) => {
    const task: Task = {
      ...input,
      id: newId(),
      createdAt: Date.now(),
      deletedAt: null,
    };
    setTasks((prev) => [...prev, task]);
  }, []);

  const updateTask = useCallback((id: string, patch: Partial<TaskInput>) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch } : t))
    );
  }, []);

  /** 繰り返しタスクの特定の回のステータスだけ変更する */
  const setOccurrenceStatus = useCallback(
    (id: string, dateKey: string, status: TaskStatus) => {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                occurrenceStatus: { ...t.occurrenceStatus, [dateKey]: status },
              }
            : t
        )
      );
    },
    []
  );

  /** 繰り返しタスクの編集（範囲つき） */
  const editOccurrence = useCallback(
    (id: string, dateKey: string, values: TaskInput, scope: EditScope) => {
      setTasks((prev) => {
        const master = prev.find((t) => t.id === id);
        if (!master) return prev;
        const seriesStart = dateKeyOf(master.startAt);
        // 初回に対する「以降すべて」は「すべて」と同じ
        const eff =
          scope === "following" && dateKey <= seriesStart ? "all" : scope;

        if (eff === "this") {
          // この回を除外して、入力値の単発タスクを作る
          const standalone: Task = {
            ...values,
            repeat: "none",
            id: newId(),
            createdAt: Date.now(),
            deletedAt: null,
          };
          return prev
            .map((t) =>
              t.id === id
                ? {
                    ...t,
                    excludedDates: [...(t.excludedDates ?? []), dateKey],
                  }
                : t
            )
            .concat(standalone);
        }

        if (eff === "following") {
          // この日の手前で元の繰り返しを打ち切り、この日からの新しい繰り返しを作る
          const successor: Task = {
            ...values,
            id: newId(),
            createdAt: Date.now(),
            deletedAt: null,
          };
          return prev
            .map((t) => (t.id === id ? { ...t, repeatUntil: dateKey } : t))
            .concat(successor);
        }

        // all: 開始日は元のまま、内容と時刻を全体に反映
        return prev.map((t) => {
          if (t.id !== id) return t;
          const d = dateKeyOf(t.startAt);
          return {
            ...t,
            title: values.title,
            memo: values.memo,
            status: values.status,
            repeat: values.repeat,
            locationType: values.locationType,
            address: values.address,
            travelMinutes: values.travelMinutes,
            startAt: `${d}T${timeOf(values.startAt)}`,
            endAt: `${d}T${timeOf(values.endAt)}`,
          };
        });
      });
    },
    []
  );

  /** 削除（単発タスク、または繰り返しタスクの範囲つき削除）。ゴミ箱へ移す */
  const deleteOccurrence = useCallback(
    (id: string, dateKey: string | null, scope: EditScope) => {
      setTasks((prev) => {
        const master = prev.find((t) => t.id === id);
        if (!master) return prev;

        if (master.repeat === "none" || dateKey === null || scope === "all") {
          return prev.map((t) =>
            t.id === id ? { ...t, deletedAt: Date.now() } : t
          );
        }

        const seriesStart = dateKeyOf(master.startAt);
        const eff =
          scope === "following" && dateKey <= seriesStart ? "all" : scope;
        if (eff === "all") {
          return prev.map((t) =>
            t.id === id ? { ...t, deletedAt: Date.now() } : t
          );
        }

        if (eff === "following") {
          // 残り区間を別タスクに切り出してゴミ箱へ（復元できるように）
          const remainder: Task = {
            ...master,
            id: newId(),
            createdAt: Date.now(),
            startAt: `${dateKey}T${timeOf(master.startAt)}`,
            endAt: `${dateKey}T${timeOf(master.endAt)}`,
            excludedDates: master.excludedDates?.filter((d) => d >= dateKey),
            occurrenceStatus: undefined,
            repeatUntil: master.repeatUntil,
            deletedAt: Date.now(),
          };
          return prev
            .map((t) => (t.id === id ? { ...t, repeatUntil: dateKey } : t))
            .concat(remainder);
        }

        // this: その回だけ除外し、復元できるよう単発タスクとしてゴミ箱へ
        const occ = makeOccurrence(master, dateKey);
        const standalone: Task = {
          ...occ,
          id: newId(),
          createdAt: Date.now(),
          repeat: "none",
          repeatUntil: undefined,
          excludedDates: undefined,
          occurrenceStatus: undefined,
          occurrenceDate: undefined,
          deletedAt: Date.now(),
        };
        return prev
          .map((t) =>
            t.id === id
              ? { ...t, excludedDates: [...(t.excludedDates ?? []), dateKey] }
              : t
          )
          .concat(standalone);
      });
    },
    []
  );

  /** ゴミ箱から復元する */
  const restoreTask = useCallback((id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, deletedAt: null } : t))
    );
  }, []);

  /** 指定日に表示するタスク（繰り返しは仮想展開） */
  const tasksForDay = useCallback(
    (dateKey: string): Task[] => {
      const result: Task[] = [];
      for (const t of tasks) {
        if (t.deletedAt) continue;
        if (t.repeat === "none") {
          if (dateKeyOf(t.startAt) === dateKey) result.push(t);
        } else if (occursOn(t, dateKey)) {
          result.push(makeOccurrence(t, dateKey));
        }
      }
      return result;
    },
    [tasks]
  );

  /** ゴミ箱の中身（削除日時の新しい順） */
  const trashedTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.deletedAt)
        .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0)),
    [tasks]
  );

  return {
    tasks,
    ready,
    addTask,
    updateTask,
    setOccurrenceStatus,
    editOccurrence,
    deleteOccurrence,
    restoreTask,
    tasksForDay,
    trashedTasks,
  };
}
