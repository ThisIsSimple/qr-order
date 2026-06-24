-- 매장 위치(지오코딩 좌표) + 위치기반 어뷰징 방지 설정
alter table public.stores
  add column latitude        double precision,
  add column longitude       double precision,
  add column road_address    text,
  add column require_nearby   boolean not null default false,
  add column nearby_radius_m  integer not null default 200;

-- 좌표/정규화주소는 서버(지오코딩, service_role)만 기록 가능하도록 컬럼 권한 제한.
-- (점주는 address/require_nearby/nearby_radius_m 등 다른 컬럼만 수정)
revoke update (latitude, longitude, road_address) on public.stores from anon, authenticated;
