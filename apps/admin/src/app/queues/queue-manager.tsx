"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import { toast } from "sonner";
import type { QueueRow } from "@qr/db";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@qr/ui/components/alert-dialog";
import { Button } from "@qr/ui/components/button";
import { Card, CardContent } from "@qr/ui/components/card";
import { Input } from "@qr/ui/components/input";
import { Label } from "@qr/ui/components/label";
import { getBrowserSupabase } from "@/lib/supabase/client";

type NewQueue = { name: string; min: string; max: string };

export function QueueManager({
  storeId,
  initialQueues,
}: {
  storeId: string;
  initialQueues: QueueRow[];
}) {
  const [queues, setQueues] = useState<QueueRow[]>(initialQueues);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<NewQueue>({ name: "", min: "", max: "" });

  async function refetch() {
    const supabase = getBrowserSupabase();
    const { data } = await supabase
      .from("queues")
      .select("*")
      .eq("store_id", storeId)
      .order("sort_order", { ascending: true });
    if (data) setQueues(data);
  }

  const parseNum = (s: string) => (s.trim() === "" ? null : Number(s));

  async function addQueue(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.name.trim()) {
      toast.error("대기열 이름을 입력해 주세요.");
      return;
    }
    setBusy(true);
    const nextOrder = queues.length
      ? Math.max(...queues.map((q) => q.sort_order)) + 1
      : 0;
    const supabase = getBrowserSupabase();
    const { error } = await supabase.from("queues").insert({
      store_id: storeId,
      name: draft.name.trim(),
      min_party: parseNum(draft.min),
      max_party: parseNum(draft.max),
      sort_order: nextOrder,
    });
    setBusy(false);
    if (error) {
      toast.error("추가에 실패했어요.");
      return;
    }
    setDraft({ name: "", min: "", max: "" });
    toast.success("대기열을 추가했습니다.");
    refetch();
  }

  async function patch(id: string, values: Partial<QueueRow>) {
    setBusy(true);
    const supabase = getBrowserSupabase();
    const { error } = await supabase.from("queues").update(values).eq("id", id);
    setBusy(false);
    if (error) {
      toast.error("저장에 실패했어요.");
      return false;
    }
    refetch();
    return true;
  }

  async function move(index: number, dir: -1 | 1) {
    const other = index + dir;
    if (other < 0 || other >= queues.length) return;
    const a = queues[index]!;
    const b = queues[other]!;
    setBusy(true);
    const supabase = getBrowserSupabase();
    await supabase.from("queues").update({ sort_order: b.sort_order }).eq("id", a.id);
    await supabase.from("queues").update({ sort_order: a.sort_order }).eq("id", b.id);
    setBusy(false);
    refetch();
  }

  async function remove(id: string) {
    if (queues.length <= 1) {
      toast.error("최소 1개의 대기열이 필요합니다.");
      return;
    }
    setBusy(true);
    const supabase = getBrowserSupabase();
    const { error } = await supabase.from("queues").delete().eq("id", id);
    setBusy(false);
    if (error) {
      toast.error("삭제에 실패했어요.");
      return;
    }
    toast.success("대기열을 삭제했습니다.");
    refetch();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {queues.map((q, i) => (
          <QueueCard
            key={q.id}
            queue={q}
            index={i}
            total={queues.length}
            busy={busy}
            onSave={(name, min, max) =>
              patch(q.id, {
                name,
                min_party: min,
                max_party: max,
              })
            }
            onToggle={() => patch(q.id, { is_active: !q.is_active })}
            onMove={(dir) => move(i, dir)}
            onDelete={() => remove(q.id)}
          />
        ))}
      </div>

      <Card>
        <CardContent className="py-4">
          <form onSubmit={addQueue} className="space-y-3">
            <Label>대기열 추가</Label>
            <Input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="예) 2인석 대기"
              maxLength={40}
            />
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="numeric"
                value={draft.min}
                onChange={(e) => setDraft({ ...draft, min: e.target.value })}
                placeholder="최소 인원"
                className="w-32"
                min={1}
              />
              <span className="text-muted-foreground">~</span>
              <Input
                type="number"
                inputMode="numeric"
                value={draft.max}
                onChange={(e) => setDraft({ ...draft, max: e.target.value })}
                placeholder="최대 인원"
                className="w-32"
                min={1}
              />
              <span className="text-xs text-muted-foreground">인 (선택)</span>
            </div>
            <Button type="submit" disabled={busy} className="w-full">
              <Plus /> 추가
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function QueueCard({
  queue,
  index,
  total,
  busy,
  onSave,
  onToggle,
  onMove,
  onDelete,
}: {
  queue: QueueRow;
  index: number;
  total: number;
  busy: boolean;
  onSave: (name: string, min: number | null, max: number | null) => void;
  onToggle: () => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(queue.name);
  const [min, setMin] = useState(queue.min_party?.toString() ?? "");
  const [max, setMax] = useState(queue.max_party?.toString() ?? "");
  const dirty =
    name !== queue.name ||
    min !== (queue.min_party?.toString() ?? "") ||
    max !== (queue.max_party?.toString() ?? "");

  return (
    <Card className={queue.is_active ? undefined : "opacity-60"}>
      <CardContent className="space-y-3 py-4">
        <div className="flex items-start gap-2">
          <div className="flex flex-col">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={busy || index === 0}
              onClick={() => onMove(-1)}
              aria-label="위로"
            >
              <ChevronUp />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={busy || index === total - 1}
              onClick={() => onMove(1)}
              aria-label="아래로"
            >
              <ChevronDown />
            </Button>
          </div>
          <div className="flex-1 space-y-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
            />
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={min}
                onChange={(e) => setMin(e.target.value)}
                placeholder="최소"
                className="w-24"
                min={1}
              />
              <span className="text-muted-foreground">~</span>
              <Input
                type="number"
                value={max}
                onChange={(e) => setMax(e.target.value)}
                placeholder="최대"
                className="w-24"
                min={1}
              />
              <span className="text-xs text-muted-foreground">인</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={queue.is_active ? "outline" : "default"}
              size="sm"
              disabled={busy}
              onClick={onToggle}
            >
              {queue.is_active ? "비활성화" : "활성화"}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  disabled={busy}
                >
                  삭제
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>대기열을 삭제할까요?</AlertDialogTitle>
                  <AlertDialogDescription>
                    이 대기열과 관련된 대기 기록도 함께 삭제됩니다. 되돌릴 수
                    없어요.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>닫기</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    삭제
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          {dirty && (
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() =>
                onSave(
                  name.trim() || queue.name,
                  min.trim() === "" ? null : Number(min),
                  max.trim() === "" ? null : Number(max),
                )
              }
            >
              저장
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
