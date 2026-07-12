-- 원본 행은 보존하고 사용자 화면 view에서만 보수적으로 중복을 숨긴다.
-- 같은 source 안에서는 기존 content_hash만 사용해 지역·차수·대상별 공고를 보호한다.
-- 서로 다른 source는 정규화 제목과 마감일이 모두 같을 때만 낮은 source_id를 우선한다.

create or replace view announcements_public
with (security_invoker = true) as
with ranked_by_hash as (
  select
    a.*,
    regexp_replace(lower(a.title), '[^0-9a-z가-힣]', '', 'g') as canonical_title,
    row_number() over (
      partition by a.content_hash
      order by a.source_id asc, a.updated_at desc, a.id desc
    ) as content_rank
  from announcements a
),
source_deduped as (
  select *
  from ranked_by_hash
  where content_rank = 1
)
select
  id, source_id, source_key, title, organization, category_ids, region,
  target, support_type, summary, apply_start, apply_end, detail_url,
  case when apply_end is null or apply_end >= current_date
       then 'open' else 'closed' end as status,
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
