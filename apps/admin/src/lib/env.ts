/** Public env, available in both server and client bundles. */
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  adminUrl: process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3001",
  webUrl: process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000",
};

if (!env.supabaseUrl || !env.supabaseAnonKey) {
  console.warn(
    "[env] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set. Copy .env.example to .env.",
  );
}
