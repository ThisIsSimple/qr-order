import { notFound } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { EnqueueForm } from "./enqueue-form";

export default async function StoreQueuePage({
  params,
}: {
  params: Promise<{ storeCode: string }>;
}) {
  const { storeCode } = await params;
  const code = storeCode.toUpperCase();

  const supabase = await getServerSupabase();
  const { data: store } = await supabase
    .from("stores")
    .select("name, store_code")
    .eq("store_code", code)
    .maybeSingle();

  if (!store) notFound();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-8 text-center">
        <p className="text-sm text-muted-foreground">대기 등록</p>
        <h1 className="mt-1 text-2xl font-bold">{store.name}</h1>
      </div>
      <EnqueueForm storeCode={store.store_code} />
      <p className="mt-6 text-center text-xs text-muted-foreground">
        등록하시면 순번이 발급되고, 호출 시 화면으로 안내해 드립니다.
      </p>
    </main>
  );
}
