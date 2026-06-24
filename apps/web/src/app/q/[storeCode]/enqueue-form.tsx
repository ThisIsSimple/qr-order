"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { enqueueInputSchema } from "@qr/types";
import { cn } from "@qr/ui/lib/utils";
import { Button } from "@qr/ui/components/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@qr/ui/components/drawer";
import { Input } from "@qr/ui/components/input";
import { Label } from "@qr/ui/components/label";
import { getBrowserSupabase } from "@/lib/supabase/client";

type QueueOption = {
  id: string;
  name: string;
  description: string | null;
  min_party: number | null;
  max_party: number | null;
  phone_required: boolean;
};

function capacityLabel(q: QueueOption): string | null {
  if (q.min_party && q.max_party) return `${q.min_party}~${q.max_party}인`;
  if (q.max_party) return `~${q.max_party}인`;
  if (q.min_party) return `${q.min_party}인 이상`;
  return null;
}

type StoreGeo = {
  latitude: number | null;
  longitude: number | null;
  require_nearby: boolean;
  nearby_radius_m: number;
};

function getPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => reject(),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  });
}

function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function EnqueueForm({
  storeCode,
  queues,
  store,
}: {
  storeCode: string;
  queues: QueueOption[];
  store: StoreGeo;
}) {
  const router = useRouter();
  const single = queues.length === 1;
  const [queueId, setQueueId] = useState(single ? queues[0]!.id : "");
  // 대기열이 2개 이상이면 진입 즉시 선택 Drawer를 띄운다 (생각 단계 1개 제거).
  const [drawerOpen, setDrawerOpen] = useState(!single);
  const [partySize, setPartySize] = useState(2);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selectedQueue = queues.find((q) => q.id === queueId) ?? null;
  const phoneRequired = !!selectedQueue?.phone_required;

  function selectQueue(id: string) {
    setQueueId(id);
    setDrawerOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!queueId) {
      setDrawerOpen(true);
      return;
    }
    if (phoneRequired && !phone.trim()) {
      toast.error("이 대기열은 휴대폰 번호 입력이 필요해요.");
      return;
    }

    const parsed = enqueueInputSchema.safeParse({
      queueId,
      partySize,
      customerName: name,
      phone,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.");
      return;
    }

    setSubmitting(true);

    // 위치 기반 어뷰징 방지: 매장 근처에서만 등록 허용
    let coords: { lat: number; lng: number } | null = null;
    if (
      store.require_nearby &&
      store.latitude != null &&
      store.longitude != null
    ) {
      try {
        coords = await getPosition();
      } catch {
        setSubmitting(false);
        toast.error(
          "매장 근처인지 확인하기 위해 위치 권한이 필요해요. 허용 후 다시 시도해 주세요.",
        );
        return;
      }
      const dist = distanceMeters(
        coords.lat,
        coords.lng,
        store.latitude,
        store.longitude,
      );
      if (dist > store.nearby_radius_m) {
        setSubmitting(false);
        toast.error(
          `매장에서 약 ${Math.round(dist)}m 떨어져 있어요. 매장 근처(${store.nearby_radius_m}m 이내)에서 등록해 주세요.`,
        );
        return;
      }
    }

    const supabase = getBrowserSupabase();
    const { data, error } = await supabase.rpc("enqueue_party", {
      p_queue_id: parsed.data.queueId,
      p_party_size: parsed.data.partySize,
      p_customer_name: parsed.data.customerName,
      p_phone: parsed.data.phone ?? "",
      ...(coords ? { p_lat: coords.lat, p_lng: coords.lng } : {}),
    });
    setSubmitting(false);

    if (error || !data?.[0]) {
      const msg = error?.message ?? "";
      toast.error(
        msg.includes("too_far") || msg.includes("location_required")
          ? "매장 근처에서만 등록할 수 있어요."
          : msg.includes("phone_required")
            ? "이 대기열은 휴대폰 번호 입력이 필요해요."
            : "대기 등록에 실패했어요. 잠시 후 다시 시도해 주세요.",
      );
      return;
    }

    router.push(`/q/${storeCode}/status?token=${data[0].access_token}`);
  }

  // ── STEP 1: 대기열 2개 이상 & 미선택 → 대기열 선택만 ──────────────────────────
  if (!single && !queueId) {
    return (
      <>
        <div className="space-y-4">
          <p className="text-center text-sm text-muted-foreground">
            먼저 어떤 자리에서 기다리실지 선택해 주세요.
          </p>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full justify-between"
            onClick={() => setDrawerOpen(true)}
          >
            대기열 선택
            <ChevronDown className="opacity-60" />
          </Button>
        </div>
        <QueueDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          queues={queues}
          selectedId={queueId}
          onSelect={selectQueue}
        />
      </>
    );
  }

  // ── STEP 2 (또는 단일 대기열): 정보 입력 ─────────────────────────────────────
  const cap = selectedQueue ? capacityLabel(selectedQueue) : null;

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {single ? (
          <p className="text-center text-sm text-muted-foreground">
            {queues[0]!.name}
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex w-full items-center justify-between rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted"
          >
            <span>
              <span className="block text-xs text-muted-foreground">
                선택한 대기열
              </span>
              <span className="font-medium">
                {selectedQueue?.name}
                {cap && (
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    · {cap}
                  </span>
                )}
              </span>
            </span>
            <span className="text-sm text-primary">변경</span>
          </button>
        )}

        <div className="space-y-2">
          <Label>인원</Label>
          <div className="flex items-center justify-between rounded-lg border border-border p-2">
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              aria-label="인원 줄이기"
              disabled={partySize <= 1}
              onClick={() => setPartySize((n) => Math.max(1, n - 1))}
            >
              <Minus />
            </Button>
            <span className="text-2xl font-semibold tabular-nums">
              {partySize}
              <span className="ml-1 text-base font-normal text-muted-foreground">
                명
              </span>
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              aria-label="인원 늘리기"
              disabled={partySize >= 50}
              onClick={() => setPartySize((n) => Math.min(50, n + 1))}
            >
              <Plus />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">이름</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="홍길동"
            autoComplete="name"
            maxLength={40}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">
            휴대폰 번호{" "}
            {phoneRequired ? (
              <span className="text-destructive">*</span>
            ) : (
              <span className="text-muted-foreground">
                (선택 · 호출 알림용)
              </span>
            )}
          </Label>
          <Input
            id="phone"
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="01012345678"
            autoComplete="tel"
            maxLength={11}
            required={phoneRequired}
          />
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? "등록 중…" : "대기 등록하기"}
        </Button>
      </form>

      {!single && (
        <QueueDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          queues={queues}
          selectedId={queueId}
          onSelect={selectQueue}
        />
      )}
    </>
  );
}

function QueueDrawer({
  open,
  onOpenChange,
  queues,
  selectedId,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  queues: QueueOption[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>대기열 선택</DrawerTitle>
          <DrawerDescription>등록할 대기열을 선택해 주세요.</DrawerDescription>
        </DrawerHeader>
        <div className="grid gap-2 px-4 pb-8">
          {queues.map((q) => {
            const cap = capacityLabel(q);
            const selected = selectedId === q.id;
            return (
              <button
                type="button"
                key={q.id}
                onClick={() => onSelect(q.id)}
                className={cn(
                  "rounded-lg border p-4 text-left transition-colors",
                  selected
                    ? "border-primary ring-2 ring-primary/30"
                    : "border-border hover:bg-muted",
                )}
              >
                <p className="font-medium">
                  {q.name}
                  {cap && (
                    <span className="ml-1 text-sm font-normal text-muted-foreground">
                      · {cap}
                    </span>
                  )}
                </p>
                {q.description && (
                  <p className="text-xs text-muted-foreground">
                    {q.description}
                  </p>
                )}
                {q.phone_required && (
                  <p className="mt-1 text-xs text-primary">휴대폰 번호 필수</p>
                )}
              </button>
            );
          })}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
