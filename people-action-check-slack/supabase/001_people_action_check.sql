create table if not exists public.pac_records (
  id text primary key,
  kind text not null check (kind in ('check','submission','policy')),
  owner text not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists pac_records_kind_owner_updated_idx on public.pac_records(kind, owner, updated_at desc);

create table if not exists public.pac_audit_events (
  id uuid primary key,
  team text not null,
  actor text not null,
  action text not null,
  target_kind text not null,
  target_id text not null,
  created_at timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb
);
create index if not exists pac_audit_team_created_idx on public.pac_audit_events(team, created_at desc);

alter table public.pac_records enable row level security;
alter table public.pac_audit_events enable row level security;
revoke all on public.pac_records, public.pac_audit_events from anon, authenticated;
-- The Worker uses the protected service-role key. Slack members never receive database credentials.
