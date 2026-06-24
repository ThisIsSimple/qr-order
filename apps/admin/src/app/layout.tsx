import type { Metadata } from "next";
import { Toaster } from "@qr/ui/components/sonner";
import "@qr/ui/globals.css";

const PRETENDARD =
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css";

export const metadata: Metadata = {
  title: "웨잇큐 관리자 — 대기열 운영",
  description: "매장 대기열 운영 대시보드",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className="font-sans antialiased">
      <body>
        <link rel="stylesheet" href={PRETENDARD} precedence="default" />
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
