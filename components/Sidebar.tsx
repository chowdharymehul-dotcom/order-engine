"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Counts = {
  orders: number;
  emails: number;
  needsOcr: number;
};

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/orders", label: "Orders", key: "orders" },
  { href: "/emails", label: "Emails", key: "emails" },
  { href: "/needs-ocr", label: "Needs OCR", key: "needsOcr" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [counts, setCounts] = useState<Counts>({
    orders: 0,
    emails: 0,
    needsOcr: 0,
  });

  useEffect(() => {
    let isMounted = true;

    async function fetchCounts() {
      try {
        const res = await fetch("/api/sidebar-counts", {
          cache: "no-store",
        });

        if (!res.ok) return;

        const data = await res.json();

        if (isMounted) {
          setCounts({
            orders: data.orders || 0,
            emails: data.emails || 0,
            needsOcr: data.needsOcr || 0,
          });
        }
      } catch (err) {
        console.error("Failed to fetch sidebar counts");
      }
    }

    fetchCounts();

    const interval = setInterval(() => {
      fetchCounts();
    }, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <aside className="w-64 min-h-screen border-r bg-white p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-black">Order Engine</h1>
        <p className="text-sm text-gray-500 mt-1">AI workflow console</p>
      </div>

      <nav className="space-y-2">
        {navItems.map((item: any) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          const count = item.key ? counts[item.key as keyof Counts] : null;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex justify-between items-center rounded-lg px-4 py-3 text-sm font-medium transition ${
                isActive
                  ? "bg-gray-200 text-black"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <span>{item.label}</span>

              {count !== null && count !== undefined && (
                <span className="text-xs bg-gray-300 px-2 py-1 rounded">
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}