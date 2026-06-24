import { z } from "zod";

export const SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "canceled",
] as const;

export const subscriptionStatusSchema = z.enum(SUBSCRIPTION_STATUSES);
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;

/** 매장이 손님 등록을 받을 수 있는 활성 상태 집합 */
export const ACTIVE_SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  "trialing",
  "active",
];

export const PLANS = ["basic", "pro"] as const;
export const planSchema = z.enum(PLANS);
export type Plan = z.infer<typeof planSchema>;

/** 요금제 정의 (KRW, 월 정기결제) */
export const PLAN_CATALOG: Record<
  Plan,
  { label: string; monthlyPriceKrw: number; maxDailyEntries: number }
> = {
  basic: { label: "베이직", monthlyPriceKrw: 19000, maxDailyEntries: 100 },
  pro: { label: "프로", monthlyPriceKrw: 49000, maxDailyEntries: 1000 },
};
