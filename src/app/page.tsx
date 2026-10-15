"use client";

import { useEffect, useRef, useState } from "react";
import DayHeader from "../components/DayHeader";
import GoogleEventModal from "../components/GoogleEventModal";
import GoogleModal from "../components/GoogleModal";
import ScopeDialog from "../components/ScopeDialog";
import TaskFormModal from "../components/TaskFormModal";
import Timeline from "../components/Timeline";
import TrashModal from "../components/TrashModal";
import LoginScreen from "../components/LoginScreen";
import { findTravelConflict } from "../lib/conflicts";
import type { GoogleEvent } from "../lib/googleCalendar";
import { addDays, dateKeyOf } from "../lib/time";
import type { EditScope, Task, TaskInput, TaskStatus } from "../lib/types";
import { useAuth } from "../lib/useAuth";
import { useGoogleCalendar } from "../lib/useGoogleCalendar";
import { useNow } from "../lib/useNow";
import { useTasks } from "../lib/useTasks";

/** Google予定をタイムライン表示用の読み取り専用タスクに変換する */
function toGoogleTask(e: GoogleEvent): Task {
  return {
    id: `g:${e.calendarId}:${e.id}`,
    title: e.summary,
    startAt: e.startAt ?? "",
    endAt: e.endAt ?? "",
    memo: e.description,
    status: "not_started",
    locationType: e.location ? "place" : "none",
    address: e.location,
    travelMinutes: 0,
    travelMode: "driving",
    repeat: "none",
    createdAt: 0,
    source: "google",
    htmlLink: e.htmlLink,
  };
}

/** 繰り返しタスクの操作で、適用範囲の選択待ちになっている操作 */
type Pending =
  | { mode: "save"; task: Task; values: TaskInput }
  | { mode: "delete"; task: Task };

export default function Home() {
  const auth = useAuth();

  if (auth.enabled && auth.loading) {
    return (
      <main className="grid min-h-dvh place-items-center text-zinc-400">
        読み込み中…
      </main>
    );
  }
  if (auth.enabled && !auth.session) {
    return <LoginScreen onSignIn={() => void auth.signInWithGoogle()} />;
  }
  return (
    <HomeInner
      key={auth.session?.user.id ?? "local"}
      remote={auth.enabled}
      userEmail={auth.session?.user.email ?? null}
      onSignOut={auth.enabled ? () => void auth.signOut() : null}
      onReauth={() => void auth.signInWithGoogle()}
    />
  );
}

function HomeInner({
  remote,
  userEmail,
  onSignOut,
  onReauth,
}: {
  remote: boolean;
  userEmail: string | null;
  onSignOut: (() => void) | null;
  onReauth: () => void;
}) {
  const {
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
  } = useTasks(remote);
  const now = useNow();
  const google = useGoogleCalendar();

  // null のあいだは「今日」を表示（ユーザーが日付移動すると値が入る）
  const [navDateKey, setNavDateKey] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const [googleOpen, setGoogleOpen] = useState(false);
  const [googleEvent, setGoogleEvent] = useState<Task | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);

  // 表示中の日の Google 予定を読み込む（キャッシュ済みなら何もしない）
  const { status: googleStatus, loadDay, syncTasks } = google;
  const viewDateKey = navDateKey ?? (now ? now.slice(0, 10) : null);
  useEffect(() => {
    if (googleStatus === "connected" && viewDateKey) {
      void loadDay(viewDateKey);
    }
  }, [googleStatus, viewDateKey, loadDay]);

  // タスクの変更を Google カレンダーへ自動反映（接続中のみ）
  const prevSyncedRef = useRef<Task[] | null>(null);
  useEffect(() => {
    if (!ready) return;
    if (googleStatus !== "connected") {
      prevSyncedRef.current = tasks;
      return;
    }
    const prev = prevSyncedRef.current ?? [];
    prevSyncedRef.current = tasks;
    void syncTasks(tasks, prev, (id, patch) => updateTask(id, patch));
  }, [tasks, ready, googleStatus, syncTasks, updateTask]);

  if (!now || !ready) {
    return (
      <main className="grid min-h-dvh place-items-center text-zinc-400">
        読み込み中…
      </main>
    );
  }

  const todayKey = now.slice(0, 10);
  const dateKey = navDateKey ?? todayKey;
  const googleEvents = google.eventsForDay(dateKey);
  const googleDayTasks = googleEvents
    .filter((e) => e.startAt && e.endAt)
    .map(toGoogleTask);
  const allDayEvents = googleEvents.filter((e) => e.allDayDate);
  const dayTasks = [...tasksForDay(dateKey), ...googleDayTasks];

  const isRecurringOccurrence = (task: Task) =>
    task.repeat !== "none" && !!task.occurrenceDate;

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (task: Task) => {
    if (task.source === "google") {
      // Google由来の予定は詳細表示のみ（編集はGoogle側）
      setGoogleEvent(task);
      return;
    }
    setEditing(task);
    setFormOpen(true);
  };

  const handleSubmit = (values: TaskInput) => {
    if (!editing) {
      addTask(values);
    } else if (isRecurringOccurrence(editing)) {
      // 繰り返しタスクは適用範囲を選んでから反映する
      setPending({ mode: "save", task: editing, values });
    } else {
      updateTask(editing.id, values);
    }
  };

  const handleDelete = (task: Task) => {
    if (isRecurringOccurrence(task)) {
      setPending({ mode: "delete", task });
    } else {
      deleteOccurrence(task.id, null, "all");
    }
  };

  const handleScopeSelect = (scope: EditScope) => {
    if (!pending) return;
    const date = pending.task.occurrenceDate!;
    if (pending.mode === "save") {
      editOccurrence(pending.task.id, date, pending.values, scope);
    } else {
      deleteOccurrence(pending.task.id, date, scope);
    }
    setPending(null);
  };

  // 移動中の時間帯には予定を入れられない
  const validateTravel = (values: TaskInput): string | null => {
    const day = dateKeyOf(values.startAt);
    const dayAll = [
      ...tasksForDay(day),
      ...google
        .eventsForDay(day)
        .filter((e) => e.startAt && e.endAt)
        .map(toGoogleTask),
    ];
    const conflict = findTravelConflict(dayAll, values, editing?.id);
    if (!conflict) return null;
    const name = conflict.task.title.trim() || "無題のタスク";
    return conflict.kind === "their-travel"
      ? `「${name}」への移動中の時間帯には予定を入れられません`
      : `この予定への移動時間が「${name}」の時間帯と重なっています`;
  };

  // 移動の起点：同じ日の、開始時刻より前に終わる場所つき予定のうち最も遅いもの
  const suggestOrigin = (dk: string, startTime: string): string | null => {
    const limit = `${dk}T${startTime}`;
    const candidates = [
      ...tasksForDay(dk),
      ...google
        .eventsForDay(dk)
        .filter((e) => e.startAt && e.endAt)
        .map(toGoogleTask),
    ]
      .filter(
        (t) =>
          t.address &&
          t.endAt <= limit &&
          t.id !== editing?.id
      )
      .sort((a, b) => (a.endAt < b.endAt ? 1 : -1));
    return candidates[0]?.address ?? null;
  };

  const handleStatusChange = (task: Task, status: TaskStatus) => {
    if (isRecurringOccurrence(task)) {
      // 繰り返しの各回のステータスはその回だけに適用する
      setOccurrenceStatus(task.id, task.occurrenceDate!, status);
    } else {
      updateTask(task.id, { status });
    }
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <DayHeader
        dateKey={dateKey}
        todayKey={todayKey}
        trashCount={trashedTasks.length}
        googleIndicator={
          google.status === "connected"
            ? "green"
            : google.status === "needs_reauth" || google.status === "error"
              ? "amber"
              : "none"
        }
        onPrev={() => setNavDateKey(addDays(dateKey, -1))}
        onNext={() => setNavDateKey(addDays(dateKey, 1))}
        onToday={() => setNavDateKey(null)}
        onOpenTrash={() => setTrashOpen(true)}
        onOpenGoogle={() => setGoogleOpen(true)}
        userEmail={userEmail}
        onSignOut={onSignOut}
      />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        {allDayEvents.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {allDayEvents.map((e) => (
              <span
                key={`${e.calendarId}:${e.id}`}
                className="rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-800 dark:bg-purple-900/50 dark:text-purple-200"
              >
                終日 {e.summary}
              </span>
            ))}
          </div>
        )}
        <Timeline
          tasks={dayTasks}
          dateKey={dateKey}
          now={now}
          onEdit={openEdit}
          onStatusChange={handleStatusChange}
        />
      </main>

      {/* タスク登録のフローティングボタン */}
      <button
        type="button"
        onClick={openCreate}
        aria-label="タスクを登録"
        className="fixed bottom-6 right-6 z-30 grid h-14 w-14 place-items-center rounded-full bg-blue-600 text-3xl font-light text-white shadow-lg transition hover:bg-blue-700 active:scale-95"
      >
        ＋
      </button>

      {formOpen && (
        <TaskFormModal
          key={editing ? `${editing.id}@${editing.occurrenceDate ?? ""}` : "new"}
          editing={editing}
          defaultDateKey={dateKey}
          onClose={() => setFormOpen(false)}
          onSubmit={handleSubmit}
          onDelete={handleDelete}
          validate={validateTravel}
          suggestOrigin={suggestOrigin}
        />
      )}

      {pending && (
        <ScopeDialog
          mode={pending.mode}
          taskTitle={pending.task.title}
          onSelect={handleScopeSelect}
          onCancel={() => setPending(null)}
        />
      )}

      {trashOpen && (
        <TrashModal
          tasks={trashedTasks}
          now={now}
          onRestore={restoreTask}
          onClose={() => setTrashOpen(false)}
        />
      )}

      {googleOpen && (
        <GoogleModal
          status={google.status}
          calendars={google.calendars}
          selectedIds={google.settings?.selectedCalendarIds ?? []}
          onReauth={onReauth}
          onDisconnect={() => void google.disconnect()}
          onChangeSelected={google.setSelectedCalendars}
          onReload={() => void google.loadDay(dateKey, true)}
          onClose={() => setGoogleOpen(false)}
        />
      )}

      {googleEvent && (
        <GoogleEventModal
          event={googleEvent}
          onClose={() => setGoogleEvent(null)}
        />
      )}
    </div>
  );
}
