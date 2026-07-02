-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 코드 점검 후속 하드닝                                                       ║
-- ║ 1) stores 좌표 컬럼 쓰기 차단(0006의 컬럼 REVOKE는 테이블 UPDATE grant가    ║
-- ║    남아 있어 무효였음) 2) 대기열 인원 범위 CHECK 3) enqueue_party 서버 검증  ║
-- ║ 4) defer/cancel 경쟁 조건(guarded update) 5) sort_at 발급 순서 정합         ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ── 1. stores: 테이블 UPDATE를 회수하고 점주가 수정 가능한 컬럼만 재부여 ────────
-- 컬럼 단위 REVOKE는 테이블 단위 GRANT를 깎지 못한다(Postgres 권한 모델).
-- latitude/longitude/road_address는 service_role(지오코딩 라우트)만 기록.
revoke update on public.stores from anon, authenticated;
grant update (name, address, settings, require_nearby, nearby_radius_m)
  on public.stores to authenticated;

-- ── 2. queues: 인원 범위 무결성 (관리자 UI 검증과 별개로 DB에서 보장) ──────────
alter table public.queues
  add constraint queues_party_range_chk check (
    (min_party is null or min_party between 1 and 50) and
    (max_party is null or max_party between 1 and 50) and
    (min_party is null or max_party is null or min_party <= max_party)
  );

-- ── 3. enqueue_party: 서버 검증 보강 + sort_at 발급 순서 정합 ───────────────────
-- 추가된 검증(익명 RPC 직접 호출로 zod를 우회할 수 있으므로 서버에서 강제):
--   · customer_name 공백 불가 / 40자 이내
--   · party_size가 대기열 min_party~max_party 범위 안인지
--   · phone_required는 공백 전화번호로 통과 불가(btrim)
-- sort_at: 기본값 now()는 트랜잭션 시작 시각이라 카운터 락 획득 순서(번호 순서)와
-- 뒤집힐 수 있음 → 락 획득 후 clock_timestamp()로 기록해 번호↔순서를 일치시킨다.
create or replace function public.enqueue_party(
  p_queue_id      uuid,
  p_party_size    integer,
  p_customer_name text,
  p_phone         text,
  p_lat           double precision default null,
  p_lng           double precision default null
)
returns table (
  entry_id      uuid,
  ticket_no     integer,
  access_token  text,
  waiting_ahead integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_store_id       uuid;
  v_active         boolean;
  v_phone_required boolean;
  v_min_party      integer;
  v_max_party      integer;
  v_lat            double precision;
  v_lng            double precision;
  v_require_nearby boolean;
  v_radius         integer;
  v_dist           double precision;
  v_name           text := btrim(coalesce(p_customer_name, ''));
  v_phone          text := nullif(btrim(coalesce(p_phone, '')), '');
  v_day       date := (now() at time zone 'Asia/Seoul')::date;
  v_day_start timestamptz := (v_day::timestamp at time zone 'Asia/Seoul');
  v_ticket    integer;
  v_token     text;
  v_entry_id  uuid;
  v_sort      timestamptz;
begin
  select q.store_id, q.is_active, q.phone_required, q.min_party, q.max_party,
         s.latitude, s.longitude, s.require_nearby, s.nearby_radius_m
    into v_store_id, v_active, v_phone_required, v_min_party, v_max_party,
         v_lat, v_lng, v_require_nearby, v_radius
  from public.queues q
  join public.subscriptions sub on sub.store_id = q.store_id
  join public.stores s on s.id = q.store_id
  where q.id = p_queue_id and sub.status in ('trialing','active')
  limit 1;

  if v_store_id is null or not coalesce(v_active, false) then
    raise exception 'queue_not_found_or_inactive' using errcode = 'P0001';
  end if;

  if length(v_name) = 0 or char_length(v_name) > 40 then
    raise exception 'invalid_name' using errcode = 'P0001';
  end if;

  if (v_min_party is not null and p_party_size < v_min_party)
     or (v_max_party is not null and p_party_size > v_max_party) then
    raise exception 'party_size_out_of_range' using errcode = 'P0001';
  end if;

  if v_phone_required and v_phone is null then
    raise exception 'phone_required' using errcode = 'P0001';
  end if;

  -- 근처 등록: 매장 좌표가 있을 때만 검증 (좌표 미등록이면 강제 불가)
  if v_require_nearby and v_lat is not null and v_lng is not null then
    if p_lat is null or p_lng is null then
      raise exception 'location_required' using errcode = 'P0001';
    end if;
    v_dist := 6371000 * acos(least(1, greatest(-1,
      sin(radians(v_lat)) * sin(radians(p_lat)) +
      cos(radians(v_lat)) * cos(radians(p_lat)) * cos(radians(p_lng - v_lng))
    )));
    if v_dist > v_radius then
      raise exception 'too_far' using errcode = 'P0001';
    end if;
  end if;

  insert into public.queue_counters (queue_id, store_id, day, last_no)
  values (p_queue_id, v_store_id, v_day, 1)
  on conflict (queue_id, day)
    do update set last_no = public.queue_counters.last_no + 1
  returning last_no into v_ticket;

  insert into public.queue_entries
    (store_id, queue_id, ticket_no, party_size, customer_name, phone, sort_at)
  values
    (v_store_id, p_queue_id, v_ticket, p_party_size, v_name, v_phone, clock_timestamp())
  returning id, queue_entries.access_token, queue_entries.sort_at
       into v_entry_id, v_token, v_sort;

  return query
  select v_entry_id, v_ticket, v_token,
    (select count(*)::int from public.queue_entries q2
      where q2.queue_id = p_queue_id and q2.status = 'waiting'
        and q2.sort_at < v_sort and q2.created_at >= v_day_start);
end;
$$;

-- ── 4. defer_my_entry: p_teams 클램프 + guarded update로 경쟁 조건 제거 ─────────
-- 기존: 스냅숏 검사 후 무조건 update → 동시 호출 시 defer_count 한도(2회) 우회,
-- 호출 직후(called) 엔트리도 미뤄짐. update의 where로 상태·한도를 원자적으로 강제.
-- 날짜 경계: 자정 직전 등록 후 자정 넘겨 미루면 뒤 팀이 안 보이던 문제 →
-- '지금(KST)' 기준 하루 시작으로 계산.
create or replace function public.defer_my_entry(
  p_access_token text,
  p_teams integer default 2
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid; v_queue uuid; v_sort timestamptz; v_status text;
  v_defer integer; v_day_start timestamptz; v_target timestamptz;
begin
  p_teams := least(greatest(coalesce(p_teams, 2), 1), 10);

  select id, queue_id, sort_at, status, defer_count
    into v_id, v_queue, v_sort, v_status, v_defer
  from public.queue_entries where access_token = p_access_token;

  if v_id is null then return 'not_found'; end if;
  if v_status <> 'waiting' then return 'not_waiting'; end if;
  if v_defer >= 2 then return 'limit'; end if;

  v_day_start := ((now() at time zone 'Asia/Seoul')::date::timestamp
                  at time zone 'Asia/Seoul');

  select t.sort_at into v_target
  from (
    select q.sort_at
    from public.queue_entries q
    where q.queue_id = v_queue and q.status = 'waiting'
      and q.sort_at > v_sort and q.created_at >= v_day_start
    order by q.sort_at asc
    limit p_teams
  ) t
  order by t.sort_at desc
  limit 1;

  if v_target is null then return 'no_teams_behind'; end if;

  update public.queue_entries
     set sort_at = v_target + interval '1 microsecond',
         defer_count = defer_count + 1
   where id = v_id and status = 'waiting' and defer_count < 2;

  if not found then
    -- 검사와 갱신 사이에 상태가 바뀜(호출됨/동시 미루기 한도 도달)
    select defer_count into v_defer from public.queue_entries where id = v_id;
    if v_defer >= 2 then return 'limit'; end if;
    return 'not_waiting';
  end if;
  return 'deferred';
end;
$$;

-- ── 5. cancel_my_entry: guarded update (호출↔취소 동시 처리 경쟁 제거) ──────────
create or replace function public.cancel_my_entry(p_access_token text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid; v_status text;
begin
  select id, status into v_id, v_status
  from public.queue_entries where access_token = p_access_token;

  if v_id is null then return 'not_found'; end if;

  update public.queue_entries set status = 'canceled'
   where id = v_id and status in ('waiting','called');

  if not found then
    select status into v_status from public.queue_entries where id = v_id;
    return coalesce(v_status, 'not_found');
  end if;
  return 'canceled';
end;
$$;
