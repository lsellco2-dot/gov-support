-- 목록 페이지네이션 전에 복수 지역을 정확히 필터링할 수 있도록
-- 기존 17개 공개 컬럼 뒤에 regions만 추가한다.
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
  content_hash, created_at, updated_at,
  regions
from source_deduped current_row
where not exists (
  select 1
  from source_deduped preferred
  where preferred.source_id < current_row.source_id
    and length(current_row.canonical_title) >= 10
    and preferred.canonical_title = current_row.canonical_title
    and preferred.apply_end is not distinct from current_row.apply_end
);
