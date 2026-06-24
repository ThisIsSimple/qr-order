import { z } from "zod";

/** 매장 생성 폼 (홈페이지 onboarding) */
export const createStoreInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
  address: z.string().trim().max(200).optional(),
});
export type CreateStoreInput = z.infer<typeof createStoreInputSchema>;

/** stores.settings(jsonb) 구조 */
export const storeSettingsSchema = z.object({
  /** 호출 시 손님에게 SMS/알림톡 발송 여부 */
  notifyOnCall: z.boolean().default(true),
  /** 팀당 예상 대기시간(분) — 손님 화면 표기용 추정치 */
  avgMinutesPerParty: z.number().int().min(0).max(120).default(10),
});
export type StoreSettings = z.infer<typeof storeSettingsSchema>;

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  notifyOnCall: true,
  avgMinutesPerParty: 10,
};
