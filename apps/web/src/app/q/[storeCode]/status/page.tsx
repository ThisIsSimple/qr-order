import Link from "next/link";
import { Button } from "@qr/ui/components/button";
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

  if (!token) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-5 text-center">
        <p className="text-muted-foreground">대기 정보를 찾을 수 없습니다.</p>
        <Button asChild variant="outline">
          <Link href={`/q/${storeCode}`}>대기 등록하기</Link>
        </Button>
      </main>
    );
  }

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
          <TicketStatus token={token} storeCode={storeCode} store={store ?? null} />
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
