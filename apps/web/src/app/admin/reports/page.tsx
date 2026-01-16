"use client";

import { useEffect, useMemo, useState } from "react";

export const dynamic = "force-dynamic";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

type ReportItem = {
  id: string;
  reporterId: string;
  targetType: string;
  targetId: string;
  reasonType: string;
  detail: string | null;
  status: string;
  createdAt: string;
};

export default function AdminReportsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [reports, setReports] = useState<ReportItem[]>([]);
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

    const params = new URLSearchParams();
    params.set("status", statusFilter.toLowerCase());

    const res = await fetch(`${API_BASE}/admin/reports?${params}`, {
      headers: { ...authHeader }
    });

    if (!res.ok) {
      setMessage("Failed to load reports.");
      return;
    }

    const data = (await res.json()) as ReportItem[];
    setReports(data);
  };

  useEffect(() => {
    loadReports().catch(() => setMessage("Failed to load reports."));
  }, [authHeader, statusFilter]);

  const resolve = async (id: string, action: "warn" | "mute" | "ban") => {
    if (!authHeader) {
      return;
    }

    const note = window.prompt("Resolution note?") ?? "";
    const res = await fetch(`${API_BASE}/admin/reports/${id}/resolve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeader
      },
      body: JSON.stringify({ action, note })
    });

    if (res.ok) {
      setMessage("Report resolved.");
      await loadReports();
    } else {
      setMessage("Failed to resolve report.");
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 p-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Reports</h1>
        <p className="mt-2 text-sm text-slate-500">
          Review reported users and messages.
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
              <option value="OPEN">Open</option>
              <option value="RESOLVED">Resolved</option>
            </select>
          </div>
        </div>
        {message && <p className="mt-3 text-sm text-slate-500">{message}</p>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-4">
          {reports.length === 0 && (
            <p className="text-sm text-slate-500">No reports found.</p>
          )}
          {reports.map((report) => (
            <div
              key={report.id}
              className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4 last:border-b-0 last:pb-0"
            >
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {report.targetType} · {report.reasonType}
                </p>
                <p className="text-xs text-slate-500">
                  Target: {report.targetId}
                </p>
                {report.detail && (
                  <p className="text-xs text-slate-400">{report.detail}</p>
                )}
              </div>
              {report.status === "OPEN" && (
                <div className="flex gap-2">
                  <button
                    className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                    onClick={() => resolve(report.id, "warn")}
                  >
                    Warn
                  </button>
                  <button
                    className="rounded-full bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white"
                    onClick={() => resolve(report.id, "mute")}
                  >
                    Mute
                  </button>
                  <button
                    className="rounded-full bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white"
                    onClick={() => resolve(report.id, "ban")}
                  >
                    Ban
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
