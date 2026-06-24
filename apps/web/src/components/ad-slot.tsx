"use client";

/**
 * 광고 슬롯 (플레이스홀더 + 예시 광고). 실제 광고 연동 전까지 예시 배너를 노출.
 */
export function AdSlot() {
  return (
    <a
      href="#"
      onClick={(e) => e.preventDefault()}
      className="relative block overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm"
      aria-label="광고"
    >
      <span className="absolute top-2 right-2 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
        광고
      </span>
      <div className="flex items-center gap-3">
        <div className="grid size-14 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 text-lg">
          🎁
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            기다리는 동안, 첫 주문 30% 할인!
          </p>
          <p className="truncate text-xs text-muted-foreground">
            웨잇큐 제휴 혜택 · 지금 받기
          </p>
        </div>
      </div>
    </a>
  );
}
