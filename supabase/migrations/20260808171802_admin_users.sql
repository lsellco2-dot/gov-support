create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin',
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

revoke all on table public.admin_users from anon, authenticated;
grant select on table public.admin_users to authenticated;
grant all on table public.admin_users to service_role;

create policy "users can read their own admin membership"
on public.admin_users
for select
to authenticated
using ((select auth.uid()) = user_id);
