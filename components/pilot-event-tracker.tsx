"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function PilotEventTracker() {
  const pathname = usePathname();
  useEffect(() => {
    const key = `crestview:pilot:view:${pathname}`;
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
    void fetch("/api/pilot/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventName: "pilot.page_viewed", route: pathname }),
      keepalive: true,
    });
  }, [pathname]);
  return null;
}
