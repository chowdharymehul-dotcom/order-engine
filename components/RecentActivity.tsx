"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ActivityItem = {
  id: string;
  type: "order" | "ocr";
  title: string;
  subtitle: string;
  meta: string;
  href: string;
  time: string | null;
};

export default function RecentActivity() {
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function fetchActivity() {
      try {
        const res = await fetch("/api/recent-activity", {
          cache: "no-store",
        });

        if (!res.ok) return;
        const data = await res.json();

        if (isMounted) {
          setActivity(data.activity || []);
        }
      } catch {
        console.error("Failed to fetch recent activity");
      }
    }

    fetchActivity();

    const interval = setInterval(() => {
      fetchActivity();
    }, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="bg-white border rounded p-6 space-y-4">
      <h2 className="text-xl font-semibold">Recent Activity</h2>

      {activity.length === 0 ? (
        <p className="text-sm text-gray-500">No recent activity yet.</p>
      ) : (
        <div className="space-y-3">
          {activity.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="block rounded-lg border p-4 hover:bg-gray-50"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold">{item.title}</div>
                  <div className="text-sm text-gray-700 mt-1">
                    {item.subtitle}
                  </div>
                  {item.meta ? (
                    <div className="text-xs text-gray-500 mt-1">
                      {item.meta}
                    </div>
                  ) : null}
                </div>

                <div
                  className={`text-xs px-2 py-1 rounded whitespace-nowrap ${
                    item.type === "ocr"
                      ? "bg-orange-100 text-orange-700"
                      : "bg-blue-100 text-blue-700"
                  }`}
                >
                  {item.type === "ocr" ? "Needs OCR" : "Order"}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}