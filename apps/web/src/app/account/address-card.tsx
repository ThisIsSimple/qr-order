"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@qr/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@qr/ui/components/card";
import { cn } from "@qr/ui/lib/utils";
import { AddressSearchButton } from "@/components/address-search-button";
import { getBrowserSupabase } from "@/lib/supabase/client";

type StoreLoc = {
  id: string;
  address: string | null;
  road_address: string | null;
  latitude: number | null;
  longitude: number | null;
  require_nearby: boolean;
  nearby_radius_m: number;
};

const RADII = [100, 200, 500];

export function AddressCard({ store }: { store: StoreLoc }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const located = store.latitude != null && store.longitude != null;

  async function saveAddress(address: string) {
    setBusy(true);
    // 주소+좌표는 서버 라우트에서 함께 갱신한다 (실패 시 옛 좌표가 남지 않도록)
    const res = await fetch("/api/geocode-store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId: store.id, address }),
    }).catch(() => null);
    const result = res
      ? ((await res.json().catch(() => null)) as {
          addressSaved?: boolean;
        } | null)
      : null;
    setBusy(false);
    if (!res || (!res.ok && !result?.addressSaved)) {
      toast.error("주소 저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
      return;
    }
    if (!res.ok) {
      toast.error(
        "주소는 저장했지만 좌표를 찾지 못했어요. 도로명 주소로 다시 검색해 주세요.",
      );
      router.refresh();
      return;
    }
    toast.success("매장 위치가 등록되었습니다.");
    router.refresh();
  }

  async function patch(values: Partial<StoreLoc>) {
    setBusy(true);
    const supabase = getBrowserSupabase();
    const { error } = await supabase
      .from("stores")
      .update(values)
      .eq("id", store.id);
    setBusy(false);
    if (error) {
      toast.error("설정 저장에 실패했어요.");
      return;
    }
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>매장 위치</CardTitle>
        <CardDescription>
          손님 화면의 지도 표시와 &lsquo;근처에서만 등록&rsquo; 확인에 사용됩니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {store.address ? (
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
            <p className="flex items-start gap-1.5">
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
              {store.road_address || store.address}
            </p>
            <p
              className={cn(
                "mt-1.5 text-xs",
                located ? "text-emerald-600" : "text-amber-600",
              )}
            >
              {located ? "✓ 좌표가 등록되어 지도·근처 확인을 쓸 수 있어요" : "좌표 미등록 — 주소를 다시 검색해 주세요"}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            주소가 등록되지 않았습니다.
          </p>
        )}

        <AddressSearchButton
          variant="outline"
          className="w-full"
          disabled={busy}
          onSelect={saveAddress}
        >
          {store.address ? "주소 변경" : "주소 등록"}
        </AddressSearchButton>

        {/* 위치 기반 어뷰징 방지 */}
        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">근처에서만 대기 등록 허용</p>
              <p className="text-xs text-muted-foreground">
                손님 위치를 확인해 매장 근처에서만 등록을 받습니다.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant={store.require_nearby ? "default" : "outline"}
              disabled={busy || !located}
              onClick={() => patch({ require_nearby: !store.require_nearby })}
            >
              {store.require_nearby ? "켜짐" : "꺼짐"}
            </Button>
          </div>
          {!located && (
            <p className="text-xs text-muted-foreground">
              먼저 주소를 등록해 좌표가 있어야 켤 수 있어요.
            </p>
          )}
          {store.require_nearby && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">허용 반경</span>
              {RADII.map((r) => (
                <Button
                  key={r}
                  type="button"
                  size="sm"
                  variant={store.nearby_radius_m === r ? "default" : "outline"}
                  disabled={busy}
                  onClick={() => patch({ nearby_radius_m: r })}
                >
                  {r}m
                </Button>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
