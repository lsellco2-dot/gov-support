-- 로그인 없이 앱 설치 단위로 공고 알림 설정을 저장한다.
-- installation_token 원문은 저장하지 않고 서버에서 SHA-256 해시한 값만 저장한다.

create table if not exists device_installations (
  installation_id uuid primary key,
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  platform text not null check (platform in ('android', 'ios')),
  app_version text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists announcement_alerts (
  installation_id uuid not null
    references device_installations(installation_id) on delete cascade,
  announcement_id bigint not null
    references announcements(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (installation_id, announcement_id)
);

create index if not exists idx_announcement_alerts_announcement
  on announcement_alerts (announcement_id);

alter table device_installations enable row level security;
alter table announcement_alerts enable row level security;

-- 공개 정책을 만들지 않는다. service_role을 사용하는 서버 API만 접근한다.
