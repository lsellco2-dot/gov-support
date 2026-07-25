-- 온통청년 내부 중복은 source_key가 달라도 동일 정책일 수 있으므로
-- 구조화된 정책 내용의 fingerprint를 별도 보존한다.
alter table public.announcements
  add column if not exists source_fingerprint text;

create index if not exists idx_ann_source_fingerprint
  on public.announcements (source_id, source_fingerprint)
  where source_fingerprint is not null;

-- 기존 17개 출력 컬럼의 순서와 타입은 유지한다.
-- 다른 source는 기존 content_hash 대표행 규칙을 그대로 사용한다.
-- youthcenter 내부에서만 source_fingerprint를 우선 적용하고,
-- 다른 source의 더 낮은 source_id가 같은 content_hash를 가진 경우에는
-- 기존과 동일하게 그 source가 대표행이 된다.
create or replace view public.announcements_public
with (security_invoker = true) as
with base as (
  select
    a.*,
    s.code as source_code,
    regexp_replace(lower(a.title), '[^0-9a-z가-힣]', '', 'g') as canonical_title,
    row_number() over (
      partition by a.content_hash
      order by a.source_id asc, a.updated_at desc, a.id desc
    ) as content_rank,
    row_number() over (
      partition by
        case
          when s.code = 'youthcenter'
               and a.source_fingerprint is not null
            then a.source_id::text || ':' || a.source_fingerprint
          else 'id:' || a.id::text
        end
      order by a.updated_at desc, a.id desc
    ) as source_fingerprint_rank
  from public.announcements a
  join public.sources s on s.id = a.source_id
),
source_deduped as (
  select current_row.*
  from base current_row
  where
    (
      current_row.source_code <> 'youthcenter'
      and current_row.content_rank = 1
    )
    or
    (
      current_row.source_code = 'youthcenter'
      and (
        current_row.source_fingerprint is null
        or current_row.source_fingerprint_rank = 1
      )
      and not exists (
        select 1
        from base preferred_hash
        where preferred_hash.content_hash = current_row.content_hash
          and preferred_hash.source_id < current_row.source_id
      )
    )
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
