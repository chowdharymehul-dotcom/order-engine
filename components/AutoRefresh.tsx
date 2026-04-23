"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type AutoRefreshProps = {
  interval?: number;
};

export default function AutoRefresh({
  interval = 10000,
}: AutoRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    let stopped = false;

    async function runAutoTasks() {
      try {
        await fetch("/api/enquiries/auto-follow-up", {
          method: "GET",
          cache: "no-store",
        });
      } catch {
        // ignore auto task errors so refresh still happens
      }

      if (!stopped) {
        router.refresh();
      }
    }

    runAutoTasks();

    const timer = setInterval(() => {
      runAutoTasks();
    }, interval);

    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [interval, router]);

  return null;
}