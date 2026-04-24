"use client";

import { useEffect, useState } from "react";

type DashboardData = {
  followUps: number;
  dueToday: number;
  overdue: number;
  critical: number;
  pendingReplies: number;
  newOrders: number;
};

export default function DashboardCards() {
  const [data, setData] = useState<DashboardData>({
    followUps: 0,
    dueToday: 0,
    overdue: 0,
    critical: 0,
    pendingReplies: 0,
    newOrders: 0,
  });

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/dashboard", {
          cache: "no-store",
        });

        if (!res.ok) return;

        const json = await res.json();

        setData({
          followUps: json.followUps || 0,
          dueToday: json.dueToday || 0,
          overdue: json.overdue || 0,
          critical: json.critical || 0,
          pendingReplies: json.pendingReplies || 0,
          newOrders: json.newOrders || 0,
        });
      } catch {
        console.error("Dashboard fetch failed");
      }
    }

    fetchData();

    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-3 gap-6">
      {/* FOLLOW UPS */}
      <div className="border rounded-xl p-6 bg-orange-50">
        <div className="text-lg font-semibold text-orange-700">
          Follow Ups
        </div>
        <div className="text-4xl font-bold mt-2 text-orange-900">
          {data.followUps}
        </div>

        <div className="mt-4 text-sm">
          <div className="text-yellow-700">
            Due Today: {data.dueToday}
          </div>
          <div className="text-red-600">
            Overdue: {data.overdue}
          </div>
          <div className="text-red-700 font-semibold">
            Critical: {data.critical}
          </div>
        </div>
      </div>

      {/* PENDING REPLIES */}
      <div className="border rounded-xl p-6">
        <div className="text-lg font-semibold text-gray-600">
          Pending Replies
        </div>
        <div className="text-4xl font-bold mt-2">
          {data.pendingReplies}
        </div>
      </div>

      {/* NEW ORDERS */}
      <div className="border rounded-xl p-6 bg-blue-50">
        <div className="text-lg font-semibold text-blue-700">
          New Orders
        </div>
        <div className="text-4xl font-bold mt-2 text-blue-900">
          {data.newOrders}
        </div>
      </div>
    </div>
  );
}