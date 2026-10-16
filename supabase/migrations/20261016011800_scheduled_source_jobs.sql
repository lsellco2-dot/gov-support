-- 운영 수집의 날짜별 실행권. 실패/중단도 당일 실행권을 소비한다.
create table public.ingest_daily_jobs (
  id uuid primary key default gen_random_uuid(),
  job_key text not null check (job_key in ('enara', 'bokji-central', 'bokji-local')),
  run_date date not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'success', 'failed')),
  summary jsonb not null default '{}'::jsonb,
  unique (job_key, run_date)
);
alter table public.ingest_daily_jobs enable row level security;
revoke all on public.ingest_daily_jobs from public, anon, authenticated;
grant select, insert, update on public.ingest_daily_jobs to service_role;

create function public.claim_daily_ingest_job(p_job_key text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  claimed uuid;
begin
  if p_job_key not in ('enara', 'bokji-central', 'bokji-local') then
    raise exception 'Unsupported ingestion job';
  end if;
  -- 같은 날 동시 실행은 UNIQUE 제약으로 하나만 통과한다.
  insert into public.ingest_daily_jobs (job_key, run_date)
  values (p_job_key, (now() at time zone 'Asia/Seoul')::date)
  on conflict (job_key, run_date) do nothing
  returning id into claimed;
  return claimed;
end;
$$;
revoke all on function public.claim_daily_ingest_job(text) from public, anon, authenticated;
grant execute on function public.claim_daily_ingest_job(text) to service_role;
