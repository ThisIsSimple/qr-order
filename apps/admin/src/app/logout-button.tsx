"use client";

import { useRouter } from "next/navigation";
import { Button } from "@qr/ui/components/button";
import { getBrowserSupabase } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        await getBrowserSupabase().auth.signOut();
        router.replace("/login");
        router.refresh();
      }}
    >
      로그아웃
    </Button>
  );
}
