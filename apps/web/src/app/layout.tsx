import type { Metadata } from "next";
import { Toaster } from "@qr/ui/components/sonner";
import "@qr/ui/globals.css";

const PRETENDARD =
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css";

export const metadata: Metadata = {
  title: "웨잇큐 — 줄서지 않는 QR 대기 관리",
  description:
    "QR 코드 하나로 손님이 직접 대기 등록하고, 매장은 실시간으로 대기열을 운영하세요.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className="font-sans antialiased">
      <body>
        {/* React 19 hoists this stylesheet into <head> */}
        <link rel="stylesheet" href={PRETENDARD} precedence="default" />
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
