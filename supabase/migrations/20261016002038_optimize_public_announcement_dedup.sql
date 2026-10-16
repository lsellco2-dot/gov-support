-- Keep the public columns and deduplication rules; rank narrow rows before reading content.
create or replace view public.announcements_public
with (security_invoker = true) as
with base as (
  select
    a.id, a.source_id, a.content_hash, a.source_fingerprint,
    a.apply_end, a.source_status, s.code as source_code,
    regexp_replace(lower(a.title), '[^0-9a-z가-힣]', '', 'g') as canonical_title,
    row_number() over (
      partition by a.content_hash
      order by a.source_id asc, a.updated_at desc, a.id desc
    ) as content_rank,
    min(a.source_id) over (partition by a.content_hash) as first_hash_source,
    row_number() over (
      partition by case
        when s.code = 'youthcenter' and a.source_fingerprint is not null
          then a.source_id::text || ':' || a.source_fingerprint
        else 'id:' || a.id::text
      end
      order by a.updated_at desc, a.id desc
    ) as source_fingerprint_rank
  from public.announcements a
  join public.sources s on s.id = a.source_id
  where s.code <> 'youthcenter' or nullif(btrim(a.apply_method), '') is not null
),
source_deduped as (
  select *
  from base
  where (source_code <> 'youthcenter' and content_rank = 1)
    or (source_code = 'youthcenter'
      and (source_fingerprint is null or source_fingerprint_rank = 1)
      and (content_hash is null or first_hash_source = source_id))
),
title_ranked as (
  select *,
    min(source_id) over (partition by canonical_title, apply_end) as first_title_source
  from source_deduped
)
select
  a.id, a.source_id, a.source_key, a.title, a.organization, a.category_ids, a.region,
  a.target, a.support_type, a.summary, a.apply_start, a.apply_end, a.detail_url,
  case
    when r.source_code = 'youthcenter' and r.source_status = 'closed' then 'closed'
    when r.source_code = 'youthcenter' and r.source_status = 'upcoming' then 'upcoming'
    when r.source_code = 'youthcenter' and r.source_status in ('open', 'always') then 'open'
    when a.apply_end is null or a.apply_end >= current_date then 'open'
    else 'closed'
  end as status,
  a.content_hash, a.created_at, a.updated_at, a.regions
from title_ranked r
join public.announcements a on a.id = r.id
where r.canonical_title is null or length(r.canonical_title) < 10
  or r.first_title_source = r.source_id;
