import Link from "next/link";
import { Button } from "@qr/ui/components/button";
import { TicketStatus } from "./ticket-status";

export default async function StatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeCode: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { storeCode } = await params;
  const { token } = await searchParams;

  if (!token) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-5 text-center">
        <p className="text-muted-foreground">대기 정보를 찾을 수 없습니다.</p>
        <Button asChild variant="outline">
          <Link href={`/q/${storeCode}`}>대기 등록하기</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <TicketStatus token={token} storeCode={storeCode} />
    </main>
  );
}
