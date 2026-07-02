"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@qr/ui/components/button";
import { Input } from "@qr/ui/components/input";
import { Label } from "@qr/ui/components/label";
import { getBrowserSupabase } from "@/lib/supabase/client";

export function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    setSubmitting(true);
    const supabase = getBrowserSupabase();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (error) {
      setSubmitting(false);
      toast.error(
        error.message.includes("invalid")
          ? "사용할 수 없는 이메일 주소입니다. 다른 이메일을 입력해 주세요."
          : "회원가입에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      );
      return;
    }

    // 이메일 확인이 꺼져 있으면 즉시 세션이 생성됨 → 바로 온보딩으로
    if (data.session) {
      setSubmitting(false);
      router.replace("/account");
      router.refresh();
      return;
    }

    // 이미 가입된 이메일: Supabase는 성공처럼 응답하지만 identities가 비어 있다
    if (data.user && data.user.identities?.length === 0) {
      setSubmitting(false);
      toast.error("이미 가입된 이메일입니다. 로그인해 주세요.");
      router.replace("/login");
      return;
    }

    setSubmitting(false);
    toast.success("가입되었습니다. 이메일 인증 후 로그인해 주세요.");
    router.replace("/login");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">이메일</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">비밀번호</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          placeholder="6자 이상"
          required
        />
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
        {submitting ? "가입 중…" : "회원가입"}
      </Button>
    </form>
  );
}
