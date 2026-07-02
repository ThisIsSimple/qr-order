"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@qr/ui/components/button";
import { Input } from "@qr/ui/components/input";
import { Label } from "@qr/ui/components/label";
import { createStoreInputSchema } from "@qr/types";
import { AddressSearchButton } from "@/components/address-search-button";
import { getBrowserSupabase } from "@/lib/supabase/client";

export function OnboardingForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = createStoreInputSchema.safeParse({ name, address });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.");
      return;
    }

    setSubmitting(true);
    const supabase = getBrowserSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/login");
      return;
    }

    const { data: created, error } = await supabase
      .from("stores")
      .insert({
        owner_id: user.id,
        name: parsed.data.name,
        address: parsed.data.address || null,
      })
      .select("id")
      .single();

    if (error || !created) {
      setSubmitting(false);
      toast.error("매장 등록에 실패했습니다. 다시 시도해 주세요.");
      return;
    }

    // 주소가 있으면 좌표 변환(지오코딩) — 실패해도 매장 등록은 유지하되 알려준다
    let geocoded = true;
    if (parsed.data.address) {
      const res = await fetch("/api/geocode-store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: created.id }),
      }).catch(() => null);
      geocoded = !!res?.ok;
    }

    setSubmitting(false);
    if (geocoded) {
      toast.success("매장이 등록되었습니다!");
    } else {
      toast.warning(
        "매장은 등록됐지만 주소의 좌표를 찾지 못했어요. 매장 위치에서 주소를 다시 검색해 주세요.",
      );
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">매장 이름</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예) 호미 카페 강남점"
          maxLength={60}
          required
        />
      </div>
      <div className="space-y-2">
        <Label>
          주소 <span className="text-muted-foreground">(선택)</span>
        </Label>
        {address ? (
          <div className="flex items-start justify-between gap-2 rounded-lg border border-border bg-card p-3 text-sm">
            <span className="flex items-start gap-1.5">
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
              {address}
            </span>
            <AddressSearchButton size="sm" onSelect={setAddress}>
              변경
            </AddressSearchButton>
          </div>
        ) : (
          <AddressSearchButton className="w-full" onSelect={setAddress}>
            주소 검색
          </AddressSearchButton>
        )}
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
        {submitting ? "등록 중…" : "매장 등록하고 시작하기"}
      </Button>
    </form>
  );
}
