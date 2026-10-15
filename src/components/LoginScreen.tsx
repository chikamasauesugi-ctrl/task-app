"use client";

interface Props {
  onSignIn: () => void;
}

export default function LoginScreen({ onSignIn }: Props) {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
        <div>
          <h1 className="text-2xl font-bold">タスク管理</h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            日間タイムラインで予定と移動を管理するアプリです。
            Googleアカウントでログインすると、あなたのタスクだけが表示されます。
          </p>
        </div>
        <button
          type="button"
          onClick={onSignIn}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow hover:bg-blue-700"
        >
          Googleでログイン
        </button>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          データは Supabase に保存され、本人だけが閲覧・編集できます。
        </p>
      </div>
    </main>
  );
}
