"use client";

import { useEffect, useState } from "react";

/**
 * 최상단 fixed 실시간 띠. 흐르는 문구 + 매초 갱신되는 시계로
 * "캡처가 아닌 실시간 화면"임을 보여준다.
 */
export function LiveMarquee() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const text = `실시간 웨이팅 현황 · 캡처가 아닌 실시간 화면입니다 · ${time}`;

  return (
    <div className="fixed inset-x-0 top-0 z-50 overflow-hidden bg-primary text-primary-foreground">
      <div className="flex w-max animate-[marquee_22s_linear_infinite] py-1.5 text-xs font-medium whitespace-nowrap">
        {Array.from({ length: 4 }).map((_, i) => (
          <span key={i} className="px-6">
            ● {text}
          </span>
        ))}
      </div>
    </div>
  );
}
