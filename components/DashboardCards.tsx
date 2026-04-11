"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Stats = {
  emailCount: number;
  totalOrders: number;
  newOrders: number;
  approvedOrders: number;
  doneOrders: number;
  needsOcr: number;
};

export default function DashboardCards() {
  const [stats, setStats] = useState<Stats>({
    emailCount: 0,
    totalOrders: 0,
    newOrders: 0,
    approvedOrders: 0,
    doneOrders: 0,
    needsOcr: 0,
  });

  useEffect(() => {
    let isMounted = true;

    async function fetchStats() {
      try {
        const res = await fetch("/api/dashboard-stats", {
          cache: "no-store",
        });

        if (!res.ok) return;

        const data = await res.json();

        if (isMounted) {
          setStats({
            emailCount: data.emailCount || 0,
            totalOrders: data.totalOrders || 0,
            newOrders: data.newOrders || 0,
            approvedOrders: data.approvedOrders || 0,
            doneOrders: data.doneOrders || 0,
            needsOcr: data.needsOcr || 0,
          });
        }
      } catch (error) {
        console.error("Failed to fetch dashboard stats");
      }
    }

    fetchStats();

    const interval = setInterval(() => {
      fetchStats();
    }, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
      <Card title="Emails" value={stats.emailCount} link="/emails" />
      <Card title="Total Orders" value={stats.totalOrders} link="/orders" />
      <Card title="New" value={stats.newOrders} link="/orders?status=New" />
      <Card title="Approved" value={stats.approvedOrders} link="/orders?status=Approved" />
      <Card title="Done" value={stats.doneOrders} link="/orders?status=Done" />
      <Card title="Needs OCR" value={stats.needsOcr} link="/needs-ocr" />
    </div>
  );
}

function Card({
  title,
  value,
  link,
}: {
  title: string;
  value: number;
  link: string;
}) {
  return (
    <Link
      href={link}
      className="bg-white border rounded p-5 hover:shadow-md transition"
    >
      <div className="text-sm text-gray-500">{title}</div>
      <div className="text-2xl font-bold mt-2">{value}</div>
    </Link>
  );
}