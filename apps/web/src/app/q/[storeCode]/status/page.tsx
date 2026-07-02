import { AdSlot } from "@/components/ad-slot";
import { StoreMapCard } from "@/components/store-map-card";
import { getServerSupabase } from "@/lib/supabase/server";
import { LiveMarquee } from "./live-marquee";
import { TicketStatus } from "./ticket-status";

export default async function StatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeCode: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { storeCode } = await params;
  const { token } = await searchParams;

  // token이 없어도 클라이언트가 sessionStorage에서 복원한다 (URL에서 토큰 제거 후 새로고침 대응)
  const supabase = await getServerSupabase();
  const { data: store } = await supabase
    .from("stores")
    .select("name, store_code, address, road_address, latitude, longitude")
    .eq("store_code", storeCode.toUpperCase())
    .maybeSingle();

  return (
    <>
      <LiveMarquee />
      <main className="mx-auto max-w-md px-5 pt-14 pb-12">
        <div className="py-4">
          <TicketStatus
            token={token ?? null}
            storeCode={storeCode}
            store={store ?? null}
          />
        </div>
        <div className="mt-4 space-y-4">
          <AdSlot />
          {store && (store.latitude != null || store.address) && (
            <StoreMapCard
              address={store.road_address || store.address}
              latitude={store.latitude}
              longitude={store.longitude}
            />
          )}
        </div>
      </main>
    </>
  );
}
