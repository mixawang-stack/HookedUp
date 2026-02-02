"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "../../lib/supabaseClient";

export const dynamic = "force-dynamic";

const ADMIN_EMAIL = "admin@hookedup.me";

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
  const [adminId, setAdminId] = useState<string | null>(null);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [statusFilter, setStatusFilter] = useState("OPEN");
  const [message, setMessage] = useState<string | null>(null);
  const isAdmin = adminId !== null;

  useEffect(() => {
    const loadAdmin = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      const { data } = await supabase.auth.getUser();
      if (!data.user || data.user.email !== ADMIN_EMAIL) {
        setMessage("Admin access only.");
        return;
      }
      setAdminId(data.user.id);
    };
    loadAdmin().catch(() => undefined);
  }, []);

  const loadReports = async () => {
    const supabase = getSupabaseClient();
    if (!supabase || !adminId || !isAdmin) {
      return;
    }

    const { data, error } = await supabase
      .from("Report")
      .select("id,reporterId,targetType,targetId,reasonType,detail,status,createdAt")
      .eq("status", statusFilter)
      .order("createdAt", { ascending: false });
    if (error) {
      setMessage("Failed to load reports.");
      return;
    }

    setReports((data ?? []) as ReportItem[]);
  };

  useEffect(() => {
    loadReports().catch(() => setMessage("Failed to load reports."));
  }, [adminId, statusFilter]);

  const resolve = async (id: string, action: "warn" | "mute" | "ban") => {
    const supabase = getSupabaseClient();
    if (!supabase || !adminId || !isAdmin) {
      return;
    }

    const note = window.prompt("Resolution note?") ?? "";
    const { error } = await supabase
      .from("Report")
      .update({
        status: "RESOLVED",
        handledBy: adminId,
        handledAt: new Date().toISOString(),
        detail: note || null
      })
      .eq("id", id);

    if (!error) {
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
