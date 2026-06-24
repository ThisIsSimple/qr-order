import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@qr/db";
import { env } from "@/lib/env";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * 매장 주소를 카카오 Local API로 좌표 변환해 stores.lat/lng/road_address를 갱신.
 * 좌표는 신뢰성을 위해 서버에서만(service_role) 기록한다. (어뷰징 방지 근거)
 */
export async function POST(req: NextRequest) {
  const { storeId } = await req.json().catch(() => ({}) as { storeId?: string });
  if (!storeId) {
    return NextResponse.json({ error: "missing_store_id" }, { status: 400 });
  }

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: store } = await supabase
    .from("stores")
    .select("id, address, owner_id")
    .eq("id", storeId)
    .maybeSingle();
  if (!store || store.owner_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!store.address) {
    return NextResponse.json({ error: "no_address" }, { status: 400 });
  }

  const restKey = process.env.KAKAO_REST_API_KEY;
  if (!restKey) {
    return NextResponse.json({ error: "geocoding_unavailable" }, { status: 500 });
  }

  const res = await fetch(
    `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(store.address)}`,
    { headers: { Authorization: `KakaoAK ${restKey}` } },
  );
  if (!res.ok) {
    return NextResponse.json({ error: "geocoding_failed" }, { status: 502 });
  }
  const json = (await res.json()) as {
    documents?: Array<{
      x: string;
      y: string;
      address_name?: string;
      road_address?: { address_name?: string } | null;
    }>;
  };
  const doc = json.documents?.[0];
  if (!doc) {
    return NextResponse.json({ error: "address_not_found" }, { status: 422 });
  }

  const latitude = parseFloat(doc.y);
  const longitude = parseFloat(doc.x);
  const road_address =
    doc.road_address?.address_name ?? doc.address_name ?? store.address;

  const admin = createServiceRoleClient(
    env.supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const { error } = await admin
    .from("stores")
    .update({ latitude, longitude, road_address })
    .eq("id", storeId);
  if (error) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ latitude, longitude, road_address });
}
