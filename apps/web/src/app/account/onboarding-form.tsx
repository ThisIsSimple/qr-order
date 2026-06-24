"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@qr/ui/components/button";
import { Input } from "@qr/ui/components/input";
import { Label } from "@qr/ui/components/label";
import { createStoreInputSchema } from "@qr/types";
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

    const { error } = await supabase.from("stores").insert({
      owner_id: user.id,
      name: parsed.data.name,
      address: parsed.data.address || null,
    });
    setSubmitting(false);

    if (error) {
      toast.error("매장 등록에 실패했습니다. 다시 시도해 주세요.");
      return;
    }
    toast.success("매장이 등록되었습니다!");
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
        <Label htmlFor="address">
          주소 <span className="text-muted-foreground">(선택)</span>
        </Label>
        <Input
          id="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="서울시 강남구 …"
          maxLength={200}
        />
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
        {submitting ? "등록 중…" : "매장 등록하고 시작하기"}
      </Button>
    </form>
  );
}
