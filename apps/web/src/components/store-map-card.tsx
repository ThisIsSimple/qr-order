"use client";

import { Copy, MapPin } from "lucide-react";
import { Map, MapMarker, useKakaoLoader } from "react-kakao-maps-sdk";
import { toast } from "sonner";
import { Button } from "@qr/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@qr/ui/components/card";

export function StoreMapCard({
  address,
  latitude,
  longitude,
}: {
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}) {
  const appkey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY ?? "";
  const [loading, error] = useKakaoLoader({ appkey });
  const hasCoords = latitude != null && longitude != null;
  const showMap = hasCoords && !!appkey && !error && !loading;

  async function copyAddress() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      toast.success("주소를 복사했어요.");
    } catch {
      toast.error("주소 복사에 실패했어요.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-base">
          <MapPin className="size-4 text-primary" /> 오시는 길
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {showMap ? (
          <Map
            center={{ lat: latitude, lng: longitude }}
            level={3}
            className="h-48 w-full overflow-hidden rounded-lg"
            draggable={false}
            zoomable={false}
          >
            <MapMarker position={{ lat: latitude, lng: longitude }} />
          </Map>
        ) : (
          <div className="grid h-48 w-full place-items-center rounded-lg bg-muted text-xs text-muted-foreground">
            {hasCoords ? "지도를 불러오는 중…" : "위치가 등록되지 않았어요"}
          </div>
        )}
        {address && (
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm">{address}</p>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0"
              onClick={copyAddress}
            >
              <Copy className="size-3.5" /> 주소 복사
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
