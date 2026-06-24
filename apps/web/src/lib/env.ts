/** Public env, available in both server and client bundles. */
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  webUrl: process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3100",
  adminUrl: process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3101",
};

if (!env.supabaseUrl || !env.supabaseAnonKey) {
  // Surface misconfiguration early during dev/build rather than at first query.
  console.warn(
    "[env] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set. Copy .env.example to .env.",
  );
}
