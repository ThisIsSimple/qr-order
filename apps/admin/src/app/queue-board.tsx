"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { formatTicketNo } from "@qr/types";
import type { QueueEntryRow } from "@qr/db";
import { Badge } from "@qr/ui/components/badge";
import { Button } from "@qr/ui/components/button";
import { Card, CardContent } from "@qr/ui/components/card";
import { getBrowserSupabase } from "@/lib/supabase/client";

const REFETCH_MS = 10000;

export function QueueBoard({
  storeId,
  dayStart,
  initialEntries,
}: {
  storeId: string;
  dayStart: string;
  initialEntries: QueueEntryRow[];
}) {
  const [entries, setEntries] = useState<QueueEntryRow[]>(initialEntries);
  const [busy, setBusy] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const supabase = getBrowserSupabase();
    const { data } = await supabase
      .from("queue_entries")
      .select("*")
      .eq("store_id", storeId)
      .gte("created_at", dayStart)
      .order("ticket_no", { ascending: true });
    if (data) setEntries(data);
  }, [storeId, dayStart]);

  // Realtime: 손님 신규 등록·상태 변경을 즉시 반영. 폴링은 안전망.
  useEffect(() => {
    const supabase = getBrowserSupabase();
    const channel = supabase
      .channel(`queue-${storeId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "queue_entries",
          filter: `store_id=eq.${storeId}`,
        },
        () => refetch(),
      )
      .subscribe();

    const id = setInterval(refetch, REFETCH_MS);
    return () => {
      clearInterval(id);
      supabase.removeChannel(channel);
    };
  }, [storeId, refetch]);

  async function act(
    entry: QueueEntryRow,
    action: "call" | "seat" | "cancel" | "no_show",
  ) {
    const patch: Partial<QueueEntryRow> =
      action === "call"
        ? { status: "called", called_at: new Date().toISOString() }
        : action === "seat"
          ? { status: "seated", seated_at: new Date().toISOString() }
          : action === "cancel"
            ? { status: "canceled" }
            : { status: "no_show" };

    setBusy(entry.id);
    // 낙관적 업데이트
    setEntries((prev) =>
      prev.map((e) => (e.id === entry.id ? { ...e, ...patch } : e)),
    );
    const supabase = getBrowserSupabase();
    const { error } = await supabase
      .from("queue_entries")
      .update(patch)
      .eq("id", entry.id);
    setBusy(null);

    if (error) {
      toast.error("처리에 실패했습니다. 다시 시도해 주세요.");
      refetch();
      return;
    }
    refetch();
  }

  const waiting = useMemo(
    () => entries.filter((e) => e.status === "waiting"),
    [entries],
  );
  const called = useMemo(
    () => entries.filter((e) => e.status === "called"),
    [entries],
  );
  const done = useMemo(
    () =>
      entries.filter((e) =>
        ["seated", "canceled", "no_show"].includes(e.status),
      ),
    [entries],
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="대기" value={waiting.length} />
        <Stat label="호출됨" value={called.length} />
        <Stat label="완료" value={done.length} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Column title="대기 중" count={waiting.length}>
          {waiting.length === 0 && <Empty>대기 중인 손님이 없습니다.</Empty>}
          {waiting.map((e) => (
            <EntryCard key={e.id} entry={e} busy={busy === e.id}>
              <Button size="sm" onClick={() => act(e, "call")}>
                호출
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => act(e, "cancel")}
              >
                취소
              </Button>
            </EntryCard>
          ))}
        </Column>

        <Column title="호출됨" count={called.length}>
          {called.length === 0 && <Empty>호출된 손님이 없습니다.</Empty>}
          {called.map((e) => (
            <EntryCard key={e.id} entry={e} busy={busy === e.id} highlight>
              <Button size="sm" onClick={() => act(e, "seat")}>
                착석
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => act(e, "no_show")}
              >
                노쇼
              </Button>
            </EntryCard>
          ))}
        </Column>
      </div>

      {done.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            완료 ({done.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {done.map((e) => (
              <span
                key={e.id}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground"
              >
                <span className="font-semibold tabular-nums">
                  {formatTicketNo(e.ticket_no)}
                </span>
                {e.customer_name}
                <StatusBadge status={e.status} />
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="py-4 text-center">
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function Column({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold">
        {title} <span className="text-muted-foreground">({count})</span>
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function EntryCard({
  entry,
  busy,
  highlight,
  children,
}: {
  entry: QueueEntryRow;
  busy: boolean;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className={highlight ? "border-primary" : undefined}>
      <CardContent className="flex items-center justify-between gap-3 py-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold tabular-nums">
            {formatTicketNo(entry.ticket_no)}
          </span>
          <div className="text-sm">
            <p className="font-medium">
              {entry.customer_name}{" "}
              <span className="text-muted-foreground">
                · {entry.party_size}명
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              {entry.phone ? `${maskPhone(entry.phone)} · ` : ""}
              {waitedMinutes(entry.created_at)}분 대기
            </p>
          </div>
        </div>
        <div
          className={`flex gap-1 ${busy ? "pointer-events-none opacity-50" : ""}`}
        >
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

const STATUS_LABEL: Record<string, string> = {
  waiting: "대기중",
  called: "호출됨",
  seated: "착석",
  canceled: "취소",
  no_show: "노쇼",
};

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "seated"
      ? "secondary"
      : status === "no_show" || status === "canceled"
        ? "outline"
        : "default";
  return (
    <Badge variant={variant as "secondary" | "outline" | "default"}>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

function maskPhone(phone: string): string {
  if (phone.length < 7) return phone;
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

function waitedMinutes(createdAt: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
}
