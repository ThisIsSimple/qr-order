import { z } from "zod";

/** 대기 엔트리 상태 머신: waiting → called → seated | (canceled | no_show) */
export const QUEUE_STATUSES = [
  "waiting",
  "called",
  "seated",
  "canceled",
  "no_show",
] as const;

export const queueStatusSchema = z.enum(QUEUE_STATUSES);
export type QueueStatus = z.infer<typeof queueStatusSchema>;

/** 손님이 /q/[storeCode]에서 제출하는 등록 폼 */
export const enqueueInputSchema = z.object({
  storeCode: z.string().min(1),
  partySize: z.coerce.number().int().min(1).max(50),
  customerName: z.string().trim().min(1).max(40),
  phone: z
    .string()
    .trim()
    .regex(/^01[016789]\d{7,8}$/, "올바른 휴대폰 번호를 입력해 주세요")
    .optional()
    .or(z.literal("")),
});
export type EnqueueInput = z.infer<typeof enqueueInputSchema>;

/** enqueue Edge Function 응답 — access_token으로 손님이 자기 순번만 조회 */
export const enqueueResultSchema = z.object({
  entryId: z.string().uuid(),
  ticketNo: z.number().int(),
  accessToken: z.string(),
  waitingAhead: z.number().int().nonnegative(),
});
export type EnqueueResult = z.infer<typeof enqueueResultSchema>;

/** 관리자 대시보드의 상태 전환 액션 */
export const queueActionSchema = z.object({
  entryId: z.string().uuid(),
  action: z.enum(["call", "seat", "cancel", "no_show"]),
});
export type QueueAction = z.infer<typeof queueActionSchema>;

/** 상태 전환 시 기록할 타임스탬프 컬럼 매핑 */
export const ACTION_TO_STATUS: Record<
  QueueAction["action"],
  QueueStatus
> = {
  call: "called",
  seat: "seated",
  cancel: "canceled",
  no_show: "no_show",
};
