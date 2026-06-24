import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@qr/db";
import { env } from "../env";

/**
 * Supabase client for Server Components / Route Handlers. Reads & writes the
 * auth session via Next cookies so the session is shared with the browser
 * client (and, via the same cookie domain, with the admin app).
 */
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
          // Called from a Server Component (read-only cookies) — safe to ignore;
          // session refresh is handled by middleware.
        }
      },
    },
  });
}
