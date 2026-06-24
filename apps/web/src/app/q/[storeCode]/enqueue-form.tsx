"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { enqueueInputSchema } from "@qr/types";
import { cn } from "@qr/ui/lib/utils";
import { Button } from "@qr/ui/components/button";
import { Input } from "@qr/ui/components/input";
import { Label } from "@qr/ui/components/label";
import { getBrowserSupabase } from "@/lib/supabase/client";

type QueueOption = {
  id: string;
  name: string;
  description: string | null;
  min_party: number | null;
  max_party: number | null;
};

function capacityLabel(q: QueueOption): string | null {
  if (q.min_party && q.max_party) return `${q.min_party}~${q.max_party}인`;
  if (q.max_party) return `~${q.max_party}인`;
  if (q.min_party) return `${q.min_party}인 이상`;
  return null;
}

export function EnqueueForm({
  storeCode,
  queues,
}: {
  storeCode: string;
  queues: QueueOption[];
}) {
  const router = useRouter();
  const single = queues.length === 1;
  const [queueId, setQueueId] = useState(single ? queues[0]!.id : "");
  const [partySize, setPartySize] = useState(2);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

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
    const supabase = getBrowserSupabase();
    const { data, error } = await supabase.rpc("enqueue_party", {
      p_queue_id: parsed.data.queueId,
      p_party_size: parsed.data.partySize,
      p_customer_name: parsed.data.customerName,
      p_phone: parsed.data.phone ?? "",
    });
    setSubmitting(false);

    if (error || !data?.[0]) {
      toast.error("대기 등록에 실패했어요. 잠시 후 다시 시도해 주세요.");
      return;
    }

    router.push(`/q/${storeCode}/status?token=${data[0].access_token}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {single ? (
        <p className="text-center text-sm text-muted-foreground">
          {queues[0]!.name}
        </p>
      ) : (
        <div className="space-y-2">
          <Label>대기열 선택</Label>
          <div className="grid gap-2">
            {queues.map((q) => {
              const cap = capacityLabel(q);
              const selected = queueId === q.id;
              return (
                <button
                  type="button"
                  key={q.id}
                  onClick={() => setQueueId(q.id)}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors",
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
                </button>
              );
            })}
          </div>
        </div>
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
          <span className="text-muted-foreground">(선택 · 호출 알림용)</span>
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
        />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
        {submitting ? "등록 중…" : "대기 등록하기"}
      </Button>
    </form>
  );
}
