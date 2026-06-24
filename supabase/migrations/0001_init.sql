-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ QR 대기열 — 초기 스키마 (M1)                                               ║
-- ║ stores · subscriptions · queue_entries · notifications · queue_counters    ║
-- ║ + 동시성 안전 순번 발급 함수(enqueue_party) + 손님 조회 함수 + RLS         ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

create extension if not exists pgcrypto;

-- ── 짧은 매장 코드 생성기 (QR/URL용, 대문자+숫자 6자리, 혼동문자 제외) ──────
create or replace function public.gen_store_code()
returns text
language plpgsql
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for _ in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.stores where store_code = code);
  end loop;
  return code;
end;
$$;

-- ── 매장 ─────────────────────────────────────────────────────────────────────
create table public.stores (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid references auth.users (id) on delete cascade,  -- null = 데모/미점유
  name        text not null,
  store_code  text not null unique default public.gen_store_code(),
  address     text,
  settings    jsonb not null default '{"notifyOnCall": true, "avgMinutesPerParty": 10}'::jsonb,
  created_at  timestamptz not null default now()
);
create index stores_owner_id_idx on public.stores (owner_id);

-- ── 구독 ─────────────────────────────────────────────────────────────────────
create table public.subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  store_id           uuid not null references public.stores (id) on delete cascade,
  plan               text not null default 'basic',
  status             text not null default 'trialing'
                       check (status in ('trialing','active','past_due','canceled')),
  pg_provider        text,
  billing_key        text,
  current_period_end timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create unique index subscriptions_store_id_idx on public.subscriptions (store_id);

-- ── 대기 엔트리 ──────────────────────────────────────────────────────────────
create table public.queue_entries (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references public.stores (id) on delete cascade,
  ticket_no     integer not null,
  party_size    integer not null check (party_size between 1 and 50),
  customer_name text not null,
  phone         text,
  status        text not null default 'waiting'
                  check (status in ('waiting','called','seated','canceled','no_show')),
  access_token  text not null default encode(gen_random_bytes(16), 'hex'),
  created_at    timestamptz not null default now(),
  called_at     timestamptz,
  seated_at     timestamptz
);
create index queue_entries_store_status_idx
  on public.queue_entries (store_id, status, ticket_no);
create unique index queue_entries_access_token_idx
  on public.queue_entries (access_token);

-- ── 알림 로그 ────────────────────────────────────────────────────────────────
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  entry_id   uuid not null references public.queue_entries (id) on delete cascade,
  channel    text not null,
  payload    jsonb not null default '{}'::jsonb,
  status     text not null default 'queued',
  sent_at    timestamptz,
  created_at timestamptz not null default now()
);

-- ── 일자별 순번 카운터 (매장×날짜로 ticket_no 원자적 발급) ────────────────────
create table public.queue_counters (
  store_id uuid not null references public.stores (id) on delete cascade,
  day      date not null,
  last_no  integer not null default 0,
  primary key (store_id, day)
);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 함수                                                                       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- 손님 대기 등록: 활성 구독 확인 → 순번 원자적 발급 → 엔트리 생성
create or replace function public.enqueue_party(
  p_store_code   text,
  p_party_size   integer,
  p_customer_name text,
  p_phone        text
)
returns table (
  entry_id      uuid,
  ticket_no     integer,
  access_token  text,
  waiting_ahead integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store_id  uuid;
  v_day       date := (now() at time zone 'Asia/Seoul')::date;
  -- KST 자정을 UTC instant로 변환한 '오늘 시작' 경계
  v_day_start timestamptz := (v_day::timestamp at time zone 'Asia/Seoul');
  v_ticket    integer;
  v_token     text;
  v_entry_id  uuid;
begin
  -- 활성 구독이 있는 매장만 등록 허용
  select s.id into v_store_id
  from public.stores s
  join public.subscriptions sub on sub.store_id = s.id
  where s.store_code = upper(p_store_code)
    and sub.status in ('trialing','active')
  limit 1;

  if v_store_id is null then
    raise exception 'store_not_found_or_inactive' using errcode = 'P0001';
  end if;

  -- 일자별 순번 원자적 발급
  insert into public.queue_counters (store_id, day, last_no)
  values (v_store_id, v_day, 1)
  on conflict (store_id, day)
    do update set last_no = public.queue_counters.last_no + 1
  returning last_no into v_ticket;

  insert into public.queue_entries (store_id, ticket_no, party_size, customer_name, phone)
  values (v_store_id, v_ticket, p_party_size, p_customer_name, nullif(p_phone, ''))
  returning id, queue_entries.access_token into v_entry_id, v_token;

  return query
  select
    v_entry_id,
    v_ticket,
    v_token,
    (select count(*)::int
       from public.queue_entries q
      where q.store_id = v_store_id
        and q.status = 'waiting'
        and q.ticket_no < v_ticket
        and q.created_at >= v_day_start);
end;
$$;

-- 손님이 access_token으로 자기 순번/상태만 조회 (테이블 직접 노출 없이)
create or replace function public.get_entry_status(p_access_token text)
returns table (
  entry_id      uuid,
  store_name    text,
  ticket_no     integer,
  party_size    integer,
  status        text,
  waiting_ahead integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store_id  uuid;
  v_ticket    integer;
  v_created   timestamptz;
  v_day_start timestamptz;
begin
  select q.store_id, q.ticket_no, q.created_at
    into v_store_id, v_ticket, v_created
  from public.queue_entries q
  where q.access_token = p_access_token;

  if v_store_id is null then
    return;  -- 잘못된 토큰 → 빈 결과
  end if;

  -- 해당 엔트리가 속한 KST 날짜의 시작 경계
  v_day_start := ((v_created at time zone 'Asia/Seoul')::date::timestamp
                  at time zone 'Asia/Seoul');

  return query
  select
    q.id,
    s.name,
    q.ticket_no,
    q.party_size,
    q.status,
    (select count(*)::int
       from public.queue_entries q2
      where q2.store_id = v_store_id
        and q2.status = 'waiting'
        and q2.ticket_no < v_ticket
        and q2.created_at >= v_day_start)
  from public.queue_entries q
  join public.stores s on s.id = q.store_id
  where q.access_token = p_access_token;
end;
$$;

revoke all on function public.enqueue_party(text, integer, text, text) from public;
grant execute on function public.enqueue_party(text, integer, text, text) to anon, authenticated;
revoke all on function public.get_entry_status(text) from public;
grant execute on function public.get_entry_status(text) to anon, authenticated;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Row Level Security                                                         ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
alter table public.stores         enable row level security;
alter table public.subscriptions  enable row level security;
alter table public.queue_entries  enable row level security;
alter table public.notifications  enable row level security;
alter table public.queue_counters enable row level security;

-- 매장: 누구나 코드로 조회 가능(손님 /q 페이지), 점주만 관리
create policy stores_select_public on public.stores
  for select using (true);
create policy stores_insert_own on public.stores
  for insert with check (owner_id = auth.uid());
create policy stores_update_own on public.stores
  for update using (owner_id = auth.uid());
create policy stores_delete_own on public.stores
  for delete using (owner_id = auth.uid());

-- 구독: 점주만
create policy subs_select_own on public.subscriptions
  for select using (
    exists (select 1 from public.stores s
            where s.id = subscriptions.store_id and s.owner_id = auth.uid())
  );

-- 대기 엔트리: 점주만 조회/상태전환 (손님은 get_entry_status 함수로만 접근)
create policy entries_select_owner on public.queue_entries
  for select using (
    exists (select 1 from public.stores s
            where s.id = queue_entries.store_id and s.owner_id = auth.uid())
  );
create policy entries_update_owner on public.queue_entries
  for update using (
    exists (select 1 from public.stores s
            where s.id = queue_entries.store_id and s.owner_id = auth.uid())
  );

-- 알림: 점주만 조회
create policy notif_select_owner on public.notifications
  for select using (
    exists (select 1 from public.queue_entries q
            join public.stores s on s.id = q.store_id
            where q.id = notifications.entry_id and s.owner_id = auth.uid())
  );

-- queue_counters: 직접 접근 불가 (정책 없음 = 모두 거부, 함수만 접근)

-- ── Realtime: 관리자 대시보드가 queue_entries 변경을 구독 ─────────────────────
alter publication supabase_realtime add table public.queue_entries;
