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

export default function AdminPage() {
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
      setMessage("Failed to load queue.");
      return;
    }

    const data = (await res.json()) as VerificationItem[];
    setItems(data);
  };

  useEffect(() => {
    loadQueue().catch(() => {
      setMessage("Failed to load queue.");
    });
  }, [authHeader, statusFilter, typeFilter]);

  const approve = async (id: string) => {
    if (!authHeader) {
      return;
    }

    const res = await fetch(`${API_BASE}/admin/verifications/${id}/approve`, {
      method: "POST",
      headers: {
        ...authHeader
      }
    });

    if (res.ok) {
      setMessage("Approved.");
      await loadQueue();
    } else {
      setMessage("Failed to approve.");
    }
  };

  const reject = async (id: string) => {
    if (!authHeader) {
      return;
    }

    const reason = window.prompt("Rejection reason?") ?? "";
    if (!reason.trim()) {
      setMessage("Rejection reason required.");
      return;
    }

    const res = await fetch(`${API_BASE}/admin/verifications/${id}/reject`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeader
      },
      body: JSON.stringify({ reason })
    });

    if (res.ok) {
      setMessage("Rejected.");
      await loadQueue();
    } else {
      setMessage("Failed to reject.");
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 p-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">
          Admin Review Queue
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Approve or reject verification uploads.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-600">Status</label>
            <select
              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="ALL">All</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Type</label>
            <select
              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
            >
              <option value="ALL">All</option>
              <option value="AGE">Age</option>
              <option value="HEALTH">Health</option>
              <option value="CRIMINAL_RECORD">Criminal record</option>
            </select>
          </div>
        </div>
        {message && <p className="mt-3 text-sm text-slate-500">{message}</p>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-4">
          {items.length === 0 && (
            <p className="text-sm text-slate-500">No items found.</p>
          )}
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4 last:border-b-0 last:pb-0"
            >
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {item.type} · {item.status}
                </p>
                <p className="text-xs text-slate-500">
                  {item.user?.email ?? item.userId}
                </p>
                <p className="text-xs text-slate-400">
                  {new Date(item.createdAt).toLocaleString()}
                </p>
              </div>
              {item.status === "PENDING" && (
                <div className="flex gap-2">
                  <button
                    className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                    onClick={() => approve(item.id)}
                  >
                    Approve
                  </button>
                  <button
                    className="rounded-full bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white"
                    onClick={() => reject(item.id)}
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
