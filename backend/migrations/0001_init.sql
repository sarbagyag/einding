create schema if not exists einding;

create extension if not exists pgcrypto;

create table if not exists einding.tasks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  total_seconds bigint not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists einding.sessions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references einding.tasks(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_seconds bigint not null,
  created_at timestamptz not null default now()
);

create index if not exists sessions_task_id_idx on einding.sessions(task_id);
