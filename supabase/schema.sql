-- Run this once in the Supabase SQL Editor

create table if not exists public.relay_incidents (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  status text not null default 'OPEN',
  type text,
  context jsonb default '{}'::jsonb,
  selected_offer jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.relay_messages (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid references public.relay_incidents(id) on delete cascade,
  role text not null,
  content text not null,
  created_at timestamptz default now()
);

create index if not exists idx_relay_incidents_user on public.relay_incidents(user_id);
create index if not exists idx_relay_messages_incident on public.relay_messages(incident_id);

alter table public.relay_incidents enable row level security;
alter table public.relay_messages enable row level security;
