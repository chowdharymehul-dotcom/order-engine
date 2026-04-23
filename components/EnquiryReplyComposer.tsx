"use client";

import { useState } from "react";
import Link from "next/link";

type SuggestionSet = {
  professional: string;
  warm: string;
  concise: string;
};

type EnquiryReplyComposerProps = {
  enquiryId: string;
  to: string;
  subject: string;
  suggestions: SuggestionSet;
  defaultMessage: string;
  isFollowUp: boolean;
};

export default function EnquiryReplyComposer({
  enquiryId,
  to,
  subject,
  suggestions,
  defaultMessage,
  isFollowUp,
}: EnquiryReplyComposerProps) {
  const [message, setMessage] = useState(defaultMessage);

  return (
    <>
      <div className="bg-white border rounded-xl p-6 space-y-5">
        <h2 className="text-xl font-semibold">
          {isFollowUp ? "AI Follow Up Suggestions" : "AI Suggestions"}
        </h2>

        <div className="space-y-4">
          <div className="border rounded-xl p-4 bg-gray-50 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm font-semibold">Professional</div>
              <button
                type="button"
                onClick={() => setMessage(suggestions.professional)}
                className="px-3 py-2 rounded-lg bg-gray-200 text-black text-sm hover:bg-gray-300 transition"
              >
                Use This
              </button>
            </div>
            <pre className="whitespace-pre-wrap text-sm text-black font-sans">
              {suggestions.professional}
            </pre>
          </div>

          <div className="border rounded-xl p-4 bg-gray-50 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm font-semibold">Warm</div>
              <button
                type="button"
                onClick={() => setMessage(suggestions.warm)}
                className="px-3 py-2 rounded-lg bg-gray-200 text-black text-sm hover:bg-gray-300 transition"
              >
                Use This
              </button>
            </div>
            <pre className="whitespace-pre-wrap text-sm text-black font-sans">
              {suggestions.warm}
            </pre>
          </div>

          <div className="border rounded-xl p-4 bg-gray-50 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm font-semibold">Concise</div>
              <button
                type="button"
                onClick={() => setMessage(suggestions.concise)}
                className="px-3 py-2 rounded-lg bg-gray-200 text-black text-sm hover:bg-gray-300 transition"
              >
                Use This
              </button>
            </div>
            <pre className="whitespace-pre-wrap text-sm text-black font-sans">
              {suggestions.concise}
            </pre>
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-6 space-y-4">
        <h2 className="text-xl font-semibold">
          {isFollowUp ? "Send Follow Up" : "Send Reply"}
        </h2>

        <form action="/api/enquiries/send-reply" method="POST" className="space-y-4">
          <input type="hidden" name="enquiry_id" value={enquiryId} />

          <div>
            <label className="block text-sm font-medium mb-2">To</label>
            <input
              type="email"
              name="to"
              defaultValue={to}
              className="w-full border rounded-lg px-4 py-3"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Subject</label>
            <input
              type="text"
              name="subject"
              defaultValue={subject}
              className="w-full border rounded-lg px-4 py-3"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Message</label>
            <textarea
              name="message"
              rows={12}
              className="w-full border rounded-lg px-4 py-3"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
            />
          </div>

          <div className="text-sm text-gray-500">
            Click any suggestion above to instantly fill the message box.
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="px-5 py-3 rounded-lg bg-gray-200 text-black hover:bg-gray-300 transition"
            >
              {isFollowUp ? "Send Follow Up" : "Send Reply"}
            </button>

            <Link
              href="/enquiries-follow-up"
              className="px-5 py-3 rounded-lg border hover:bg-gray-50 transition"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </>
  );
}