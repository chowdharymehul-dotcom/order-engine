"use client";

import Link from "next/link";

type Props = {
  href: string;
  isSent: boolean;
};

export default function SendResendOCButton({ href, isSent }: Props) {
  function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!isSent) return;

    const confirmed = window.confirm(
      "This Order Confirmation has already been sent.\n\nAre you sure you want to resend it?"
    );

    if (!confirmed) {
      event.preventDefault();
    }
  }

  return (
    <Link
      href={href}
      onClick={handleClick}
      className="px-4 py-2 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100"
    >
      {isSent ? "Resend" : "Send"}
    </Link>
  );
}