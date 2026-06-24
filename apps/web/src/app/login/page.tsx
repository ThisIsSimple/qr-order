import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@qr/ui/components/logo";
import { getServerSupabase } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/account");

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5">
      <Link href="/" aria-label="웨잇큐 홈" className="mb-6">
        <Logo size="lg" />
      </Link>
      <h1 className="text-2xl font-bold">로그인</h1>
      <p className="mt-1 mb-8 text-sm text-muted-foreground">
        매장 계정으로 로그인하세요.
      </p>
      <LoginForm />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        아직 계정이 없으신가요?{" "}
        <Link href="/signup" className="text-foreground underline">
          회원가입
        </Link>
      </p>
    </main>
  );
}
