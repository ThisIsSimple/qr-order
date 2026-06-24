-- 프로토타입: 매장 생성 시 14일 trialing 구독을 자동 생성한다.
-- (결제 연동 전까지 신규 매장이 바로 대기열을 운영할 수 있도록.)
-- 추후 토스페이먼츠 연동 시 결제 성공 웹훅에서 status를 active로 갱신.
create or replace function public.create_default_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.subscriptions (store_id, plan, status, current_period_end)
  values (new.id, 'basic', 'trialing', now() + interval '14 days')
  on conflict (store_id) do nothing;
  return new;
end;
$$;

drop trigger if exists stores_default_subscription on public.stores;
create trigger stores_default_subscription
  after insert on public.stores
  for each row
  execute function public.create_default_subscription();

-- 점주가 자기 매장의 구독을 갱신할 수 있도록 UPDATE 정책 추가
-- (프로토타입 '구독 활성화' 토글용; 실제 결제 연동 시 웹훅(service_role)이 주로 갱신)
drop policy if exists subs_update_own on public.subscriptions;
create policy subs_update_own on public.subscriptions
  for update using (
    exists (select 1 from public.stores s
            where s.id = subscriptions.store_id and s.owner_id = auth.uid())
  );
