import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@qr/ui/components/logo";
import { getServerSupabase } from "@/lib/supabase/server";
import { SignupForm } from "./signup-form";

export default async function SignupPage() {
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
      <h1 className="text-2xl font-bold">무료로 시작하기</h1>
      <p className="mt-1 mb-8 text-sm text-muted-foreground">
        매장 계정을 만들고 QR 대기열을 시작하세요.
      </p>
      <SignupForm />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        이미 계정이 있으신가요?{" "}
        <Link href="/login" className="text-foreground underline">
          로그인
        </Link>
      </p>
    </main>
  );
}
