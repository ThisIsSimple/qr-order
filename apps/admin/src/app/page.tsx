import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@qr/ui/components/logo";
import { buttonVariants } from "@qr/ui/components/button";
import { getServerSupabase } from "@/lib/supabase/server";
import { kstDayStartISO } from "@/lib/day";
import { QueueBoard } from "./queue-board";
import { LogoutButton } from "./logout-button";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 점주의 매장. stores는 공개 SELECT(손님 /q 페이지용)이라 반드시 owner_id로 한정한다.
  const { data: store } = await supabase
    .from("stores")
    .select("id, name, store_code")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!store) {
    return (
      <main className="mx-auto max-w-md px-5 py-24 text-center">
        <h1 className="text-xl font-bold">등록된 매장이 없습니다</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          홈페이지에서 매장을 먼저 등록해 주세요. (구독/매장 등록은 추후 제공)
        </p>
        <div className="mt-6">
          <LogoutButton />
        </div>
      </main>
    );
  }

  const { data: queues } = await supabase
    .from("queues")
    .select("id, name, sort_order")
    .eq("store_id", store.id)
    .order("sort_order", { ascending: true });

  const dayStart = kstDayStartISO();
  const { data: entries } = await supabase
    .from("queue_entries")
    .select("*")
    .eq("store_id", store.id)
    .gte("created_at", dayStart)
    .order("sort_at", { ascending: true })
    .order("ticket_no", { ascending: true });

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Logo />
            <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              관리자
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/queues"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              대기열 설정
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold">{store.name}</h1>
          <p className="text-xs text-muted-foreground">코드 {store.store_code}</p>
        </div>

        <QueueBoard
          storeId={store.id}
          dayStart={dayStart}
          initialEntries={entries ?? []}
          queues={queues ?? []}
        />
      </div>
    </div>
  );
}
