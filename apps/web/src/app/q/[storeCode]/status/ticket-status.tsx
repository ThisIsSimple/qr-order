"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@qr/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@qr/ui/components/card";
import { getBrowserSupabase } from "@/lib/supabase/client";

type EntryStatus = {
  entry_id: string;
  store_name: string;
  ticket_no: number;
  party_size: number;
  status: string;
  waiting_ahead: number;
};

const POLL_MS = 5000;

export function TicketStatus({
  token,
  storeCode,
}: {
  token: string;
  storeCode: string;
}) {
  const [entry, setEntry] = useState<EntryStatus | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");

  const fetchStatus = useCallback(async () => {
    const supabase = getBrowserSupabase();
    const { data, error } = await supabase.rpc("get_entry_status", {
      p_access_token: token,
    });
    if (error) return; // 일시적 오류는 다음 폴링에서 복구
    const row = data?.[0];
    if (!row) {
      setState("missing");
      return;
    }
    setEntry(row);
    setState("ok");
  }, [token]);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, POLL_MS);
    return () => clearInterval(id);
  }, [fetchStatus]);

  if (state === "loading") {
    return (
      <p className="text-center text-muted-foreground">
        대기 정보를 불러오는 중…
      </p>
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

  return (
    <div className="space-y-5">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">{entry.store_name}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {entry.party_size}명 대기
        </p>
      </div>

      <StatusPanel entry={entry} />

      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <span className="inline-block size-1.5 animate-pulse rounded-full bg-primary" />
        실시간 업데이트 중 · {POLL_MS / 1000}초마다 새로고침
      </div>
    </div>
  );
}

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
      <Card>
        <CardContent className="py-8 text-center">
          <Ticket no={entry.ticket_no} muted />
          <p className="mt-3 text-sm text-muted-foreground">
            착석이 완료되었습니다. 이용해 주셔서 감사합니다.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (entry.status === "canceled" || entry.status === "no_show") {
    const label = entry.status === "canceled" ? "취소됨" : "노쇼 처리됨";
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Ticket no={entry.ticket_no} muted />
          <p className="mt-3 text-sm text-muted-foreground">
            이 대기는 {label} 상태입니다.
          </p>
        </CardContent>
      </Card>
    );
  }

  // waiting
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
        {no}
      </p>
    </div>
  );
}
