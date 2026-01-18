"use client";

import { useEffect, useMemo, useState } from "react";

export const dynamic = "force-dynamic";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

type ReportItem = {
  id: string;
  targetType: string;
  targetId: string;
  reasonType: string;
  detail?: string | null;
  status: string;
  createdAt: string;
  reporter?: { id: string; email: string };
};

export default function AdminReportsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [items, setItems] = useState<ReportItem[]>([]);
  const [statusFilter, setStatusFilter] = useState("OPEN");
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

  const loadReports = async () => {
    if (!authHeader) {
      return;
    }

    setMessage(null);
    const params = new URLSearchParams();
    if (statusFilter !== "ALL") {
      params.set("status", statusFilter.toLowerCase());
    }

    const res = await fetch(`${API_BASE}/admin/reports?${params}`, {
      headers: {
        ...authHeader
      }
    });

    if (!res.ok) {
      setMessage("Unable to fetch reports.");
      return;
    }

    const data = (await res.json()) as ReportItem[];
    setItems(data);
  };

  useEffect(() => {
    loadReports().catch(() => setMessage("Unable to fetch reports."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authHeader, statusFilter]);

  const resolve = async (id: string, action: "warn" | "mute" | "ban") => {
    if (!authHeader) {
      return;
    }
    const note = window.prompt("Optional note:", "") ?? "";
    const res = await fetch(`${API_BASE}/admin/reports/${id}/resolve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeader
      },
      body: JSON.stringify({ action, note })
    });

    if (!res.ok) {
      setMessage("Action failed.");
      return;
    }
    await loadReports();
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 text-slate-100">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-slate-400">
          Review user reports and take action.
        </p>
      </header>

      <div className="mt-6 flex flex-wrap gap-3 text-xs text-slate-300">
        <select
          className="rounded-full border border-white/10 bg-slate-900/60 px-4 py-2 text-xs text-white"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="OPEN">Open</option>
          <option value="REVIEWING">Reviewing</option>
          <option value="RESOLVED">Resolved</option>
          <option value="DISMISSED">Dismissed</option>
          <option value="ALL">All</option>
        </select>
      </div>

      {message && <p className="mt-4 text-sm text-rose-400">{message}</p>}

      <section className="mt-6 grid gap-4">
        {items.length === 0 ? (
          <p className="text-sm text-slate-400">No reports found.</p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/70 p-5"
            >
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{item.targetType}</span>
                <span>{new Date(item.createdAt).toLocaleString()}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{item.reasonType}</p>
                <p className="text-xs text-slate-400">
                  Target: {item.targetId}
                </p>
                {item.detail && (
                  <p className="text-xs text-slate-400">Detail: {item.detail}</p>
                )}
              </div>
              {item.status === "OPEN" && (
                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded-full bg-amber-400 px-4 py-2 text-xs font-semibold text-slate-900"
                    onClick={() => resolve(item.id, "warn")}
                  >
                    Warn
                  </button>
                  <button
                    className="rounded-full border border-white/20 px-4 py-2 text-xs text-slate-200"
                    onClick={() => resolve(item.id, "mute")}
                  >
                    Mute
                  </button>
                  <button
                    className="rounded-full border border-rose-400/60 px-4 py-2 text-xs text-rose-200"
                    onClick={() => resolve(item.id, "ban")}
                  >
                    Ban
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
