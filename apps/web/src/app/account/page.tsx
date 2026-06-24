import QRCode from "qrcode";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@qr/ui/components/badge";
import { buttonVariants } from "@qr/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@qr/ui/components/card";
import { Logo } from "@qr/ui/components/logo";
import { PLAN_CATALOG, type Plan } from "@qr/types";
import { env } from "@/lib/env";
import { getServerSupabase } from "@/lib/supabase/server";
import { AddressCard } from "./address-card";
import { LogoutButton } from "./logout-button";
import { OnboardingForm } from "./onboarding-form";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // stores는 공개 SELECT(손님 /q 페이지용)이라 반드시 owner_id로 한정한다.
  const { data: store } = await supabase
    .from("stores")
    .select(
      "id, name, store_code, address, road_address, latitude, longitude, require_nearby, nearby_radius_m",
    )
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" aria-label="웨잇큐 홈">
          <Logo />
        </Link>
        <LogoutButton />
      </div>
      <header className="mb-8">
        <h1 className="text-xl font-bold">내 매장</h1>
        <p className="text-xs text-muted-foreground">{user.email}</p>
      </header>

      {store ? (
        <StoreDashboard storeId={store.id} store={store} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>매장 등록</CardTitle>
            <CardDescription>
              매장을 등록하면 QR 코드와 14일 무료 체험이 시작됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OnboardingForm />
          </CardContent>
        </Card>
      )}
    </main>
  );
}

async function StoreDashboard({
  storeId,
  store,
}: {
  storeId: string;
  store: {
    id: string;
    name: string;
    store_code: string;
    address: string | null;
    road_address: string | null;
    latitude: number | null;
    longitude: number | null;
    require_nearby: boolean;
    nearby_radius_m: number;
  };
}) {
  const supabase = await getServerSupabase();
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan, status, current_period_end")
    .eq("store_id", storeId)
    .maybeSingle();

  const queueUrl = `${env.webUrl}/q/${store.store_code}`;
  const qrDataUrl = await QRCode.toDataURL(queueUrl, {
    width: 480,
    margin: 2,
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{store.name}</CardTitle>
          <CardDescription>
            매장 코드 <span className="font-mono">{store.store_code}</span>
            {store.address ? ` · ${store.address}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href={env.adminUrl}
            className={buttonVariants({ size: "sm" })}
            target="_blank"
          >
            대기열 관리 대시보드 열기 ↗
          </Link>
        </CardContent>
      </Card>

      <AddressCard store={store} />

      <Card>
        <CardHeader>
          <CardTitle>손님용 QR 코드</CardTitle>
          <CardDescription>
            매장에 비치하세요. 스캔하면 대기 등록 화면으로 연결됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUrl}
            alt="매장 대기 등록 QR"
            className="size-56 rounded-lg border border-border"
          />
          <p className="break-all text-center text-xs text-muted-foreground">
            {queueUrl}
          </p>
          <a
            href={qrDataUrl}
            download={`qr-${store.store_code}.png`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            QR 이미지 다운로드
          </a>
        </CardContent>
      </Card>

      <SubscriptionCard sub={sub} />
    </div>
  );
}

function SubscriptionCard({
  sub,
}: {
  sub: {
    plan: string;
    status: string;
    current_period_end: string | null;
  } | null;
}) {
  const planInfo = sub ? PLAN_CATALOG[sub.plan as Plan] : undefined;
  const label =
    sub?.status === "active"
      ? "구독 중"
      : sub?.status === "trialing"
        ? "무료 체험 중"
        : sub?.status === "past_due"
          ? "결제 필요"
          : sub?.status === "canceled"
            ? "구독 취소됨"
            : "구독 없음";
  const variant =
    sub?.status === "active" || sub?.status === "trialing"
      ? "default"
      : "outline";
  const daysLeft =
    sub?.current_period_end != null
      ? Math.ceil(
          (new Date(sub.current_period_end).getTime() - Date.now()) /
            86400000,
        )
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          구독
          <Badge variant={variant as "default" | "outline"}>{label}</Badge>
        </CardTitle>
        <CardDescription>
          {planInfo
            ? `${planInfo.label} 플랜 · 월 ${planInfo.monthlyPriceKrw.toLocaleString("ko-KR")}원`
            : "플랜 정보 없음"}
          {daysLeft != null && daysLeft >= 0 && sub?.status === "trialing"
            ? ` · 체험 ${daysLeft}일 남음`
            : ""}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          💳 결제 연동(토스페이먼츠)은 준비 중입니다. 현재는 무료 체험으로 모든
          기능을 사용할 수 있어요.
        </div>
      </CardContent>
    </Card>
  );
}
