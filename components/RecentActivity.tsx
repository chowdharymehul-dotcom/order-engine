"use client";

import { useEffect, useState } from "react";

type Activity = {
  id: string;
  subject: string;
  from: string;
  status: string;
};

export default function RecentActivity() {
  const [data, setData] = useState<Activity[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/recent-activity", {
          cache: "no-store",
        });

        if (!res.ok) return;

        const json = await res.json();

        // 🚫 REMOVE OCR ITEMS HERE
        const filtered = (json.activities || []).filter(
          (item: Activity) =>
            item.status !== "needs_ocr" &&
            item.status !== "ocr_failed"
        );

        setData(filtered);
      } catch {
        console.error("Recent activity fetch failed");
      }
    }

    fetchData();

    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Recent Activity</h2>

      {data.length === 0 ? (
        <div className="text-gray-500">No activity</div>
      ) : (
        data.map((item) => (
          <div
            key={item.id}
            className="border rounded-xl p-5 flex justify-between items-center"
          >
            <div>
              <div className="font-semibold">{item.subject}</div>
              <div className="text-sm text-gray-500">{item.from}</div>
            </div>

            <div className="text-xs bg-gray-200 px-3 py-1 rounded">
              {item.status}
            </div>
          </div>
        ))
      )}
    </div>
  );
}