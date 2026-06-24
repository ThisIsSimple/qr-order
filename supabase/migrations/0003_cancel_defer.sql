-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 손님 셀프 취소 + 미루기(뒤로 2팀, 최대 2회, 대기중일 때만)                  ║
-- ║ 순서 키를 ticket_no(표시 번호)와 분리: sort_at 도입                         ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- 순서용 키 (표시 번호 ticket_no와 분리). 기존 행은 created_at로 백필.
alter table public.queue_entries
  add column if not exists sort_at timestamptz not null default now();
update public.queue_entries set sort_at = created_at where sort_at <> created_at;

-- 미루기 횟수
alter table public.queue_entries
  add column if not exists defer_count integer not null default 0;

create index if not exists queue_entries_store_status_sort_idx
  on public.queue_entries (store_id, status, sort_at);

-- ── enqueue_party: waiting_ahead를 sort_at 기준으로 (표시 ticket_no는 그대로) ──
drop function if exists public.enqueue_party(text, integer, text, text);
create function public.enqueue_party(
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
  v_day_start timestamptz := (v_day::timestamp at time zone 'Asia/Seoul');
  v_ticket    integer;
  v_token     text;
  v_entry_id  uuid;
  v_sort      timestamptz;
begin
  select s.id into v_store_id
  from public.stores s
  join public.subscriptions sub on sub.store_id = s.id
  where s.store_code = upper(p_store_code)
    and sub.status in ('trialing','active')
  limit 1;

  if v_store_id is null then
    raise exception 'store_not_found_or_inactive' using errcode = 'P0001';
  end if;

  insert into public.queue_counters (store_id, day, last_no)
  values (v_store_id, v_day, 1)
  on conflict (store_id, day)
    do update set last_no = public.queue_counters.last_no + 1
  returning last_no into v_ticket;

  insert into public.queue_entries (store_id, ticket_no, party_size, customer_name, phone)
  values (v_store_id, v_ticket, p_party_size, p_customer_name, nullif(p_phone, ''))
  returning id, queue_entries.access_token, queue_entries.sort_at
       into v_entry_id, v_token, v_sort;

  return query
  select v_entry_id, v_ticket, v_token,
    (select count(*)::int from public.queue_entries q
      where q.store_id = v_store_id and q.status = 'waiting'
        and q.sort_at < v_sort and q.created_at >= v_day_start);
end;
$$;

-- ── get_entry_status: waiting_ahead를 sort_at 기준으로 + defer_count 반환 ──
drop function if exists public.get_entry_status(text);
create function public.get_entry_status(p_access_token text)
returns table (
  entry_id      uuid,
  store_name    text,
  ticket_no     integer,
  party_size    integer,
  status        text,
  waiting_ahead integer,
  defer_count   integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store_id  uuid;
  v_created   timestamptz;
  v_sort      timestamptz;
  v_day_start timestamptz;
begin
  select q.store_id, q.created_at, q.sort_at
    into v_store_id, v_created, v_sort
  from public.queue_entries q
  where q.access_token = p_access_token;

  if v_store_id is null then
    return;
  end if;

  v_day_start := ((v_created at time zone 'Asia/Seoul')::date::timestamp
                  at time zone 'Asia/Seoul');

  return query
  select q.id, s.name, q.ticket_no, q.party_size, q.status,
    (select count(*)::int from public.queue_entries q2
      where q2.store_id = v_store_id and q2.status = 'waiting'
        and q2.sort_at < v_sort and q2.created_at >= v_day_start),
    q.defer_count
  from public.queue_entries q
  join public.stores s on s.id = q.store_id
  where q.access_token = p_access_token;
end;
$$;

-- ── 손님 셀프 취소: waiting/called 일 때만 ──
create or replace function public.cancel_my_entry(p_access_token text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid; v_status text;
begin
  select id, status into v_id, v_status
  from public.queue_entries where access_token = p_access_token;

  if v_id is null then return 'not_found'; end if;
  if v_status not in ('waiting','called') then return v_status; end if;

  update public.queue_entries set status = 'canceled' where id = v_id;
  return 'canceled';
end;
$$;

-- ── 미루기: 뒤로 p_teams(기본 2)팀, 최대 2회, waiting 일 때만 ──
create or replace function public.defer_my_entry(
  p_access_token text,
  p_teams integer default 2
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid; v_store uuid; v_sort timestamptz; v_status text;
  v_defer integer; v_created timestamptz; v_day_start timestamptz;
  v_target timestamptz;
begin
  select id, store_id, sort_at, status, defer_count, created_at
    into v_id, v_store, v_sort, v_status, v_defer, v_created
  from public.queue_entries where access_token = p_access_token;

  if v_id is null then return 'not_found'; end if;
  if v_status <> 'waiting' then return 'not_waiting'; end if;
  if v_defer >= 2 then return 'limit'; end if;

  v_day_start := ((v_created at time zone 'Asia/Seoul')::date::timestamp
                  at time zone 'Asia/Seoul');

  -- 내 뒤에 있는 팀들 중 가까운 p_teams번째 팀의 sort_at
  select t.sort_at into v_target
  from (
    select q.sort_at
    from public.queue_entries q
    where q.store_id = v_store and q.status = 'waiting'
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
  where id = v_id;
  return 'deferred';
end;
$$;

-- 권한
revoke all on function public.enqueue_party(text, integer, text, text) from public;
grant execute on function public.enqueue_party(text, integer, text, text) to anon, authenticated;
revoke all on function public.get_entry_status(text) from public;
grant execute on function public.get_entry_status(text) to anon, authenticated;
revoke all on function public.cancel_my_entry(text) from public;
grant execute on function public.cancel_my_entry(text) to anon, authenticated;
revoke all on function public.defer_my_entry(text, integer) from public;
grant execute on function public.defer_my_entry(text, integer) to anon, authenticated;
