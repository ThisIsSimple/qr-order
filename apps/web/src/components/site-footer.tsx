import { Logo } from "@qr/ui/components/logo";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <Logo size="sm" />
        <p>© 2026 웨잇큐 · QR 대기열 관리 서비스</p>
      </div>
    </footer>
  );
}
