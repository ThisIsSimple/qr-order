import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@qr/db";
import { env } from "@/lib/env";
import { getServerSupabase } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 매장 주소를 카카오 Local API로 좌표 변환해 stores를 갱신.
 * body: { storeId, address? } — address를 주면 주소+좌표를 함께(원자적으로) 갱신한다.
 * 지오코딩에 실패하면 좌표를 비워서, 새 주소에 옛 좌표가 남아
 * '근처 등록' 검증이 엉뚱한 위치로 동작하는 일을 막는다.
 * 좌표는 신뢰성을 위해 서버에서만(service_role) 기록한다. (어뷰징 방지 근거)
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    storeId?: unknown;
    address?: unknown;
  } | null;
  const storeId = typeof body?.storeId === "string" ? body.storeId : "";
  const newAddress =
    typeof body?.address === "string" ? body.address.trim().slice(0, 200) : null;
  if (!UUID_RE.test(storeId)) {
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

  const address = newAddress || store.address;
  if (!address) {
    return NextResponse.json({ error: "no_address" }, { status: 400 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const restKey = process.env.KAKAO_REST_API_KEY;
  if (!restKey || !serviceKey) {
    return NextResponse.json(
      { error: "geocoding_unavailable" },
      { status: 500 },
    );
  }
  const admin = createServiceRoleClient(env.supabaseUrl, serviceKey);

  // 지오코딩 실패 시: 주소는 반영하되 좌표를 비운다 (stale 좌표 방지)
  async function saveWithoutCoords(status: number, error: string) {
    const { error: dbError } = await admin
      .from("stores")
      .update({
        ...(newAddress ? { address: newAddress } : {}),
        latitude: null,
        longitude: null,
        road_address: null,
      })
      .eq("id", storeId);
    if (dbError) {
      return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }
    return NextResponse.json({ error, addressSaved: true }, { status });
  }

  let res: Response;
  try {
    res = await fetch(
      `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`,
      { headers: { Authorization: `KakaoAK ${restKey}` } },
    );
  } catch {
    return saveWithoutCoords(502, "geocoding_failed");
  }
  if (!res.ok) {
    return saveWithoutCoords(502, "geocoding_failed");
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
  const latitude = doc ? parseFloat(doc.y) : NaN;
  const longitude = doc ? parseFloat(doc.x) : NaN;
  if (!doc || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return saveWithoutCoords(422, "address_not_found");
  }

  const road_address =
    doc.road_address?.address_name ?? doc.address_name ?? address;

  const { error } = await admin
    .from("stores")
    .update({
      ...(newAddress ? { address: newAddress } : {}),
      latitude,
      longitude,
      road_address,
    })
    .eq("id", storeId);
  if (error) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ latitude, longitude, road_address });
}
