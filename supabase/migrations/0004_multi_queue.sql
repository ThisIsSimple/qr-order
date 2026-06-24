-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 멀티 대기열: 매장당 여러 대기열(예: 2인석, 3~5인석)                          ║
-- ║ 대기열별 독립 번호 / 손님이 대기열 선택 / 관리자가 대기열 설정              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ── 대기열 정의 ───────────────────────────────────────────────────────────────
create table public.queues (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores (id) on delete cascade,
  name        text not null,
  description text,
  min_party   integer,
  max_party   integer,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index queues_store_idx on public.queues (store_id, sort_order);

-- ── queue_entries에 queue_id (우선 nullable로 추가 후 백필) ────────────────────
alter table public.queue_entries
  add column queue_id uuid references public.queues (id) on delete cascade;

-- ── queue_counters: 번호를 (queue_id, day)로 (기존 store_id, day → 마이그레이션) ─
alter table public.queue_counters
  add column queue_id uuid references public.queues (id) on delete cascade;

-- ── 백필: 매장마다 '기본 대기' 1개 생성 → 기존 엔트리/카운터 연결 ─────────────
insert into public.queues (store_id, name, sort_order)
select id, '기본 대기', 0 from public.stores;

update public.queue_entries qe
set queue_id = q.id
from public.queues q
where q.store_id = qe.store_id and qe.queue_id is null;

update public.queue_counters qc
set queue_id = q.id
from public.queues q
where q.store_id = qc.store_id and qc.queue_id is null;

-- ── 제약 마무리 ───────────────────────────────────────────────────────────────
alter table public.queue_entries alter column queue_id set not null;
create index queue_entries_queue_status_sort_idx
  on public.queue_entries (queue_id, status, sort_at);

alter table public.queue_counters drop constraint queue_counters_pkey;
alter table public.queue_counters alter column queue_id set not null;
alter table public.queue_counters add primary key (queue_id, day);

-- ── 신규 매장 → '기본 대기' 자동 생성 트리거 ─────────────────────────────────
create or replace function public.create_default_queue()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.queues (store_id, name, sort_order)
  values (new.id, '기본 대기', 0);
  return new;
end;
$$;

drop trigger if exists stores_default_queue on public.stores;
create trigger stores_default_queue
  after insert on public.stores
  for each row execute function public.create_default_queue();

-- ── RLS: queues ───────────────────────────────────────────────────────────────
alter table public.queues enable row level security;

create policy queues_select_public on public.queues
  for select using (true);
create policy queues_insert_own on public.queues
  for insert with check (
    exists (select 1 from public.stores s
            where s.id = queues.store_id and s.owner_id = auth.uid())
  );
create policy queues_update_own on public.queues
  for update using (
    exists (select 1 from public.stores s
            where s.id = queues.store_id and s.owner_id = auth.uid())
  );
create policy queues_delete_own on public.queues
  for delete using (
    exists (select 1 from public.stores s
            where s.id = queues.store_id and s.owner_id = auth.uid())
  );

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 함수: 대기열 단위로 동작하도록 재정의                                       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- enqueue_party: store_code → queue_id. 번호/waiting_ahead는 대기열 단위.
drop function if exists public.enqueue_party(text, integer, text, text);
create function public.enqueue_party(
  p_queue_id     uuid,
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
  v_active    boolean;
  v_day       date := (now() at time zone 'Asia/Seoul')::date;
  v_day_start timestamptz := (v_day::timestamp at time zone 'Asia/Seoul');
  v_ticket    integer;
  v_token     text;
  v_entry_id  uuid;
  v_sort      timestamptz;
begin
  -- 대기열 → 매장, 활성 구독 + 대기열 활성 확인
  select q.store_id, q.is_active into v_store_id, v_active
  from public.queues q
  join public.subscriptions sub on sub.store_id = q.store_id
  where q.id = p_queue_id and sub.status in ('trialing','active')
  limit 1;

  if v_store_id is null or not coalesce(v_active, false) then
    raise exception 'queue_not_found_or_inactive' using errcode = 'P0001';
  end if;

  insert into public.queue_counters (queue_id, store_id, day, last_no)
  values (p_queue_id, v_store_id, v_day, 1)
  on conflict (queue_id, day)
    do update set last_no = public.queue_counters.last_no + 1
  returning last_no into v_ticket;

  insert into public.queue_entries (store_id, queue_id, ticket_no, party_size, customer_name, phone)
  values (v_store_id, p_queue_id, v_ticket, p_party_size, p_customer_name, nullif(p_phone, ''))
  returning id, queue_entries.access_token, queue_entries.sort_at
       into v_entry_id, v_token, v_sort;

  return query
  select v_entry_id, v_ticket, v_token,
    (select count(*)::int from public.queue_entries q2
      where q2.queue_id = p_queue_id and q2.status = 'waiting'
        and q2.sort_at < v_sort and q2.created_at >= v_day_start);
end;
$$;

-- get_entry_status: 대기열 이름 추가 + waiting_ahead 대기열 단위
drop function if exists public.get_entry_status(text);
create function public.get_entry_status(p_access_token text)
returns table (
  entry_id      uuid,
  store_name    text,
  queue_name    text,
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
  v_queue_id  uuid;
  v_created   timestamptz;
  v_sort      timestamptz;
  v_day_start timestamptz;
begin
  select e.queue_id, e.created_at, e.sort_at
    into v_queue_id, v_created, v_sort
  from public.queue_entries e
  where e.access_token = p_access_token;

  if v_queue_id is null then
    return;
  end if;

  v_day_start := ((v_created at time zone 'Asia/Seoul')::date::timestamp
                  at time zone 'Asia/Seoul');

  return query
  select e.id, s.name, qu.name, e.ticket_no, e.party_size, e.status,
    (select count(*)::int from public.queue_entries q2
      where q2.queue_id = v_queue_id and q2.status = 'waiting'
        and q2.sort_at < v_sort and q2.created_at >= v_day_start),
    e.defer_count
  from public.queue_entries e
  join public.stores s on s.id = e.store_id
  join public.queues qu on qu.id = e.queue_id
  where e.access_token = p_access_token;
end;
$$;

-- defer_my_entry: 미루기를 같은 대기열 안에서만
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
  v_id uuid; v_queue uuid; v_sort timestamptz; v_status text;
  v_defer integer; v_created timestamptz; v_day_start timestamptz;
  v_target timestamptz;
begin
  select id, queue_id, sort_at, status, defer_count, created_at
    into v_id, v_queue, v_sort, v_status, v_defer, v_created
  from public.queue_entries where access_token = p_access_token;

  if v_id is null then return 'not_found'; end if;
  if v_status <> 'waiting' then return 'not_waiting'; end if;
  if v_defer >= 2 then return 'limit'; end if;

  v_day_start := ((v_created at time zone 'Asia/Seoul')::date::timestamp
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
  where id = v_id;
  return 'deferred';
end;
$$;

-- 권한 재부여
revoke all on function public.enqueue_party(uuid, integer, text, text) from public;
grant execute on function public.enqueue_party(uuid, integer, text, text) to anon, authenticated;
revoke all on function public.get_entry_status(text) from public;
grant execute on function public.get_entry_status(text) to anon, authenticated;
revoke all on function public.defer_my_entry(text, integer) from public;
grant execute on function public.defer_my_entry(text, integer) to anon, authenticated;
