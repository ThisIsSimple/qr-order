import { createBrowserClient as createSsrBrowserClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export type { Database, Json } from "./database.types";

/** Convenience row aliases used across apps. */
export type StoreRow = Database["public"]["Tables"]["stores"]["Row"];
export type QueueRow = Database["public"]["Tables"]["queues"]["Row"];
export type QueueEntryRow =
  Database["public"]["Tables"]["queue_entries"]["Row"];
export type SubscriptionRow =
  Database["public"]["Tables"]["subscriptions"]["Row"];

/** Browser (client component) Supabase client. Uses the public anon key. */
export function createBrowserClient(url: string, anonKey: string) {
  return createSsrBrowserClient<Database>(url, anonKey);
}

/**
 * Service-role client for trusted server contexts (Edge Functions, webhooks).
 * NEVER import this into a client component — the key bypasses RLS.
 */
export function createServiceRoleClient(url: string, serviceRoleKey: string) {
  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
