"use client";

import { useEffect, useMemo, useState } from "react";

export const dynamic = "force-dynamic";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

type VerificationItem = {
  id: string;
  type: string;
  status: string;
  createdAt: string;
  userId: string;
  user?: { id: string; email: string };
};

export default function AdminVerificationsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [items, setItems] = useState<VerificationItem[]>([]);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [message, setMessage] = useState<string | null>(null);

  const authHeader = useMemo(() => {
    if (!token) {
      return null;
    }
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  useEffect(() => {
    const stored = localStorage.getItem("accessToken");
    if (stored) {
      setToken(stored);
    }
  }, []);

  const loadQueue = async () => {
    if (!authHeader) {
      return;
    }

    setMessage(null);
    const params = new URLSearchParams();
    if (statusFilter !== "ALL") {
      params.set("status", statusFilter.toLowerCase());
    }
    if (typeFilter !== "ALL") {
      params.set("type", typeFilter.toLowerCase());
    }

    const res = await fetch(`${API_BASE}/admin/verifications?${params}`, {
      headers: {
        ...authHeader
      }
    });

    if (!res.ok) {
      setMessage("Unable to fetch review queue.");
      return;
    }

    const data = (await res.json()) as VerificationItem[];
    setItems(data);
  };

  useEffect(() => {
    loadQueue().catch(() => setMessage("Unable to fetch review queue."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authHeader, statusFilter, typeFilter]);

  const respond = async (id: string, action: "approve" | "reject") => {
    if (!authHeader) {
      return;
    }

    const reason =
      action === "reject" ? window.prompt("Reason for rejection:") : "";
    if (action === "reject" && !reason) {
      return;
    }

    const res = await fetch(
      `${API_BASE}/admin/verifications/${id}/${action}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader
        },
        body: action === "reject" ? JSON.stringify({ reason }) : undefined
      }
    );

    if (!res.ok) {
      setMessage("Action failed.");
      return;
    }

    await loadQueue();
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 text-slate-100">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Admin Review Queue</h1>
        <p className="text-sm text-slate-400">
          Review verification requests that require moderation.
        </p>
      </header>

      <div className="mt-6 flex flex-wrap gap-3 text-xs text-slate-300">
        <select
          className="rounded-full border border-white/10 bg-slate-900/60 px-4 py-2 text-xs text-white"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="ALL">All</option>
        </select>
        <select
          className="rounded-full border border-white/10 bg-slate-900/60 px-4 py-2 text-xs text-white"
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
        >
          <option value="ALL">All types</option>
          <option value="AGE">Age</option>
          <option value="HEALTH">Health</option>
          <option value="CRIMINAL_RECORD">Criminal</option>
        </select>
      </div>

      {message && <p className="mt-4 text-sm text-rose-400">{message}</p>}

      <section className="mt-6 grid gap-4">
        {items.length === 0 ? (
          <p className="text-sm text-slate-400">No pending requests.</p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/70 p-5"
            >
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{item.type}</span>
                <span>{new Date(item.createdAt).toLocaleString()}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  {item.user?.email ?? item.userId}
                </p>
                <p className="text-xs text-slate-400">Status: {item.status}</p>
              </div>
              {item.status === "PENDING" && (
                <div className="flex gap-2">
                  <button
                    className="rounded-full bg-emerald-400 px-4 py-2 text-xs font-semibold text-slate-900"
                    onClick={() => respond(item.id, "approve")}
                  >
                    Approve
                  </button>
                  <button
                    className="rounded-full border border-rose-400/60 px-4 py-2 text-xs font-semibold text-rose-200"
                    onClick={() => respond(item.id, "reject")}
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </section>
    </main>
  );
}
