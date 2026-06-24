import { redirect } from "next/navigation";
import { Logo } from "@qr/ui/components/logo";
import { getServerSupabase } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5">
      <div className="mb-8 flex flex-col items-center text-center">
        <Logo size="lg" />
        <p className="mt-4 text-sm text-muted-foreground">
          관리자 · 매장 계정으로 로그인하세요
        </p>
      </div>
      <LoginForm />
    </main>
  );
}
