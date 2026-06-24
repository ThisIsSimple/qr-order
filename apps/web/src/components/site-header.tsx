import Link from "next/link";
import { Logo } from "@qr/ui/components/logo";
import { buttonVariants } from "@qr/ui/components/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
        <Link href="/" aria-label="웨잇큐 홈">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1">
          <Link
            href="/login"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            로그인
          </Link>
          <Link href="/signup" className={buttonVariants({ size: "sm" })}>
            무료로 시작하기
          </Link>
        </nav>
      </div>
    </header>
  );
}
