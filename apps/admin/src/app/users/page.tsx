"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "../lib/supabaseClient";

export const dynamic = "force-dynamic";

const ADMIN_EMAIL = "admin@hookedup.me";

type UserRow = {
  id: string;
  email: string;
  maskName: string | null;
  maskAvatarUrl: string | null;
  country: string | null;
  gender: string | null;
  dob: string | null;
  createdAt: string;
  updatedAt: string;
  status: string;
};

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const calcAge = (dob?: string | null) => {
  if (!dob) return "—";
  const date = new Date(dob);
  if (Number.isNaN(date.getTime())) return "—";
  const diff = Date.now() - date.getTime();
  return Math.max(0, Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000)));
};

export default function AdminUsersPage() {
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("");
  const [gender, setGender] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const offset = useMemo(() => (page - 1) * pageSize, [page, pageSize]);

  useEffect(() => {
    const loadAdmin = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      const { data } = await supabase.auth.getUser();
      setAdminEmail(data.user?.email ?? null);
    };
    loadAdmin().catch(() => undefined);
  }, []);

  const loadUsers = async (targetPage?: number) => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setStatus(null);
    const currentPage = targetPage ?? page;
    const rangeFrom = (currentPage - 1) * pageSize;
    const rangeTo = rangeFrom + pageSize - 1;

    let query = supabase
      .from("User")
      .select(
        "id,email,maskName,maskAvatarUrl,country,gender,dob,createdAt,updatedAt,status",
        { count: "exact" }
      )
      .order("createdAt", { ascending: false })
      .range(rangeFrom, rangeTo);

    if (search.trim()) {
      const term = search.trim();
      query = query.or(`email.ilike.%${term}%,maskName.ilike.%${term}%`);
    }
    if (country.trim()) {
      query = query.eq("country", country.trim());
    }
    if (gender.trim()) {
      query = query.eq("gender", gender.trim());
    }
    if (statusFilter.trim()) {
      query = query.eq("status", statusFilter.trim());
    }

    const { data, error, count } = await query;
    if (error) {
      setStatus("Failed to load users.");
      return;
    }
    setUsers((data ?? []) as UserRow[]);
    setTotal(count ?? 0);
    setPage(currentPage);
  };

  useEffect(() => {
    if (!adminEmail) return;
    loadUsers(1).catch(() => undefined);
  }, [adminEmail]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 text-slate-100">
      {adminEmail && adminEmail !== ADMIN_EMAIL && (
        <p className="mb-4 rounded-xl border border-rose-400/60 bg-rose-500/10 p-3 text-xs text-rose-200">
          You are signed in as {adminEmail}. This page is restricted to admins.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">User management</h1>
          <p className="mt-1 text-sm text-slate-400">
            Search and review user profiles.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>
            Total: <span className="text-slate-200">{total}</span>
          </span>
          <button
            type="button"
            className="rounded-full border border-white/20 px-3 py-1 text-xs text-slate-200"
            onClick={() => loadUsers(page)}
          >
            Refresh
          </button>
        </div>
      </div>

      {status && <p className="mt-3 text-sm text-rose-400">{status}</p>}

      <div className="mt-6 grid gap-3 rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-xs text-slate-200 md:grid-cols-5">
        <input
          className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2"
          placeholder="Search email or nickname"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <input
          className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2"
          placeholder="Country"
          value={country}
          onChange={(event) => setCountry(event.target.value)}
        />
        <input
          className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2"
          placeholder="Gender"
          value={gender}
          onChange={(event) => setGender(event.target.value)}
        />
        <input
          className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2"
          placeholder="Status (ACTIVE)"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        />
        <button
          type="button"
          className="col-span-full rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-900"
          onClick={() => loadUsers(1)}
        >
          Apply filters
        </button>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
        <div className="grid grid-cols-[220px_repeat(5,minmax(0,1fr))] gap-4 border-b border-white/10 bg-slate-950/80 px-4 py-3 text-[11px] uppercase tracking-[0.2em] text-slate-500">
          <span>User</span>
          <span>User ID / Email</span>
          <span>Country</span>
          <span>Gender / Age</span>
          <span>Status</span>
          <span>Created</span>
        </div>
        {users.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-400">No users found.</p>
        ) : (
          users.map((user) => (
            <div
              key={user.id}
              className="grid grid-cols-[220px_repeat(5,minmax(0,1fr))] items-center gap-4 border-b border-white/5 bg-slate-950/60 px-4 py-4 text-sm text-slate-200"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 overflow-hidden rounded-full border border-white/10 bg-slate-900/80">
                  {user.maskAvatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.maskAvatarUrl}
                      alt={user.maskName ?? "User"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
                      {user.maskName?.slice(0, 1) ?? "?"}
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-semibold">
                    {user.maskName ?? "Unknown user"}
                  </p>
                  <p className="text-xs text-slate-500">{user.status}</p>
                </div>
              </div>
              <div className="text-xs text-slate-300">
                <p className="font-mono text-[11px]">{user.id}</p>
                <p className="mt-1">{user.email}</p>
              </div>
              <span className="text-xs text-slate-400">
                {user.country ?? "—"}
              </span>
              <span className="text-xs text-slate-400">
                {user.gender ?? "—"} · {calcAge(user.dob)}
              </span>
              <span className="text-xs text-slate-400">{user.status}</span>
              <span className="text-xs text-slate-400">
                {formatDate(user.createdAt)}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
        <span>
          Page {page} of {Math.max(1, Math.ceil(total / pageSize))}
        </span>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2">
            <span className="text-slate-400">Rows</span>
            <select
              className="rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1"
              value={pageSize}
              onChange={(event) => {
                const nextSize = Number(event.target.value);
                setPageSize(nextSize);
                setPage(1);
                loadUsers(1).catch(() => undefined);
              }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </label>
          <button
            type="button"
            className="rounded-full border border-white/10 px-3 py-1"
            disabled={page <= 1}
            onClick={() => loadUsers(Math.max(1, page - 1))}
          >
            Prev
          </button>
          <button
            type="button"
            className="rounded-full border border-white/10 px-3 py-1"
            disabled={page >= Math.ceil(total / pageSize)}
            onClick={() => loadUsers(page + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
