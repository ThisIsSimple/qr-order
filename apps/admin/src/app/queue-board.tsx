"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { formatTicketNo } from "@qr/types";
import type { QueueEntryRow } from "@qr/db";
import { Badge } from "@qr/ui/components/badge";
import { Button } from "@qr/ui/components/button";
import { Card, CardContent } from "@qr/ui/components/card";
import { cn } from "@qr/ui/lib/utils";
import { kstDayStartISO } from "@/lib/day";
import { getBrowserSupabase } from "@/lib/supabase/client";

const REFETCH_MS = 10000;

type QueueMeta = { id: string; name: string; sort_order: number };

export function QueueBoard({
  storeId,
  initialEntries,
  queues,
}: {
  storeId: string;
  initialEntries: QueueEntryRow[];
  queues: QueueMeta[];
}) {
  const [entries, setEntries] = useState<QueueEntryRow[]>(initialEntries);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const queueName = useMemo(
    () => new Map(queues.map((q) => [q.id, q.name])),
    [queues],
  );
  const queueOrder = useMemo(
    () => new Map(queues.map((q) => [q.id, q.sort_order])),
    [queues],
  );
  const multi = queues.length > 1;

  const refetch = useCallback(async () => {
    const supabase = getBrowserSupabase();
    // 하루 시작(KST)은 매번 다시 계산 — 자정을 넘겨 켜둔 태블릿에서도 오늘 기준 유지
    const { data } = await supabase
      .from("queue_entries")
      .select("*")
      .eq("store_id", storeId)
      .gte("created_at", kstDayStartISO())
      .order("sort_at", { ascending: true })
      .order("ticket_no", { ascending: true });
    if (data) setEntries(data);
  }, [storeId]);

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
      // 구독 확립/재연결 시점에 즉시 동기화 — 그 사이 놓친 이벤트를 캐치업
      .subscribe((status) => {
        if (status === "SUBSCRIBED") refetch();
      });

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
    setEntries((prev) =>
      prev.map((e) => (e.id === entry.id ? { ...e, ...patch } : e)),
    );
    const supabase = getBrowserSupabase();
    // CAS: 화면에 보이던 상태에서만 전환 — 다른 기기/손님 취소와의 경쟁에서
    // 착석된 팀을 취소하는 식의 덮어쓰기를 막는다
    const { data, error } = await supabase
      .from("queue_entries")
      .update(patch)
      .eq("id", entry.id)
      .eq("status", entry.status)
      .select("id");
    setBusy(null);
    if (error) {
      toast.error("처리에 실패했습니다. 다시 시도해 주세요.");
      refetch();
      return;
    }
    if (!data?.length) {
      toast.error("이미 다른 기기에서 처리된 손님이에요. 목록을 갱신합니다.");
      refetch();
      return;
    }
    refetch();
  }

  // 필터 + 대기열 순서 → 도착순 정렬
  const visible = useMemo(() => {
    const list =
      filter === "all" ? entries : entries.filter((e) => e.queue_id === filter);
    return [...list].sort((a, b) => {
      const qo =
        (queueOrder.get(a.queue_id) ?? 0) - (queueOrder.get(b.queue_id) ?? 0);
      if (qo !== 0) return qo;
      if (a.sort_at !== b.sort_at) return a.sort_at < b.sort_at ? -1 : 1;
      return a.ticket_no - b.ticket_no;
    });
  }, [entries, filter, queueOrder]);

  const waiting = visible.filter((e) => e.status === "waiting");
  const called = visible.filter((e) => e.status === "called");
  const done = visible.filter((e) =>
    ["seated", "canceled", "no_show"].includes(e.status),
  );

  const label = (e: QueueEntryRow) =>
    multi ? queueName.get(e.queue_id) : undefined;

  return (
    <div className="space-y-6">
      {multi && (
        <div className="flex flex-wrap gap-2">
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>
            전체
          </Chip>
          {queues.map((q) => (
            <Chip
              key={q.id}
              active={filter === q.id}
              onClick={() => setFilter(q.id)}
            >
              {q.name}
            </Chip>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Stat label="대기" value={waiting.length} tone="default" />
        <Stat label="호출됨" value={called.length} tone="primary" />
        <Stat label="완료" value={done.length} tone="muted" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Column title="대기 중" count={waiting.length}>
          {waiting.length === 0 && <Empty>대기 중인 손님이 없습니다.</Empty>}
          {waiting.map((e) => (
            <EntryCard key={e.id} entry={e} queueLabel={label(e)} busy={busy === e.id}>
              <Button size="sm" onClick={() => act(e, "call")}>
                호출
              </Button>
              <Button size="sm" variant="ghost" onClick={() => act(e, "cancel")}>
                취소
              </Button>
            </EntryCard>
          ))}
        </Column>

        <Column title="호출됨" count={called.length}>
          {called.length === 0 && <Empty>호출된 손님이 없습니다.</Empty>}
          {called.map((e) => (
            <EntryCard
              key={e.id}
              entry={e}
              queueLabel={label(e)}
              busy={busy === e.id}
              highlight
            >
              <Button size="sm" onClick={() => act(e, "seat")}>
                착석
              </Button>
              <Button size="sm" variant="ghost" onClick={() => act(e, "no_show")}>
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

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-sm transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "primary" | "muted";
}) {
  const active = tone === "primary" && value > 0;
  return (
    <Card className={active ? "bg-primary/5 ring-primary/40" : undefined}>
      <CardContent className="py-4 text-center">
        <p
          className={cn(
            "text-2xl font-bold tabular-nums",
            tone === "primary" && "text-primary",
            tone === "muted" && "text-muted-foreground",
          )}
        >
          {value}
        </p>
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
  queueLabel,
  busy,
  highlight,
  children,
}: {
  entry: QueueEntryRow;
  queueLabel?: string;
  busy: boolean;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  const waited = waitedMinutes(entry.created_at);
  const waitTone =
    waited >= 20
      ? "text-red-600 font-medium"
      : waited >= 10
        ? "text-amber-600"
        : "text-muted-foreground";

  return (
    <Card
      className={
        highlight ? "bg-primary/5 ring-primary/40" : undefined
      }
    >
      <CardContent className="flex items-center justify-between gap-3 py-3">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "text-2xl font-bold tabular-nums",
              highlight && "text-primary",
            )}
          >
            {formatTicketNo(entry.ticket_no)}
          </span>
          <div className="text-sm">
            {queueLabel && (
              <Badge variant="secondary" className="mb-1">
                {queueLabel}
              </Badge>
            )}
            <p className="font-medium">
              {entry.customer_name}{" "}
              <span className="text-muted-foreground">
                · {entry.party_size}명
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              {entry.phone ? `${maskPhone(entry.phone)} · ` : ""}
              <span className={waitTone}>{waited}분 대기</span>
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

const STATUS_TONE: Record<string, string> = {
  seated: "border-transparent bg-emerald-100 text-emerald-700",
  canceled: "border-transparent bg-muted text-muted-foreground",
  no_show: "border-transparent bg-red-100 text-red-700",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="secondary" className={STATUS_TONE[status]}>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

function maskPhone(phone: string): string {
  if (phone.length < 7) return phone;
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

function waitedMinutes(createdAt: string): number {
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000),
  );
}
