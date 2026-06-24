-- 데모 매장 (점주 미점유, owner_id null) + 활성 구독.
-- /q/DEMO01 로 손님 등록 흐름을 바로 검증할 수 있게 한다.
insert into public.stores (id, owner_id, name, store_code, address)
values (
  '00000000-0000-0000-0000-0000000000d1',
  null,
  '데모 카페',
  'DEMO01',
  '서울시 어딘가 1층'
)
on conflict (id) do nothing;

insert into public.subscriptions (store_id, plan, status, current_period_end)
values (
  '00000000-0000-0000-0000-0000000000d1',
  'pro',
  'active',
  now() + interval '30 days'
)
on conflict (store_id) do nothing;
