import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@qr/ui/components/logo";
import { buttonVariants } from "@qr/ui/components/button";
import { getServerSupabase } from "@/lib/supabase/server";
import { QueueManager } from "./queue-manager";

export const dynamic = "force-dynamic";

export default async function QueuesPage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: store } = await supabase
    .from("stores")
    .select("id, name")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!store) redirect("/");

  const { data: queues } = await supabase
    .from("queues")
    .select("*")
    .eq("store_id", store.id)
    .order("sort_order", { ascending: true });

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Logo />
            <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              관리자
            </span>
          </div>
          <Link
            href="/"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            대시보드
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold">대기열 설정</h1>
          <p className="text-xs text-muted-foreground">
            {store.name} · 손님이 등록 시 선택할 대기열을 관리합니다.
          </p>
        </div>
        <QueueManager storeId={store.id} initialQueues={queues ?? []} />
      </main>
    </div>
  );
}
