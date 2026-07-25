-- 온통청년 정책의 복수 지역과 추천에 필요한 구조화 필드를 보존한다.
-- 모든 컬럼은 nullable이며 기존 announcements 행에는 값을 강제하지 않는다.
alter table public.announcements
  add column if not exists regions text[],
  add column if not exists age_min integer,
  add column if not exists age_max integer,
  add column if not exists policy_domain text,
  add column if not exists source_updated_at timestamptz,
  add column if not exists source_status text;

alter table public.announcements
  add constraint announcements_source_status_check
  check (
    source_status is null
    or source_status in ('open', 'upcoming', 'always', 'closed', 'unknown')
  )
  not valid;

alter table public.announcements
  validate constraint announcements_source_status_check;

create index if not exists idx_ann_regions
  on public.announcements using gin (regions);

create index if not exists idx_ann_policy_domain
  on public.announcements (policy_domain);

-- sources.id에는 identity/default/sequence가 없으므로 숫자 할당이 필요하다.
-- 같은 함수를 사용하는 동시 실행은 트랜잭션 범위 advisory lock으로 직렬화한다.
create or replace function public.ensure_source_by_code(
  p_code text,
  p_name text
)
returns smallint
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_source_id smallint;
  v_next_id integer;
begin
  if nullif(pg_catalog.btrim(p_code), '') is null
     or nullif(pg_catalog.btrim(p_name), '') is null then
    raise exception 'source code and name are required'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('public.sources.id-allocation', 0)
  );

  select s.id
    into v_source_id
  from public.sources s
  where s.code = p_code;

  if v_source_id is null then
    select coalesce(pg_catalog.max(s.id), 0) + 1
      into v_next_id
    from public.sources s;

    if v_next_id > 32767 then
      raise exception 'sources.id smallint range exhausted';
    end if;

    insert into public.sources (id, code, name)
    values (v_next_id::smallint, p_code, p_name)
    on conflict (code) do nothing;

    select s.id
      into v_source_id
    from public.sources s
    where s.code = p_code;
  end if;

  if v_source_id is null then
    raise exception 'source creation failed for code %', p_code;
  end if;

  return v_source_id;
end;
$function$;

revoke all on function public.ensure_source_by_code(text, text)
  from public, anon, authenticated;
grant execute on function public.ensure_source_by_code(text, text)
  to service_role;

select public.ensure_source_by_code('youthcenter', '온통청년');

-- 기존 17개 출력 컬럼의 순서와 타입은 유지한다.
-- source_status는 온통청년의 상태 판정에만 사용하고 공개 컬럼으로 추가하지 않는다.
create or replace view public.announcements_public
with (security_invoker = true) as
with ranked_by_hash as (
  select
    a.*,
    s.code as source_code,
    regexp_replace(lower(a.title), '[^0-9a-z가-힣]', '', 'g') as canonical_title,
    row_number() over (
      partition by a.content_hash
      order by a.source_id asc, a.updated_at desc, a.id desc
    ) as content_rank
  from public.announcements a
  join public.sources s on s.id = a.source_id
),
source_deduped as (
  select *
  from ranked_by_hash
  where content_rank = 1
)
select
  id, source_id, source_key, title, organization, category_ids, region,
  target, support_type, summary, apply_start, apply_end, detail_url,
  case
    when current_row.source_code = 'youthcenter'
         and current_row.source_status = 'closed'
      then 'closed'
    when current_row.source_code = 'youthcenter'
         and current_row.source_status = 'upcoming'
      then 'upcoming'
    when current_row.source_code = 'youthcenter'
         and current_row.source_status in ('open', 'always')
      then 'open'
    when current_row.apply_end is null
         or current_row.apply_end >= current_date
      then 'open'
    else 'closed'
  end as status,
  content_hash, created_at, updated_at
from source_deduped current_row
where not exists (
  select 1
  from source_deduped preferred
  where preferred.source_id < current_row.source_id
    and length(current_row.canonical_title) >= 10
    and preferred.canonical_title = current_row.canonical_title
    and preferred.apply_end is not distinct from current_row.apply_end
);
