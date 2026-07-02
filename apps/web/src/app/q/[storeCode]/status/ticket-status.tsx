"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Store } from "lucide-react";
import { toast } from "sonner";
import { formatTicketNo } from "@qr/types";
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@qr/ui/components/card";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@qr/ui/components/item";
import { getBrowserSupabase } from "@/lib/supabase/client";

type EntryStatus = {
  entry_id: string;
  store_name: string;
  queue_name: string;
  ticket_no: number;
  party_size: number;
  status: string;
  waiting_ahead: number;
  defer_count: number;
};

type StoreInfo = {
  name: string;
  store_code: string;
  address: string | null;
};

const POLL_MS = 5000;
const MAX_DEFER = 2;

const TERMINAL_STATUSES = ["seated", "canceled", "no_show"];

export function TicketStatus({
  token: serverToken,
  storeCode,
  store,
}: {
  token: string | null;
  storeCode: string;
  store: StoreInfo | null;
}) {
  const [token, setToken] = useState<string | null>(serverToken);
  const [entry, setEntry] = useState<EntryStatus | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing" | "error">(
    "loading",
  );
  const [acting, setActing] = useState(false);
  const seqRef = useRef(0);
  const failsRef = useRef(0);

  // 토큰은 취소/미루기 권한까지 가진 자격증명 — URL에 남기지 않는다.
  // 최초 진입 시 sessionStorage로 옮기고 쿼리에서 제거, 새로고침이면 복원.
  useEffect(() => {
    const key = `wq-token-${storeCode.toUpperCase()}`;
    try {
      if (serverToken) {
        sessionStorage.setItem(key, serverToken);
        const url = new URL(window.location.href);
        if (url.searchParams.has("token")) {
          url.searchParams.delete("token");
          window.history.replaceState(null, "", url.toString());
        }
      } else {
        const saved = sessionStorage.getItem(key);
        if (saved) setToken(saved);
        else setState("missing");
      }
    } catch {
      if (!serverToken) setState("missing");
    }
  }, [serverToken, storeCode]);

  const fetchStatus = useCallback(async () => {
    if (!token) return;
    const seq = ++seqRef.current;
    const supabase = getBrowserSupabase();
    const { data, error } = await supabase.rpc("get_entry_status", {
      p_access_token: token,
    });
    if (seq !== seqRef.current) return; // 늦게 도착한 이전 응답은 버린다
    if (error) {
      failsRef.current += 1;
      // 첫 화면조차 못 그린 채 연속 실패하면 에러 안내로 전환 (폴링은 계속)
      if (failsRef.current >= 3) {
        setState((s) => (s === "loading" ? "error" : s));
      }
      return;
    }
    failsRef.current = 0;
    const row = data?.[0];
    if (!row) {
      setState("missing");
      return;
    }
    setEntry(row);
    setState("ok");
  }, [token]);

  const terminal =
    state === "missing" ||
    (entry != null && TERMINAL_STATUSES.includes(entry.status));

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (terminal) return; // 착석/취소/노쇼면 더 폴링하지 않는다
    const id = setInterval(fetchStatus, POLL_MS);
    return () => clearInterval(id);
  }, [fetchStatus, terminal]);

  async function handleCancel() {
    if (!token) return;
    setActing(true);
    const supabase = getBrowserSupabase();
    const { data, error } = await supabase.rpc("cancel_my_entry", {
      p_access_token: token,
    });
    setActing(false);
    if (error || data === "not_found") {
      toast.error("취소에 실패했어요. 다시 시도해 주세요.");
      return;
    }
    if (data === "canceled") {
      toast.success("대기를 취소했습니다.");
    } else {
      toast(`이미 처리된 대기예요. (${STATUS_WORD[data ?? ""] ?? data})`);
    }
    fetchStatus();
  }

  async function handleDefer() {
    if (!token) return;
    setActing(true);
    const supabase = getBrowserSupabase();
    const { data, error } = await supabase.rpc("defer_my_entry", {
      p_access_token: token,
      p_teams: 2,
    });
    setActing(false);
    if (error || data === "not_found") {
      toast.error("처리에 실패했어요. 다시 시도해 주세요.");
      return;
    }
    if (data === "limit") {
      toast.error(`미루기는 최대 ${MAX_DEFER}회까지 가능해요.`);
    } else if (data === "no_teams_behind") {
      toast("뒤에 대기 중인 팀이 없어요.");
    } else if (data === "not_waiting") {
      toast("지금은 미룰 수 없어요. 이미 호출되었을 수 있어요.");
    } else if (data === "deferred") {
      toast.success("뒤로 2팀 미뤘어요.");
    }
    fetchStatus();
  }

  if (state === "loading") {
    return (
      <p className="text-center text-muted-foreground">
        대기 정보를 불러오는 중…
      </p>
    );
  }

  if (state === "error") {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-muted-foreground">
          연결이 불안정해 대기 정보를 불러오지 못했어요.
        </p>
        <Button
          variant="outline"
          onClick={() => {
            setState("loading");
            failsRef.current = 0;
            fetchStatus();
          }}
        >
          다시 시도
        </Button>
      </div>
    );
  }

  if (state === "missing" || !entry) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-muted-foreground">
          유효하지 않은 대기 정보예요. 다시 등록해 주세요.
        </p>
        <Button asChild variant="outline">
          <Link href={`/q/${storeCode}`}>대기 등록하기</Link>
        </Button>
      </div>
    );
  }

  const storeName = store?.name ?? entry.store_name;
  const canDefer = entry.status === "waiting";
  const canCancel = entry.status === "waiting" || entry.status === "called";
  const deferLeft = MAX_DEFER - entry.defer_count;

  return (
    <div className="space-y-5">
      <Item variant="outline" size="default" className="bg-card shadow-sm">
        <ItemMedia variant="icon">
          <Store className="text-primary" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle className="text-lg">{storeName}</ItemTitle>
          <ItemDescription>
            {entry.queue_name} · {entry.party_size}명 대기
          </ItemDescription>
        </ItemContent>
      </Item>

      <StatusPanel entry={entry} />

      {(canDefer || canCancel) && (
        <div className="flex flex-col gap-2">
          {canDefer && (
            <Button
              variant="outline"
              size="lg"
              disabled={acting || deferLeft <= 0}
              onClick={handleDefer}
            >
              {deferLeft > 0
                ? `잠시 미루기 · 뒤로 2팀 (남은 ${deferLeft}회)`
                : "미루기 모두 사용 (2/2)"}
            </Button>
          )}
          {canCancel && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="lg"
                  className="text-destructive hover:text-destructive"
                  disabled={acting}
                >
                  대기 취소
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>대기를 취소할까요?</AlertDialogTitle>
                  <AlertDialogDescription>
                    취소하면 순번이 사라지며 되돌릴 수 없어요. 다시 대기하려면
                    처음부터 등록해야 합니다.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>닫기</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleCancel}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    대기 취소
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      )}

      {!terminal && (
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <span className="inline-block size-1.5 animate-pulse rounded-full bg-primary" />
          실시간 업데이트 중
        </div>
      )}
    </div>
  );
}

const STATUS_WORD: Record<string, string> = {
  seated: "착석",
  canceled: "취소",
  no_show: "노쇼",
};

function StatusPanel({ entry }: { entry: EntryStatus }) {
  if (entry.status === "called") {
    return (
      <Card className="border-primary bg-primary/5">
        <CardHeader>
          <CardTitle className="text-center text-xl text-primary">
            입장해 주세요! 🎉
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <Ticket no={entry.ticket_no} />
          <p className="mt-3 text-sm text-muted-foreground">
            호출되었습니다. 매장 직원에게 번호를 보여주세요.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (entry.status === "seated") {
    return (
      <Card className="bg-emerald-50/60 ring-emerald-200">
        <CardHeader>
          <CardTitle className="text-center text-xl text-emerald-700">
            착석 완료 ✓
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <Ticket no={entry.ticket_no} muted />
          <p className="mt-3 text-sm text-muted-foreground">
            이용해 주셔서 감사합니다.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (entry.status === "canceled" || entry.status === "no_show") {
    const label = entry.status === "canceled" ? "취소됨" : "노쇼 처리됨";
    return (
      <Card className="bg-muted/40 ring-border">
        <CardContent className="py-8 text-center">
          <Ticket no={entry.ticket_no} muted />
          <p className="mt-3 text-sm text-muted-foreground">
            이 대기는 {label} 상태입니다.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="py-8 text-center">
        <Ticket no={entry.ticket_no} />
        <p className="mt-4 text-lg">
          {entry.waiting_ahead === 0 ? (
            <span className="font-semibold text-primary">곧 입장이에요</span>
          ) : (
            <>
              앞에{" "}
              <span className="font-semibold text-foreground">
                {entry.waiting_ahead}팀
              </span>{" "}
              대기 중
            </>
          )}
        </p>
      </CardContent>
    </Card>
  );
}

function Ticket({ no, muted }: { no: number; muted?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">대기 번호</p>
      <p
        className={`text-6xl font-bold tabular-nums ${
          muted ? "text-muted-foreground" : "text-foreground"
        }`}
      >
        {formatTicketNo(no)}
      </p>
    </div>
  );
}
