import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@qr/db";
import { env } from "../env";

/** Supabase client for Server Components / Route Handlers in the admin app. */
export async function getServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: {
          name: string;
          value: string;
          options?: Record<string, unknown>;
        }[],
      ) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Read-only cookie context (Server Component) — refresh handled in middleware.
        }
      },
    },
  });
}
