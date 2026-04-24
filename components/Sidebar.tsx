"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Counts = {
  orders: number;
  emails: number;
};

type Notifications = {
  newOrders: number;
  total: number;
};

type NotificationItem = {
  id: string;
  type: "order";
  title: string;
  subtitle: string;
  meta: string;
  href: string;
  createdAt: string | null;
};

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/emails", label: "Email", key: "emails" },
  { href: "/orders", label: "Orders", key: "orders" },
  { href: "/enquiries-follow-up", label: "Enquiries & Follow Up" },
  { href: "/cancellations", label: "Cancellation" },
];

export default function Sidebar() {
  const pathname = usePathname();

  const [counts, setCounts] = useState<Counts>({
    orders: 0,
    emails: 0,
  });

  const [notifications, setNotifications] = useState<Notifications>({
    newOrders: 0,
    total: 0,
  });

  const [feed, setFeed] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

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
          });
        }
      } catch {
        console.error("Failed to fetch sidebar counts");
      }
    }

    async function fetchNotifications() {
      try {
        const res = await fetch("/api/notifications", {
          cache: "no-store",
        });

        if (!res.ok) return;
        const data = await res.json();

        if (isMounted) {
          setNotifications({
            newOrders: data.newOrders || 0,
            total: data.total || 0,
          });
        }
      } catch {
        console.error("Failed to fetch notifications");
      }
    }

    async function fetchFeed() {
      try {
        const res = await fetch("/api/notifications-feed", {
          cache: "no-store",
        });

        if (!res.ok) return;
        const data = await res.json();

        if (isMounted) {
          setFeed(data.notifications || []);
        }
      } catch {
        console.error("Failed to fetch notifications feed");
      }
    }

    fetchCounts();
    fetchNotifications();
    fetchFeed();

    const interval = setInterval(() => {
      fetchCounts();
      fetchNotifications();
      fetchFeed();
    }, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  return (
    <aside className="w-64 min-h-screen border-r bg-white p-6 relative">
      <div className="mb-8 relative" ref={panelRef}>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-black">Order Engine</h1>

          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className="relative min-w-6 h-6 px-2 flex items-center justify-center rounded-full bg-red-600 text-white text-xs font-bold"
          >
            {notifications.total}
          </button>
        </div>

        <p className="text-sm text-gray-500 mt-1">AI workflow console</p>

        {notifications.newOrders > 0 && (
          <div className="mt-4 space-y-2">
            <Link
              href="/orders?filter=new"
              className="block text-lg font-semibold text-red-600 hover:text-red-700"
            >
              {notifications.newOrders} new order
              {notifications.newOrders > 1 ? "s" : ""}
            </Link>
          </div>
        )}

        {open && (
          <div className="absolute top-16 left-0 w-full bg-white border rounded-xl shadow-lg p-3 z-50">
            <div className="text-sm font-semibold mb-3">Notifications</div>

            {feed.length === 0 ? (
              <div className="text-xs text-gray-500">
                No new notifications
              </div>
            ) : (
              <div className="space-y-2">
                {feed.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-lg border p-3 hover:bg-gray-50"
                  >
                    <div className="text-xs font-semibold text-black">
                      {item.title}
                    </div>
                    <div className="text-xs text-gray-700 mt-1">
                      {item.subtitle}
                    </div>
                    {item.meta ? (
                      <div className="text-[11px] text-gray-500 mt-1 truncate">
                        {item.meta}
                      </div>
                    ) : null}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
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