-- 신규·변경 공고의 원문 상세 텍스트를 보존하기 위한 컬럼.
-- 첨부파일 본체는 저장하지 않고 attachments에 URL과 표시명만 저장한다.

alter table announcements
  add column if not exists detail_content text,
  add column if not exists apply_method text,
  add column if not exists documents text,
  add column if not exists contact text,
  add column if not exists attachments jsonb not null default '[]'::jsonb,
  add column if not exists detail_content_hash text,
  add column if not exists detail_source_hash text,
  add column if not exists detail_fetched_at timestamptz,
  add column if not exists detail_fetch_attempted_at timestamptz,
  add column if not exists detail_fetch_status text not null default 'pending',
  add column if not exists detail_fetch_error text;

create index if not exists idx_ann_detail_status
  on announcements (detail_fetch_status, detail_fetch_attempted_at);

comment on column announcements.detail_content is
  '원문 상세페이지에서 추출한 화면 표시용 전체 텍스트';
comment on column announcements.attachments is
  '첨부파일 본체가 아닌 label/url JSON 배열';
