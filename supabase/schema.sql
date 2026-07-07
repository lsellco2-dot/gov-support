-- ============================================================
-- 정부지원사업 공고 조회서비스 스키마 (Supabase SQL Editor에서 실행)
-- ============================================================

create extension if not exists pg_trgm;

-- 출처
create table if not exists sources (
  id smallint primary key,
  code text unique not null,
  name text not null,
  enabled boolean default true,
  last_fetched_at timestamptz
);

insert into sources (id, code, name) values
 (1,'bizinfo','중소벤처기업부 중소기업 지원사업(기업마당)'),
 (2,'kstartup','창업진흥원 K-Startup'),
 (3,'mss','중소벤처기업부 사업공고'),
 (4,'mois','행정안전부 공공서비스(혜택)'),
 (5,'msit','과학기술정보통신부 사업공고')
on conflict (id) do nothing;

-- 카테고리 (9개 대분류)
create table if not exists categories (
  id smallint primary key,
  name text not null,
  parent_id smallint references categories(id)
);

insert into categories (id, name) values
 (1,'창업지원'),(2,'소상공인 지원'),(3,'자금/대출/보증'),
 (4,'마케팅/판로'),(5,'고용/인건비'),(6,'기술/R&D'),
 (7,'수출/해외진출'),(8,'교육/컨설팅'),(9,'시설/디지털전환')
on conflict (id) do nothing;

-- 공고 본체
-- 주의: status는 generated column으로 만들 수 없음(current_date가 immutable이 아님)
--       → 아래 announcements_public 뷰에서 계산
create table if not exists announcements (
  id bigint generated always as identity primary key,
  source_id smallint not null references sources(id),
  source_key text not null,
  title text not null,
  organization text,
  category_ids smallint[] not null default '{}',
  region text default '전국',
  target text,
  support_type text,
  summary text,
  apply_start date,
  apply_end date,                -- null = 상시/미상
  detail_url text,
  content_hash text not null,
  raw_json jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (source_id, source_key)
);

create index if not exists idx_ann_end on announcements (apply_end desc nulls last);
create index if not exists idx_ann_category on announcements using gin (category_ids);
create index if not exists idx_ann_hash on announcements (content_hash);
create index if not exists idx_ann_title_trgm on announcements using gin (title gin_trgm_ops);

-- 사용자 화면이 조회하는 뷰: 출처 간 중복은 content_hash당 대표 1건만 노출
-- (source_id 오름차순 = bizinfo > kstartup > ... 우선)
create or replace view announcements_public
with (security_invoker = true) as
select distinct on (content_hash)
  id, source_id, source_key, title, organization, category_ids, region,
  target, support_type, summary, apply_start, apply_end, detail_url,
  case when apply_end is null or apply_end >= current_date
       then 'open' else 'closed' end as status,
  content_hash, created_at, updated_at
from announcements
order by content_hash, source_id asc;

-- 전문가 상담 요청 (개인정보: consent_at 필수)
create table if not exists expert_leads (
  id bigint generated always as identity primary key,
  announcement_id bigint references announcements(id) on delete set null,
  name text not null,
  phone text not null,
  is_business boolean,
  region text,
  message text,
  utm jsonb,
  consent_at timestamptz not null,
  created_at timestamptz default now()
);

-- 이벤트 로그 (BM 근거 데이터)
create table if not exists announcement_events (
  id bigint generated always as identity primary key,
  announcement_id bigint,
  event_type text not null check (event_type in ('view','detail','expert_click')),
  session_id text,
  created_at timestamptz default now()
);

-- ── RLS ────────────────────────────────────────────────────
alter table announcements enable row level security;
create policy "public read announcements" on announcements for select using (true);

alter table categories enable row level security;
create policy "public read categories" on categories for select using (true);

alter table sources enable row level security;
create policy "public read sources" on sources for select using (true);

-- leads / events: 정책 없음 = anon 접근 불가. service_role(API Route)만 쓰기.
alter table expert_leads enable row level security;
alter table announcement_events enable row level security;
