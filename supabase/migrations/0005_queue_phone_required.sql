-- 대기열별 '휴대폰 번호 필수' 옵션
alter table public.queues
  add column phone_required boolean not null default false;

-- enqueue_party: 대기열이 휴대폰 필수면 서버에서도 검증 (클라 + 서버 이중)
create or replace function public.enqueue_party(
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
  v_store_id       uuid;
  v_active         boolean;
  v_phone_required boolean;
  v_day       date := (now() at time zone 'Asia/Seoul')::date;
  v_day_start timestamptz := (v_day::timestamp at time zone 'Asia/Seoul');
  v_ticket    integer;
  v_token     text;
  v_entry_id  uuid;
  v_sort      timestamptz;
begin
  select q.store_id, q.is_active, q.phone_required
    into v_store_id, v_active, v_phone_required
  from public.queues q
  join public.subscriptions sub on sub.store_id = q.store_id
  where q.id = p_queue_id and sub.status in ('trialing','active')
  limit 1;

  if v_store_id is null or not coalesce(v_active, false) then
    raise exception 'queue_not_found_or_inactive' using errcode = 'P0001';
  end if;

  if v_phone_required and nullif(p_phone, '') is null then
    raise exception 'phone_required' using errcode = 'P0001';
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

revoke all on function public.enqueue_party(uuid, integer, text, text) from public;
grant execute on function public.enqueue_party(uuid, integer, text, text) to anon, authenticated;
