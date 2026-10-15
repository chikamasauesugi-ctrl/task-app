-- タスク管理アプリ スキーマ（Supabase SQL Editor で実行する）
-- 日時はフロントエンドと同じローカル表記のまま text で保持する（個人利用MVP）

create table if not exists public.tasks (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default '',
  start_at text not null,          -- "YYYY-MM-DDTHH:mm"
  end_at text not null,            -- "YYYY-MM-DDTHH:mm"
  memo text not null default '',
  status text not null default 'not_started',
  location_type text not null default 'none',
  address text not null default '',
  travel_minutes integer not null default 0,
  repeat text not null default 'none',
  repeat_until text,               -- "YYYY-MM-DD"（この日を含まない）
  excluded_dates jsonb,            -- ["YYYY-MM-DD", ...]
  occurrence_status jsonb,         -- {"YYYY-MM-DD": "done", ...}
  deleted_at bigint,               -- ゴミ箱入りの epoch ms。null なら通常表示
  created_at bigint not null
);

create index if not exists tasks_user_id_idx on public.tasks (user_id);

-- Row Level Security：本人の行だけ読み書きできる
alter table public.tasks enable row level security;

drop policy if exists "own tasks select" on public.tasks;
create policy "own tasks select" on public.tasks
  for select using (user_id = auth.uid());

drop policy if exists "own tasks insert" on public.tasks;
create policy "own tasks insert" on public.tasks
  for insert with check (user_id = auth.uid());

drop policy if exists "own tasks update" on public.tasks;
create policy "own tasks update" on public.tasks
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own tasks delete" on public.tasks;
create policy "own tasks delete" on public.tasks
  for delete using (user_id = auth.uid());
