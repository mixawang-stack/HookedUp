"use client";

import { useEffect, useMemo, useState } from "react";

export const dynamic = "force-dynamic";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

type NovelItem = {
  id: string;
  title: string;
  coverImageUrl: string | null;
  description: string | null;
  tagsJson?: string[] | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED" | "SCHEDULED";
  audience: "ALL" | "MATURE";
  isFeatured: boolean;
  authorName: string | null;
  language: string | null;
  _count?: { chapters: number };
  room?: { id: string; _count: { memberships: number } } | null;
};

type ChapterItem = {
  id: string;
  title: string;
  content: string;
  orderIndex: number;
  isFree: boolean;
  isPublished: boolean;
};

const parseTags = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

const resolveMediaUrl = (value?: string | null) => {
  if (!value) return null;
  if (value.startsWith("/uploads/")) {
    return `${API_BASE}${value}`;
  }
  if (!value.startsWith("http://") && !value.startsWith("https://")) {
    return value;
  }
  try {
    const parsed = new URL(value);
    if (parsed.pathname.startsWith("/uploads/")) {
      return `${API_BASE}${parsed.pathname}`;
    }
  } catch {
    return value;
  }
  return value;
};

export default function AdminNovelsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [novels, setNovels] = useState<NovelItem[]>([]);
  const [selectedNovel, setSelectedNovel] = useState<NovelItem | null>(null);
  const [chapters, setChapters] = useState<ChapterItem[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Form states
  const [title, setTitle] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [audience, setAudience] = useState<NovelItem["audience"]>("ALL");
  const [isFeatured, setIsFeatured] = useState(false);
  const [autoPostHall, setAutoPostHall] = useState(true);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [freeCount, setFreeCount] = useState("2");

  const authHeader = useMemo(() => {
    if (!token) return null;
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  useEffect(() => {
    const stored = localStorage.getItem("accessToken");
    if (stored) setToken(stored);
  }, []);

  const loadNovels = async () => {
    if (!authHeader) return;
    setStatus(null);
    const res = await fetch(`${API_BASE}/admin/novels`, {
      headers: { ...authHeader }
    });
    if (!res.ok) {
      setStatus("Failed to load novels.");
      return;
    }
    const data = (await res.json()) as NovelItem[];
    setNovels(data);
  };

  const loadChapters = async (novelId: string) => {
    if (!authHeader) return;
    const res = await fetch(`${API_BASE}/admin/novels/${novelId}/chapters`, {
      headers: { ...authHeader }
    });
    if (!res.ok) return;
    const data = (await res.json()) as ChapterItem[];
    setChapters(data);
  };

  useEffect(() => {
    if (!authHeader) return;
    loadNovels().catch(() => undefined);
  }, [authHeader]);

  const resetForm = () => {
    setTitle("");
    setCoverImageUrl("");
    setDescription("");
    setTags("");
    setAudience("ALL");
    setIsFeatured(false);
    setAutoPostHall(true);
    setCoverFile(null);
    setPdfFile(null);
    setFreeCount("2");
  };

  const handleUploadCover = async () => {
    if (!authHeader || !coverFile) return;
    if (coverFile.size > 10 * 1024 * 1024) {
      setStatus("Cover image must be 10MB or smaller.");
      return;
    }
    setCoverUploading(true);
    setStatus(null);
    const form = new FormData();
    form.append("file", coverFile);
    try {
      const res = await fetch(`${API_BASE}/uploads/image`, {
        method: "POST",
        headers: { ...authHeader },
        body: form
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 413) {
          setStatus("Cover image too large. Please use 10MB or smaller.");
        } else {
          setStatus(data?.message ?? "Failed to upload cover.");
        }
        return;
      }
      if (data?.imageUrl) {
        setCoverImageUrl(data.imageUrl);
        setCoverFile(null);
      }
    } finally {
      setCoverUploading(false);
    }
  };

  const handleUploadPdf = async () => {
    if (!authHeader || !pdfFile) return;
    if (!selectedNovel) {
      setStatus("Save the novel first, then upload the PDF.");
      return;
    }
    setPdfUploading(true);
    setStatus(null);
    const form = new FormData();
    form.append("file", pdfFile);
    form.append("freeCount", freeCount.trim() || "2");
    try {
      const res = await fetch(`${API_BASE}/admin/novels/${selectedNovel.id}/pdf`, {
        method: "POST",
        headers: { ...authHeader },
        body: form
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(data?.message ?? "Failed to import PDF.");
        return;
      }
      setStatus(
        `Imported ${data?.chapterCount ?? 0} chapters from PDF.`
      );
      setPdfFile(null);
      await loadChapters(selectedNovel.id);
    } finally {
      setPdfUploading(false);
    }
  };

  const handleSaveNovel = async () => {
    if (!authHeader) return;
    setStatus(null);
    if (!title.trim()) {
      setStatus("Title is required.");
      return;
    }
    const payload = {
      title,
      coverImageUrl,
      description,
      tagsJson: parseTags(tags),
      audience,
      isFeatured,
      autoHallPost: autoPostHall
    };
    const res = await fetch(
      `${API_BASE}/admin/novels${selectedNovel ? `/${selectedNovel.id}` : ""}`,
      {
        method: selectedNovel ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader
        },
        body: JSON.stringify(payload)
      }
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const message =
        Array.isArray(body?.message) ? body.message.join(" / ") : body?.message;
      setStatus(message ?? "Failed to save novel.");
      return;
    }
    setDrawerOpen(false);
    resetForm();
    setSelectedNovel(null);
    await loadNovels();
  };

  const handleOpenCreate = () => {
    setSelectedNovel(null);
    resetForm();
    setDrawerOpen(true);
  };

  const handleEditNovel = (novel: NovelItem) => {
    setSelectedNovel(novel);
    setTitle(novel.title);
    setCoverImageUrl(novel.coverImageUrl ?? "");
    setDescription(novel.description ?? "");
    setTags((novel.tagsJson ?? []).join(", "));
    setAudience(novel.audience);
    setIsFeatured(novel.isFeatured);
    setDrawerOpen(true);
    loadChapters(novel.id).catch(() => undefined);
  };

  const handleUpdateStatus = async (novelId: string, nextStatus: NovelItem["status"]) => {
    if (!authHeader) return;
    const res = await fetch(`${API_BASE}/admin/novels/${novelId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...authHeader
      },
      body: JSON.stringify({ status: nextStatus })
    });
    if (!res.ok) {
      setStatus("Failed to update novel status.");
      return;
    }
    await loadNovels();
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 text-slate-100">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Novel library</h1>
          <p className="mt-1 text-sm text-slate-400">
            Manage operational status, visibility, and hall promotion.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-full border border-white/20 px-3 py-1 text-xs text-slate-200"
            onClick={() => loadNovels()}
          >
            Refresh
          </button>
          <button
            type="button"
            className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-900 shadow-[0_0_20px_rgba(255,255,255,0.3)]"
            onClick={handleOpenCreate}
          >
            + Create Novel
          </button>
        </div>
      </div>

      {status && <p className="mt-3 text-sm text-rose-400">{status}</p>}

      <div className="mt-8 grid gap-4">
        {novels.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center text-sm text-slate-500">
            No novels in the library yet. Start by creating one.
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          {novels.map((novel) => (
            <div
              key={novel.id}
              className="group relative flex gap-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4 transition hover:bg-slate-900/60"
            >
              <div className="h-32 w-24 flex-shrink-0 overflow-hidden rounded-lg border border-white/5 bg-slate-900">
                {novel.coverImageUrl ? (
                  <img
                    src={resolveMediaUrl(novel.coverImageUrl) ?? ""}
                    alt={novel.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-600 uppercase">
                    No Cover
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col justify-between py-1">
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-100 line-clamp-1">{novel.title}</h3>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          novel.status === "PUBLISHED" ? "bg-emerald-500/20 text-emerald-400" :
                          novel.status === "DRAFT" ? "bg-slate-500/20 text-slate-400" :
                          novel.status === "ARCHIVED" ? "bg-rose-500/20 text-rose-400" :
                          "bg-amber-500/20 text-amber-400"
                        }`}>
                          {novel.status}
                        </span>
                        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">
                          {novel.audience}
                        </span>
                        {novel.isFeatured && (
                          <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] text-amber-300">
                            Featured
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-slate-400 line-clamp-2">
                    {novel.description || "No description provided."}
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-[10px] text-slate-500">
                    <span>{novel._count?.chapters ?? 0} Chapters</span>
                    <span>•</span>
                    <span>{novel.room?._count?.memberships ?? 0} Room Members</span>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 transition group-hover:opacity-100">
                    <button
                      type="button"
                      className="rounded-full border border-white/20 px-3 py-1 text-[10px] text-slate-200 hover:bg-white/10"
                      onClick={() => handleEditNovel(novel)}
                    >
                      Edit
                    </button>
                    {novel.status !== "PUBLISHED" && (
                      <button
                        type="button"
                        className="rounded-full border border-emerald-500/30 px-3 py-1 text-[10px] text-emerald-300 hover:bg-emerald-500/10"
                        onClick={() => handleUpdateStatus(novel.id, "PUBLISHED")}
                      >
                        Publish
                      </button>
                    )}
                    {novel.status === "PUBLISHED" && (
                      <button
                        type="button"
                        className="rounded-full border border-white/20 px-3 py-1 text-[10px] text-slate-200 hover:bg-white/10"
                        onClick={() => handleUpdateStatus(novel.id, "DRAFT")}
                      >
                        Unpublish
                      </button>
                    )}
                    {novel.status !== "ARCHIVED" && (
                      <button
                        type="button"
                        className="rounded-full border border-rose-500/30 px-3 py-1 text-[10px] text-rose-300 hover:bg-rose-500/10"
                        onClick={() => handleUpdateStatus(novel.id, "ARCHIVED")}
                      >
                        Archive
                      </button>
                    )}
                    {novel.status === "ARCHIVED" && (
                      <button
                        type="button"
                        className="rounded-full border border-white/20 px-3 py-1 text-[10px] text-slate-200 hover:bg-white/10"
                        onClick={() => handleUpdateStatus(novel.id, "DRAFT")}
                      >
                        Restore
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end bg-slate-950/60 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setDrawerOpen(false)} />
          <div className="relative h-full w-full max-w-xl overflow-y-auto border-l border-white/10 bg-slate-950 p-8 shadow-[0_0_100px_rgba(0,0,0,0.8)]">
            <div className="flex items-center justify-between border-b border-white/10 pb-6">
              <h2 className="text-xl font-semibold">
                {selectedNovel ? "Novel Operations" : "New Novel Entry"}
              </h2>
              <button
                type="button"
                className="rounded-full border border-white/20 px-4 py-1.5 text-xs text-slate-300 hover:text-white"
                onClick={() => setDrawerOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="mt-8 space-y-8">
              {/* Basic Info */}
              <section className="space-y-4">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.3em] text-slate-500">
                  Basic Information
                </h3>
                <div className="grid gap-4">
                  <label className="text-xs text-slate-300">
                    Title
                    <input
                      className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white focus:border-amber-400"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </label>
                  <label className="text-xs text-slate-300">
                    Cover Image (upload)
                    <input
                      type="file"
                      accept="image/*"
                      className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white"
                      onChange={(event) =>
                        setCoverFile(event.target.files?.[0] ?? null)
                      }
                    />
                    {coverFile && (
                      <p className="mt-2 text-[10px] text-slate-500">
                        Selected: {coverFile.name} ·{" "}
                        {(coverFile.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    )}
                    <div className="mt-3 flex items-center gap-3">
                      <button
                        type="button"
                        className="rounded-full border border-white/20 px-4 py-1.5 text-xs text-slate-200"
                        disabled={!coverFile || coverUploading}
                        onClick={handleUploadCover}
                      >
                        {coverUploading ? "Uploading..." : "Upload cover"}
                      </button>
                      {coverImageUrl && (
                        <span className="text-[10px] text-slate-400">
                          Cover uploaded
                        </span>
                      )}
                    </div>
                    {coverImageUrl && (
                      <div className="mt-3 h-28 w-20 overflow-hidden rounded-lg border border-white/10 bg-slate-900">
                        <img
                          src={resolveMediaUrl(coverImageUrl) ?? ""}
                          alt="Cover preview"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}
                  </label>
                  <label className="text-xs text-slate-300">
                    Description
                    <textarea
                      className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white"
                      rows={4}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </label>
                  <label className="text-xs text-slate-300">
                    Tags (comma separated)
                    <input
                      className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white"
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                      placeholder="Romance, Fantasy, Mystery"
                    />
                  </label>
                </div>
              </section>

              {/* Content Import */}
              <section className="space-y-4">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.3em] text-slate-500">
                  Novel Content (PDF)
                </h3>
                <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                  <label className="text-xs text-slate-300">
                    Upload PDF
                    <input
                      type="file"
                      accept="application/pdf"
                      className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white"
                      onChange={(event) =>
                        setPdfFile(event.target.files?.[0] ?? null)
                      }
                    />
                  </label>
                  <label className="mt-3 block text-xs text-slate-300">
                    Free chapters count
                    <input
                      type="number"
                      min={0}
                      className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white"
                      value={freeCount}
                      onChange={(event) => setFreeCount(event.target.value)}
                    />
                  </label>
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      type="button"
                      className="rounded-full border border-white/20 px-4 py-1.5 text-xs text-slate-200"
                      disabled={!pdfFile || pdfUploading}
                      onClick={handleUploadPdf}
                    >
                      {pdfUploading ? "Importing..." : "Import PDF"}
                    </button>
                    <span className="text-[10px] text-slate-500">
                      PDF will be parsed into chapters automatically.
                    </span>
                  </div>
                </div>
              </section>

              {selectedNovel && chapters.length > 0 && (
                <section className="space-y-4">
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.3em] text-slate-500">
                    Chapter Preview
                  </h3>
                  <div className="max-h-72 overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/60">
                    {chapters.map((chapter) => (
                      <div
                        key={chapter.id}
                        className="border-b border-white/5 px-4 py-3"
                      >
                        <div className="flex items-center justify-between text-xs text-slate-200">
                          <span>
                            {chapter.orderIndex}. {chapter.title}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {chapter.isFree ? "Free" : "Locked"}
                          </span>
                        </div>
                        <p className="mt-2 text-[11px] text-slate-400 line-clamp-3">
                          {chapter.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Visibility & Compliance */}
              <section className="space-y-4">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.3em] text-slate-500">
                  Visibility & Compliance
                </h3>
                <div className="flex flex-wrap gap-6 rounded-2xl border border-white/5 bg-white/5 p-4">
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] text-slate-500 uppercase">Audience</span>
                    <select
                      className="rounded-full border border-white/10 bg-slate-900 px-3 py-1.5 text-xs text-white"
                      value={audience}
                      onChange={(e) => setAudience(e.target.value as any)}
                    >
                      <option value="ALL">All Audiences</option>
                      <option value="MATURE">Mature (18+)</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-4 pt-4">
                    <label className="flex items-center gap-2 text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={isFeatured}
                        onChange={(e) => setIsFeatured(e.target.checked)}
                        className="h-4 w-4 rounded bg-slate-900"
                      />
                      Featured
                    </label>
                  </div>
                </div>
              </section>

              {/* Operational Settings */}
              <section className="space-y-4">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.3em] text-slate-500">
                  Operational Settings
                </h3>
                <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                  <label className="flex items-center gap-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={autoPostHall}
                      onChange={(e) => setAutoPostHall(e.target.checked)}
                      className="h-4 w-4 rounded bg-slate-900"
                    />
                    Auto-post to Hall upon publishing
                  </label>
                  <p className="mt-2 text-[10px] text-slate-500 leading-relaxed">
                    When this novel status changes to Published, an official post will be created automatically in the Hall with the cover and description.
                  </p>
                </div>
              </section>

              <div className="flex items-center justify-end gap-3 pt-6">
                <button
                  type="button"
                  className="rounded-full border border-white/20 px-6 py-2.5 text-xs font-semibold text-white hover:bg-white/5"
                  onClick={() => setDrawerOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-full bg-white px-8 py-2.5 text-xs font-bold text-slate-900 shadow-[0_10px_30px_rgba(255,255,255,0.2)]"
                  onClick={handleSaveNovel}
                >
                  {selectedNovel ? "Save Changes" : "Create & Launch"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
