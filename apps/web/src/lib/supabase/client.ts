"use client";

import { createBrowserClient } from "@qr/db";
import { env } from "../env";

/** Supabase client for client components / browser realtime subscriptions. */
export function getBrowserSupabase() {
  return createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
}
