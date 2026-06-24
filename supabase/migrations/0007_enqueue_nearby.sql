-- enqueue_party에 위치 기반 어뷰징 방지(근처 등록) 서버 검증 추가.
-- p_lat/p_lng(손님 위치) 선택 인자. 매장이 require_nearby면 거리(Haversine) 검증.
drop function if exists public.enqueue_party(uuid, integer, text, text);
create function public.enqueue_party(
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
set search_path = public
as $$
declare
  v_store_id       uuid;
  v_active         boolean;
  v_phone_required boolean;
  v_lat            double precision;
  v_lng            double precision;
  v_require_nearby boolean;
  v_radius         integer;
  v_dist           double precision;
  v_day       date := (now() at time zone 'Asia/Seoul')::date;
  v_day_start timestamptz := (v_day::timestamp at time zone 'Asia/Seoul');
  v_ticket    integer;
  v_token     text;
  v_entry_id  uuid;
  v_sort      timestamptz;
begin
  select q.store_id, q.is_active, q.phone_required,
         s.latitude, s.longitude, s.require_nearby, s.nearby_radius_m
    into v_store_id, v_active, v_phone_required,
         v_lat, v_lng, v_require_nearby, v_radius
  from public.queues q
  join public.subscriptions sub on sub.store_id = q.store_id
  join public.stores s on s.id = q.store_id
  where q.id = p_queue_id and sub.status in ('trialing','active')
  limit 1;

  if v_store_id is null or not coalesce(v_active, false) then
    raise exception 'queue_not_found_or_inactive' using errcode = 'P0001';
  end if;

  if v_phone_required and nullif(p_phone, '') is null then
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

revoke all on function public.enqueue_party(uuid, integer, text, text, double precision, double precision) from public;
grant execute on function public.enqueue_party(uuid, integer, text, text, double precision, double precision) to anon, authenticated;
