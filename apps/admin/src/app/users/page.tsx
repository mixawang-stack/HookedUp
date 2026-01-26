"use client";

import { useEffect, useMemo, useState } from "react";

export const dynamic = "force-dynamic";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

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
  lastActiveAt?: string;
  status: string;
  membershipStatus: string;
  activityCounts: { posts: number; rooms: number; privateChats: number };
};

type UsersResponse = {
  items: UserRow[];
  total: number;
  page: number;
  pageSize: number;
};

type FilterOption = { value: string; count: number };

type UsersFilters = {
  total: number;
  countries: FilterOption[];
  genders: FilterOption[];
};

type UserDetail = {
  id: string;
  email: string;
  maskName: string | null;
  maskAvatarUrl: string | null;
  bio: string | null;
  country: string | null;
  city: string | null;
  gender: string | null;
  dob: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  membershipStatus: string;
  compliance: { isAgeVerified: boolean; reports: number; status: string };
  preference: {
    gender?: string | null;
    lookingForGender?: string | null;
    smPreference?: string | null;
    tagsJson?: string[] | null;
    vibeTagsJson?: string[] | null;
    interestsJson?: string[] | null;
  } | null;
  commercial?: {
    novelPurchases?: Array<{
      id: string;
      createdAt: string;
      amount: string;
      currency: string;
      pricingMode: "BOOK" | "CHAPTER";
      novel: { id: string; title: string };
      chapter?: { id: string; title: string; orderIndex: number } | null;
    }>;
  };
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

const copyText = async (value: string) => {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    return;
  }
};

export default function AdminUsersPage() {
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [totalUsers, setTotalUsers] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filterOptions, setFilterOptions] = useState<UsersFilters | null>(null);

  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("");
  const [gender, setGender] = useState("");
  const [member, setMember] = useState("");
  const [activeDays, setActiveDays] = useState("30");

  const authHeader = useMemo(() => {
    if (!token) return null;
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  useEffect(() => {
    const stored = localStorage.getItem("accessToken");
    if (stored) setToken(stored);
  }, []);

  const loadUsers = async (targetPage?: number) => {
    if (!authHeader) return;
    setStatus(null);
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (country.trim()) params.set("country", country.trim());
    if (gender.trim()) params.set("gender", gender.trim());
    if (member.trim()) params.set("member", member.trim());
    if (activeDays.trim()) params.set("active", activeDays.trim());
    const nextPage = targetPage ?? page;
    params.set("page", String(nextPage));
    params.set("limit", String(pageSize));
    const res = await fetch(`${API_BASE}/admin/users?${params.toString()}`, {
      headers: { ...authHeader }
    });
    if (!res.ok) {
      setStatus("Failed to load users.");
      return;
    }
    const data = (await res.json()) as UsersResponse;
    setUsers(data.items ?? []);
    setTotalUsers(data.total ?? 0);
    setPage(data.page ?? nextPage);
    setPageSize(data.pageSize ?? pageSize);
  };

  const loadFilters = async () => {
    if (!authHeader) return;
    const res = await fetch(`${API_BASE}/admin/users/filters`, {
      headers: { ...authHeader }
    });
    if (!res.ok) {
      return;
    }
    const data = (await res.json()) as UsersFilters;
    setFilterOptions(data);
  };

  const loadUserDetail = async (userId: string) => {
    if (!authHeader) return;
    const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
      headers: { ...authHeader }
    });
    if (!res.ok) {
      setStatus("Failed to load user detail.");
      return;
    }
    const data = (await res.json()) as UserDetail;
    setSelectedUser(data);
    setDetailOpen(true);
  };

  useEffect(() => {
    if (!authHeader) return;
    loadUsers(1).catch(() => undefined);
    loadFilters().catch(() => undefined);
  }, [authHeader]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">User management</h1>
          <p className="mt-1 text-sm text-slate-400">
            Track user activity, compliance, and growth metrics.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>
            Filtered: <span className="text-slate-200">{totalUsers}</span>
          </span>
          <span>
            Total:{" "}
            <span className="text-slate-200">
              {filterOptions?.total ?? "—"}
            </span>
          </span>
        </div>
        <button
          type="button"
          className="rounded-full border border-white/20 px-3 py-1 text-xs text-slate-200"
          onClick={() => loadUsers(page)}
        >
          Refresh
        </button>
      </div>

      {status && <p className="mt-3 text-sm text-rose-400">{status}</p>}

      <div className="mt-6 grid gap-3 rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-xs text-slate-200 md:grid-cols-6">
        <input
          className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2"
          placeholder="Search nickname or email"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2"
          value={country}
          onChange={(event) => setCountry(event.target.value)}
        >
          <option value="">Country</option>
          {(filterOptions?.countries ?? []).map((item) => (
            <option key={item.value} value={item.value}>
              {item.value} ({item.count})
            </option>
          ))}
        </select>
        <select
          className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2"
          value={gender}
          onChange={(event) => setGender(event.target.value)}
        >
          <option value="">Gender</option>
          {(filterOptions?.genders ?? []).map((item) => (
            <option key={item.value} value={item.value}>
              {item.value} ({item.count})
            </option>
          ))}
        </select>
        <select
          className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2"
          value={member}
          onChange={(event) => setMember(event.target.value)}
        >
          <option value="">Membership</option>
          <option value="FREE">Free</option>
          <option value="MEMBER">Member</option>
          <option value="EXPIRED">Expired</option>
        </select>
        <select
          className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2"
          value={activeDays}
          onChange={(event) => setActiveDays(event.target.value)}
        >
          <option value="7">Active in 7 days</option>
          <option value="30">Active in 30 days</option>
          <option value="90">Active in 90 days</option>
        </select>
        <button
          type="button"
          className="col-span-full rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-900"
          onClick={() => loadUsers(1)}
        >
          Apply filters
        </button>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
        <div className="grid grid-cols-[240px_repeat(6,minmax(0,1fr))] gap-4 border-b border-white/10 bg-slate-950/80 px-4 py-3 text-[11px] uppercase tracking-[0.2em] text-slate-500">
          <span>User</span>
          <span>User ID / Email</span>
          <span>Country</span>
          <span>Gender / Age</span>
          <span>Membership</span>
          <span>Content activity</span>
          <span>Timeline</span>
        </div>
        {users.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-400">No users found.</p>
        ) : (
          users.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => loadUserDetail(user.id)}
              className="grid w-full grid-cols-[240px_repeat(6,minmax(0,1fr))] items-center gap-4 border-b border-white/5 bg-slate-950/60 px-4 py-4 text-left text-sm text-slate-200 transition hover:bg-slate-900/60"
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
                  <p className="font-semibold">{user.maskName ?? "Unknown user"}</p>
                  <p className="text-xs text-slate-500">{user.status}</p>
                </div>
              </div>
              <div className="text-xs text-slate-300">
                <p className="font-mono text-[11px]">{user.id}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span>{user.email}</span>
                  <button
                    type="button"
                    className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-slate-400"
                    onClick={(event) => {
                      event.stopPropagation();
                      copyText(user.email);
                    }}
                  >
                    Copy
                  </button>
                </div>
              </div>
              <span className="text-xs text-slate-400">{user.country ?? "—"}</span>
              <span className="text-xs text-slate-400">
                {user.gender ?? "—"} · {calcAge(user.dob)}
              </span>
              <span className="text-xs text-slate-400">{user.membershipStatus}</span>
              <span className="text-xs text-slate-400">
                Posts {user.activityCounts.posts} · Rooms {user.activityCounts.rooms} · Chats {user.activityCounts.privateChats}
              </span>
              <span className="text-xs text-slate-400">
                Joined {formatDate(user.createdAt)}
                <br />
                Active {formatDate(user.lastActiveAt ?? user.updatedAt)}
              </span>
            </button>
          ))
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
        <span>
          Page {page} of {Math.max(1, Math.ceil(totalUsers / pageSize))}
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
            disabled={page >= Math.ceil(totalUsers / pageSize)}
            onClick={() => loadUsers(page + 1)}
          >
            Next
          </button>
        </div>
      </div>

      {detailOpen && selectedUser && (
        <div className="fixed inset-0 z-[100] flex justify-end bg-slate-950/60 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setDetailOpen(false)} />
          <div className="relative h-full w-full max-w-xl overflow-y-auto border-l border-white/10 bg-slate-950 p-8 shadow-[0_0_100px_rgba(0,0,0,0.8)]">
            <div className="flex items-center justify-between border-b border-white/10 pb-6">
              <h2 className="text-xl font-semibold">User Insights</h2>
              <button
                type="button"
                className="rounded-full border border-white/20 px-4 py-1.5 text-xs text-slate-300 hover:text-white"
                onClick={() => setDetailOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="mt-8 space-y-8">
              {/* Profile Basics */}
              <section className="space-y-4">
                <div className="flex items-center gap-6">
                  <div className="h-20 w-20 overflow-hidden rounded-full border-2 border-white/10 bg-slate-900">
                    {selectedUser.maskAvatarUrl ? (
                      <img src={selectedUser.maskAvatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xl text-slate-600">
                        {selectedUser.maskName?.slice(0, 1) || "U"}
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{selectedUser.maskName || "Anonymous"}</h3>
                    <p className="text-xs text-slate-400">{selectedUser.email}</p>
                    <div className="mt-2 flex gap-2">
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">ID: {selectedUser.id}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        selectedUser.status === "ACTIVE" ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                      }`}>{selectedUser.status}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                  <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Bio / About</h4>
                  <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                    {selectedUser.bio || "User hasn't provided a bio yet."}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-y-4 gap-x-8 border-t border-white/5 pt-4">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase">Country</span>
                      <p className="text-sm text-slate-200">{selectedUser.country || "Unknown"}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase">City</span>
                      <p className="text-sm text-slate-200">{selectedUser.city || "—"}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase">Gender</span>
                      <p className="text-sm text-slate-200">{selectedUser.gender || "—"}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase">Age</span>
                      <p className="text-sm text-slate-200">{calcAge(selectedUser.dob)}</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Compliance */}
              <section className="space-y-4">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.3em] text-slate-500">
                  Compliance & Safety
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-white/5 bg-white/5 p-3 text-center">
                    <span className="text-[10px] text-slate-500 uppercase">18+ Verified</span>
                    <p className={`mt-1 text-sm font-semibold ${selectedUser.compliance.isAgeVerified ? "text-emerald-400" : "text-slate-400"}`}>
                      {selectedUser.compliance.isAgeVerified ? "Yes" : "No"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/5 p-3 text-center">
                    <span className="text-[10px] text-slate-500 uppercase">Reports</span>
                    <p className={`mt-1 text-sm font-semibold ${selectedUser.compliance.reports > 0 ? "text-rose-400" : "text-slate-400"}`}>
                      {selectedUser.compliance.reports}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/5 p-3 text-center">
                    <span className="text-[10px] text-slate-500 uppercase">Joined</span>
                    <p className="mt-1 text-xs font-semibold text-slate-300">
                      {new Date(selectedUser.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </section>

              {/* Preferences */}
              <section className="space-y-4">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.3em] text-slate-500">
                  Interests & Preferences
                </h3>
                <div className="space-y-3 rounded-2xl border border-white/5 bg-white/5 p-4">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase">Vibe Tags</span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(selectedUser.preference?.vibeTagsJson || []).length > 0 ? (
                        selectedUser.preference?.vibeTagsJson?.map((tag: string) => (
                          <span key={tag} className="rounded-full bg-amber-400/10 px-3 py-1 text-xs text-amber-300 ring-1 ring-amber-400/20">
                            {tag}
                          </span>
                        ))
                      ) : <span className="text-xs text-slate-500 italic">None</span>}
                    </div>
                  </div>
                  <div className="border-t border-white/5 pt-3">
                    <span className="text-[10px] text-slate-500 uppercase">Special Interests</span>
                    <p className="mt-1 text-sm text-slate-200">{selectedUser.preference?.interestsJson?.join(", ") || "None"}</p>
                  </div>
                </div>
              </section>

              {/* Commercial */}
              <section className="space-y-4 pb-10">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.3em] text-slate-500">
                  Commercial Data
                </h3>
                <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                  {(selectedUser.commercial?.novelPurchases ?? []).length === 0 ? (
                    <p className="text-xs text-slate-500 italic">
                      No novel purchases recorded yet.
                    </p>
                  ) : (
                    <div className="space-y-3 text-xs text-slate-300">
                      {selectedUser.commercial?.novelPurchases?.map((purchase) => (
                        <div
                          key={purchase.id}
                          className="rounded-xl border border-white/10 bg-slate-950/60 p-3"
                        >
                          <p className="text-[11px] text-slate-500">
                            {formatDate(purchase.createdAt)}
                          </p>
                          <p className="mt-1 text-sm text-slate-200">
                            {purchase.novel.title}
                            {purchase.chapter
                              ? ` · Chapter ${purchase.chapter.orderIndex}`
                              : ""}
                          </p>
                          {purchase.chapter?.title && (
                            <p className="text-[11px] text-slate-400">
                              {purchase.chapter.title}
                            </p>
                          )}
                          <p className="mt-2 text-[11px] text-slate-400">
                            {purchase.pricingMode} · {purchase.amount}{" "}
                            {purchase.currency}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
