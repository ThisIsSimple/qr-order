"use client";

import { Button } from "@qr/ui/components/button";

const SCRIPT_SRC =
  "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

type PostcodeData = {
  roadAddress?: string;
  jibunAddress?: string;
  address?: string;
};

type DaumPostcode = {
  Postcode: new (opts: {
    oncomplete: (data: PostcodeData) => void;
  }) => { open: () => void };
};

function getDaum(): DaumPostcode | undefined {
  return (window as unknown as { daum?: DaumPostcode }).daum;
}

function loadPostcode(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (getDaum()?.Postcode) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_SRC}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject());
      return;
    }
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.onload = () => resolve();
    s.onerror = () => reject();
    document.head.appendChild(s);
  });
}

/** Daum(카카오) 우편번호 검색 — 키 불필요. 선택된 도로명 주소를 onSelect로 전달. */
export function AddressSearchButton({
  onSelect,
  children,
  ...props
}: {
  onSelect: (address: string) => void;
  children?: React.ReactNode;
} & Omit<React.ComponentProps<typeof Button>, "onClick" | "type" | "onSelect">) {
  async function open() {
    try {
      await loadPostcode();
    } catch {
      return;
    }
    const daum = getDaum();
    if (!daum) return;
    new daum.Postcode({
      oncomplete: (data) => {
        onSelect(data.roadAddress || data.jibunAddress || data.address || "");
      },
    }).open();
  }

  return (
    <Button type="button" variant="outline" onClick={open} {...props}>
      {children ?? "주소 검색"}
    </Button>
  );
}
