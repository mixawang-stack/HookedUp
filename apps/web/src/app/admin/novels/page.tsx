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
  status: "DRAFT" | "PUBLISHED";
  category: "DRAMA" | "AFTER_DARK";
  isFeatured: boolean;
  _count?: { chapters: number };
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

export default function AdminNovelsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [novels, setNovels] = useState<NovelItem[]>([]);
  const [selectedNovel, setSelectedNovel] = useState<NovelItem | null>(null);
  const [chapters, setChapters] = useState<ChapterItem[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [novelStatus, setNovelStatus] = useState<"DRAFT" | "PUBLISHED">("DRAFT");
  const [category, setCategory] = useState<NovelItem["category"]>("DRAMA");
  const [isFeatured, setIsFeatured] = useState(false);
  const [contentFile, setContentFile] = useState<File | null>(null);
  const [contentUploading, setContentUploading] = useState(false);
  const [contentStatus, setContentStatus] = useState<string | null>(null);

  const [chapterTitle, setChapterTitle] = useState("");
  const [chapterContent, setChapterContent] = useState("");
  const [chapterOrder, setChapterOrder] = useState(1);
  const [chapterFree, setChapterFree] = useState(false);

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
    if (!res.ok) {
      setStatus("Failed to load chapters.");
      return;
    }
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
    setNovelStatus("DRAFT");
    setCategory("DRAMA");
    setIsFeatured(false);
    setContentFile(null);
    setContentStatus(null);
  };

  const handleSaveNovel = async () => {
    if (!authHeader) return;
    setStatus(null);
    const payload = {
      title,
      coverImageUrl,
      description,
      tagsJson: parseTags(tags),
      status: novelStatus,
      category,
      isFeatured
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
      setStatus(body?.message ?? "Failed to save novel.");
      return;
    }
    resetForm();
    setSelectedNovel(null);
    await loadNovels();
  };

  const handleUploadContent = async () => {
    if (!authHeader || !contentFile) return;
    if (!selectedNovel) {
      setStatus("Save the novel first, then upload content.");
      return;
    }
    setContentUploading(true);
    setStatus(null);
    setContentStatus(null);
    const form = new FormData();
    form.append("file", contentFile);
    const isPdf = contentFile.name.toLowerCase().endsWith(".pdf");
    if (isPdf) {
      form.append("asAttachmentOnly", "true");
    }
    try {
      const res = await fetch(
        `${API_BASE}/admin/novels/${selectedNovel.id}/content`,
        {
          method: "POST",
          headers: { ...authHeader },
          body: form
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(data?.message ?? "Failed to upload content.");
        return;
      }
      setContentStatus(
        `Parsed ${data?.chapterCount ?? 0} chapters - ${data?.wordCount ?? 0} words`
      );
      setContentFile(null);
      await loadChapters(selectedNovel.id);
    } finally {
      setContentUploading(false);
    }
  };

  const handleEditNovel = (novel: NovelItem) => {
    setSelectedNovel(novel);
    setTitle(novel.title);
    setCoverImageUrl(novel.coverImageUrl ?? "");
    setDescription(novel.description ?? "");
    setTags((novel.tagsJson ?? []).join(", "));
    setNovelStatus(novel.status);
    setCategory(novel.category ?? "DRAMA");
    setIsFeatured(novel.isFeatured);
    loadChapters(novel.id).catch(() => undefined);
  };

  const handleDeleteNovel = async (novelId: string) => {
    if (!authHeader) return;
    if (!confirm("Delete this novel?")) return;
    const res = await fetch(`${API_BASE}/admin/novels/${novelId}`, {
      method: "DELETE",
      headers: { ...authHeader }
    });
    if (!res.ok) {
      setStatus("Failed to delete novel.");
      return;
    }
    setSelectedNovel(null);
    setChapters([]);
    await loadNovels();
  };

  const handleAddChapter = async () => {
    if (!authHeader || !selectedNovel) return;
    const res = await fetch(
      `${API_BASE}/admin/novels/${selectedNovel.id}/chapters`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader
        },
        body: JSON.stringify({
          title: chapterTitle,
          content: chapterContent,
          orderIndex: chapterOrder,
          isFree: chapterFree
        })
      }
    );
    if (!res.ok) {
      setStatus("Failed to add chapter.");
      return;
    }
    setChapterTitle("");
    setChapterContent("");
    setChapterOrder((prev) => prev + 1);
    setChapterFree(false);
    await loadChapters(selectedNovel.id);
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 text-slate-100">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Novel management</h1>
          <p className="mt-1 text-sm text-slate-400">
            Create, publish, and update novels for the Hall.
          </p>
        </div>
        <button
          type="button"
          className="rounded-full border border-white/20 px-3 py-1 text-xs text-slate-200"
          onClick={() => loadNovels()}
        >
          Refresh
        </button>
      </div>

      {status && <p className="mt-3 text-sm text-rose-400">{status}</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
        <div className="space-y-4">
          {novels.length === 0 && (
            <p className="text-sm text-slate-400">No novels yet.</p>
          )}
          {novels.map((novel) => (
            <div
              key={novel.id}
              className="rounded-2xl border border-white/10 bg-slate-950/70 p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{novel.title}</p>
                  <p className="text-xs text-slate-400">
                    {novel.status} · Chapters {novel._count?.chapters ?? 0}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-white/20 px-3 py-1 text-xs text-slate-200"
                    onClick={() => handleEditNovel(novel)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-rose-400/60 px-3 py-1 text-xs text-rose-200"
                    onClick={() => handleDeleteNovel(novel.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
              {novel.description && (
                <p className="mt-2 text-xs text-slate-400">{novel.description}</p>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/80 p-5">
          <h2 className="text-sm font-semibold">
            {selectedNovel ? "Edit novel" : "Create novel"}
          </h2>
          <label className="text-xs text-slate-300">
            Title
            <input
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label className="text-xs text-slate-300">
            Cover image URL
            <input
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
              value={coverImageUrl}
              onChange={(event) => setCoverImageUrl(event.target.value)}
            />
          </label>
          <label className="text-xs text-slate-300">
            Description
            <textarea
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <label className="text-xs text-slate-300">
            Tags (comma separated)
            <input
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
            />
          </label>
          <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3 text-xs text-slate-300">
            <p className="text-[10px] text-slate-500">
              Recommended: .docx / .txt / .md for best reading experience.
            </p>
            <p className="text-[10px] text-slate-500">
              PDF is saved as attachment only.
            </p>
            <label className="mt-2 block text-xs text-slate-300">
              Upload content
              <input
                type="file"
                accept=".docx,.txt,.md,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
                onChange={(event) =>
                  setContentFile(event.target.files?.[0] ?? null)
                }
              />
            </label>
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                className="rounded-full border border-white/20 px-3 py-1 text-xs text-slate-200"
                disabled={!contentFile || contentUploading}
                onClick={handleUploadContent}
              >
                {contentUploading ? "Uploading..." : "Upload content"}
              </button>
              {contentStatus && (
                <span className="text-[10px] text-slate-400">{contentStatus}</span>
              )}
            </div>
          </div>
          <label className="text-xs text-slate-300">
            Category
            <select
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
              value={category}
              onChange={(event) => setCategory(event.target.value as NovelItem["category"])}
            >
              <option value="DRAMA">Drama</option>
              <option value="AFTER_DARK">After Dark</option>
            </select>
          </label>
          <div className="flex items-center gap-3 text-xs text-slate-300">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(event) => setIsFeatured(event.target.checked)}
              />
              Featured
            </label>
            <select
              className="rounded-full border border-white/15 bg-slate-950/60 px-3 py-1 text-xs text-white"
              value={novelStatus}
              onChange={(event) => setNovelStatus(event.target.value as "DRAFT" | "PUBLISHED")}
            >
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
            </select>
          </div>
          <div className="flex items-center justify-end gap-2">
            {selectedNovel && (
              <button
                type="button"
                className="rounded-full border border-white/20 px-3 py-1 text-xs text-slate-200"
                onClick={() => {
                  setSelectedNovel(null);
                  resetForm();
                  setChapters([]);
                }}
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-900"
              onClick={handleSaveNovel}
            >
              Save
            </button>
          </div>

          {selectedNovel && (
            <div className="mt-6 space-y-3 border-t border-white/10 pt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                Chapters
              </p>
              {chapters.map((chapter) => (
                <div
                  key={chapter.id}
                  className="rounded-xl border border-white/10 bg-slate-900/40 p-3 text-xs text-slate-300"
                >
                  <div className="flex items-center justify-between">
                    <span>
                      #{chapter.orderIndex} · {chapter.title}
                    </span>
                    <span>{chapter.isFree ? "Free" : "Paid"}</span>
                  </div>
                </div>
              ))}

              <div className="space-y-2 rounded-xl border border-white/10 bg-slate-900/40 p-3">
                <p className="text-xs font-semibold text-slate-300">Add chapter</p>
                <input
                  className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-white"
                  placeholder="Chapter title"
                  value={chapterTitle}
                  onChange={(event) => setChapterTitle(event.target.value)}
                />
                <textarea
                  className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-white"
                  rows={3}
                  placeholder="Chapter content"
                  value={chapterContent}
                  onChange={(event) => setChapterContent(event.target.value)}
                />
                <div className="flex items-center gap-3 text-xs text-slate-300">
                  <input
                    type="number"
                    min={1}
                    className="w-20 rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1 text-xs text-white"
                    value={chapterOrder}
                    onChange={(event) => setChapterOrder(Number(event.target.value))}
                  />
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={chapterFree}
                      onChange={(event) => setChapterFree(event.target.checked)}
                    />
                    Free
                  </label>
                </div>
                <button
                  type="button"
                  className="w-full rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-900"
                  onClick={handleAddChapter}
                >
                  Add chapter
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
