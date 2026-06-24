import Link from "next/link";
import { Button } from "@qr/ui/components/button";
import { PLAN_CATALOG, PLANS } from "@qr/types";

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-20">
      <section className="text-center">
        <p className="mb-4 inline-block rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">
          QR 스캔 한 번으로 대기 등록
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          줄 서지 않는 매장 대기 관리
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
          손님은 앱 설치 없이 QR을 찍어 직접 대기 등록하고, 매장은 실시간
          대시보드로 호출·착석을 관리합니다.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/signup">무료로 시작하기</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/login">로그인</Link>
          </Button>
        </div>
      </section>

      <section className="mt-24 grid gap-6 sm:grid-cols-2">
        {PLANS.map((plan) => {
          const info = PLAN_CATALOG[plan];
          return (
            <div
              key={plan}
              className="rounded-lg border border-border p-6 text-left"
            >
              <h3 className="text-lg font-semibold">{info.label}</h3>
              <p className="mt-2 text-3xl font-bold">
                {info.monthlyPriceKrw.toLocaleString("ko-KR")}원
                <span className="text-base font-normal text-muted-foreground">
                  {" "}
                  / 월
                </span>
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                하루 최대 {info.maxDailyEntries.toLocaleString("ko-KR")}팀 대기
                등록
              </p>
            </div>
          );
        })}
      </section>
    </main>
  );
}
