"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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
  category: "DRAMA" | "AFTER_DARK";
  isFeatured: boolean;
  authorName: string | null;
  language: string | null;
  autoHallPost?: boolean;
  parseStatus?: "PENDING" | "PARSED" | "FAILED";
  parseError?: string | null;
  needsChapterReview?: boolean;
  contentRawText?: string | null;
};

type ChapterItem = {
  id: string;
  title: string;
  content: string;
  orderIndex: number;
  isFree: boolean;
  isPublished: boolean;
};

type Props = {
  novelId?: string;
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

export default function NovelEditor({ novelId }: Props) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [selectedNovel, setSelectedNovel] = useState<NovelItem | null>(null);
  const [chapters, setChapters] = useState<ChapterItem[]>([]);
  const [fullText, setFullText] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [step, setStep] = useState(1);

  const [title, setTitle] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [audience, setAudience] = useState<NovelItem["audience"]>("ALL");
  const [category, setCategory] = useState<NovelItem["category"]>("DRAMA");
  const [isFeatured, setIsFeatured] = useState(false);
  const [autoPostHall, setAutoPostHall] = useState(true);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [contentFile, setContentFile] = useState<File | null>(null);
  const [contentUploading, setContentUploading] = useState(false);
  const [contentStatus, setContentStatus] = useState<string | null>(null);

  const authHeader = useMemo(() => {
    if (!token) return null;
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  useEffect(() => {
    const stored = localStorage.getItem("accessToken");
    if (stored) setToken(stored);
  }, []);

  const loadNovel = async (id: string) => {
    if (!authHeader) return;
    const res = await fetch(`${API_BASE}/admin/novels/${id}`, {
      headers: { ...authHeader }
    });
    if (!res.ok) {
      setStatus("Novel not found.");
      return;
    }
    const found = (await res.json()) as NovelItem;
    setSelectedNovel(found);
    setTitle(found.title);
    setCoverImageUrl(found.coverImageUrl ?? "");
    setDescription(found.description ?? "");
    setTags((found.tagsJson ?? []).join(", "));
    setAudience(found.audience);
    setCategory(found.category ?? "DRAMA");
    setIsFeatured(found.isFeatured);
    setAutoPostHall(found.autoHallPost ?? true);
    setFullText(found.contentRawText ?? "");
    return found;
  };

  const loadChapters = async (id: string) => {
    if (!authHeader) return;
    setChapters([]);
    const res = await fetch(`${API_BASE}/admin/novels/${id}/chapters?t=${Date.now()}`, {
      headers: { ...authHeader },
      cache: "no-store"
    });
    if (!res.ok) return;
    const data = (await res.json()) as ChapterItem[];
    setChapters(data);
    return data;
  };

  useEffect(() => {
    if (!authHeader) return;
    if (novelId) {
      loadNovel(novelId).catch(() => undefined);
      loadChapters(novelId).catch(() => undefined);
    }
  }, [authHeader, novelId]);

  const uploadCoverIfNeeded = async () => {
    if (!authHeader || !coverFile) return coverImageUrl;
    if (coverFile.size > 10 * 1024 * 1024) {
      setStatus("Cover image must be 10MB or smaller.");
      throw new Error("COVER_TOO_LARGE");
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
        throw new Error("UPLOAD_FAILED");
      }
      if (data?.imageUrl) {
        setCoverImageUrl(data.imageUrl);
        setCoverFile(null);
        return data.imageUrl as string;
      }
      return coverImageUrl;
    } finally {
      setCoverUploading(false);
    }
  };

  const uploadContentFile = async (id: string, file: File) => {
    if (!authHeader) return false;
    setContentUploading(true);
    setStatus(null);
    setContentStatus(null);
    const form = new FormData();
    form.append("file", file);
    const isPdf = file.name.toLowerCase().endsWith(".pdf");
    if (isPdf) {
      form.append("asAttachmentOnly", "true");
    }
    try {
      const res = await fetch(`${API_BASE}/admin/novels/${id}/upload`, {
        method: "POST",
        headers: { ...authHeader },
        cache: "no-store",
        body: form
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(data?.message ?? "Failed to upload content.");
        return false;
      }
      setContentStatus(
        `Parsed ${data?.chapterCount ?? 0} chapters - ${data?.wordCount ?? 0} words`
      );
      setContentFile(null);
      const parsedChapters = await loadChapters(id);
      await loadNovel(id);
      if ((parsedChapters ?? []).length > 0) {
        setStatus("Parsing completed. You can preview now.");
      } else {
        setStatus("Upload succeeded. Parsing may still be running.");
      }
      return true;
    } finally {
      setContentUploading(false);
    }
  };

  const handleSaveBasics = async () => {
    if (!authHeader) return;
    setStatus(null);
    if (!title.trim()) {
      setStatus("Title is required.");
      return;
    }
    setSaving(true);
    setStatus("Saving...");
    try {
      const uploadedCoverUrl = await uploadCoverIfNeeded();
      const payload = {
        title,
        coverImageUrl: uploadedCoverUrl ?? coverImageUrl,
        description,
        tagsJson: parseTags(tags),
        audience,
        category,
        isFeatured,
        autoHallPost: autoPostHall,
        status: "DRAFT"
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
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message =
          Array.isArray(body?.message) ? body.message.join(" / ") : body?.message;
        setStatus(message ?? "Failed to save novel.");
        return;
      }
      const saved = body as NovelItem;
      setSelectedNovel(saved);
      if (!selectedNovel) {
        router.replace(`/novels/${saved.id}`);
      }
      setStep(2);
      setStatus(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save novel.";
      setStatus(message);
    } finally {
      setSaving(false);
    }
  };

  const handleUploadContent = async () => {
    if (!selectedNovel || !contentFile) {
      setStatus("Select a file to upload.");
      return;
    }
    const success = await uploadContentFile(selectedNovel.id, contentFile);
    if (success) {
      setStep(3);
    }
  };

  const handleSkipToPreview = async () => {
    if (!selectedNovel) return;
    let refreshedChapters = chapters;
    let refreshedNovel = selectedNovel;
    if (chapters.length === 0) {
      refreshedChapters = (await loadChapters(selectedNovel.id)) ?? [];
      refreshedNovel = (await loadNovel(selectedNovel.id)) ?? selectedNovel;
    }
    if (refreshedChapters.length === 0) {
      if (refreshedNovel.parseStatus === "FAILED") {
        setStatus(
          refreshedNovel.parseError ??
            "Parsing failed. Please re-upload or contact support."
        );
        return;
      }
      setStatus("No chapters parsed yet. Upload and parse a file first.");
      return;
    }
    setStep(3);
  };

  const handlePublish = async (nextStatus: "DRAFT" | "PUBLISHED") => {
    if (!authHeader || !selectedNovel) return;
    setSaving(true);
    setStatus("Saving...");
    try {
      const res = await fetch(`${API_BASE}/admin/novels/${selectedNovel.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeader
        },
        body: JSON.stringify({ status: nextStatus, autoHallPost: autoPostHall })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message =
          Array.isArray(body?.message) ? body.message.join(" / ") : body?.message;
        setStatus(message ?? "Failed to update novel.");
        return;
      }
      setSelectedNovel(body as NovelItem);
      setStatus(
        nextStatus === "PUBLISHED"
          ? "Published successfully."
          : "Saved as draft."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleChapterChange = (index: number, field: "title" | "content", value: string) => {
    setChapters((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSaveChapter = async (chapter: ChapterItem) => {
    if (!authHeader || !selectedNovel) return;
    const res = await fetch(
      `${API_BASE}/admin/novels/${selectedNovel.id}/chapters/${chapter.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeader
        },
        body: JSON.stringify({
          title: chapter.title,
          content: chapter.content,
          orderIndex: chapter.orderIndex,
          isFree: chapter.isFree,
          isPublished: chapter.isPublished
        })
      }
    );
    if (!res.ok) {
      setStatus("Failed to save chapter.");
      return;
    }
    await loadChapters(selectedNovel.id);
  };

  const handleAddChapter = async () => {
    if (!authHeader || !selectedNovel) return;
    const orderIndex = chapters.length + 1;
    const res = await fetch(`${API_BASE}/admin/novels/${selectedNovel.id}/chapters`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeader
      },
      body: JSON.stringify({
        title: `Chapter ${orderIndex}`,
        content: "",
        orderIndex,
        isFree: true,
        isPublished: true
      })
    });
    if (!res.ok) {
      setStatus("Failed to add chapter.");
      return;
    }
    await loadChapters(selectedNovel.id);
  };

  const handleDeleteChapter = async (chapterId: string) => {
    if (!authHeader || !selectedNovel) return;
    const res = await fetch(
      `${API_BASE}/admin/novels/${selectedNovel.id}/chapters/${chapterId}`,
      {
        method: "DELETE",
        headers: { ...authHeader }
      }
    );
    if (!res.ok) {
      setStatus("Failed to delete chapter.");
      return;
    }
    await loadChapters(selectedNovel.id);
  };

  const handleMoveChapter = async (index: number, direction: "up" | "down") => {
    if (!authHeader || !selectedNovel) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= chapters.length) return;
    const current = chapters[index];
    const target = chapters[targetIndex];
    await handleSaveChapter({ ...current, orderIndex: target.orderIndex });
    await handleSaveChapter({ ...target, orderIndex: current.orderIndex });
    await loadChapters(selectedNovel.id);
  };

  const steps = [
    "Basics",
    "Upload content",
    "Preview",
    "Operational settings"
  ];

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 text-slate-100">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/novels" className="text-xs text-slate-400">
            &larr; Back to library
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">
            {selectedNovel ? "Edit novel" : "Create novel"}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            API: {API_BASE}
          </p>
        </div>
        {selectedNovel?.id && (
          <div className="text-[11px] text-slate-500">ID: {selectedNovel.id}</div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-2 text-xs text-slate-400">
        {steps.map((label, index) => {
          const stepIndex = index + 1;
          const isActive = stepIndex === step;
          return (
            <button
              key={`step-${label}`}
              type="button"
              className={`rounded-full border px-3 py-1 ${
                isActive ? "border-white/50 text-white" : "border-white/10"
              }`}
              onClick={() => setStep(stepIndex)}
            >
              {stepIndex}. {label}
            </button>
          );
        })}
      </div>

      {status && <p className="mt-4 text-sm text-rose-400">{status}</p>}

      {step === 1 && (
        <section className="mt-8 space-y-6">
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
            <h2 className="text-sm font-semibold text-slate-200">Basic info</h2>
            <div className="mt-4 grid gap-4">
              <label className="text-xs text-slate-300">
                Title
                <input
                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>
              <label className="text-xs text-slate-300">
                Cover image
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
                    Selected: {coverFile.name} -{" "}
                    {(coverFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                )}
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
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>
              <label className="text-xs text-slate-300">
                Tags (comma separated)
                <input
                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white"
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                />
              </label>
              <label className="text-xs text-slate-300">
                Category
                <select
                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white"
                  value={category}
                  onChange={(event) =>
                    setCategory(event.target.value as NovelItem["category"])
                  }
                >
                  <option value="DRAMA">Drama</option>
                  <option value="AFTER_DARK">After Dark</option>
                </select>
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
            <h2 className="text-sm font-semibold text-slate-200">
              Visibility & compliance
            </h2>
            <div className="mt-4 flex flex-wrap gap-6">
              <label className="text-xs text-slate-300">
                Audience
                <select
                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white"
                  value={audience}
                  onChange={(event) =>
                    setAudience(event.target.value as NovelItem["audience"])
                  }
                >
                  <option value="ALL">All audiences</option>
                  <option value="MATURE">Mature (18+)</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(event) => setIsFeatured(event.target.checked)}
                  className="h-4 w-4 rounded bg-slate-900"
                />
                Featured
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              className="rounded-full border border-white/20 px-6 py-2 text-xs text-slate-200"
              onClick={() => handlePublish("DRAFT")}
              disabled={!selectedNovel || saving}
            >
              Save draft
            </button>
            <button
              type="button"
              className="rounded-full bg-white px-6 py-2 text-xs font-semibold text-slate-900"
              onClick={handleSaveBasics}
              disabled={saving || coverUploading}
            >
              {saving ? "Saving..." : "Save & continue"}
            </button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="mt-8 space-y-6">
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
            <h2 className="text-sm font-semibold text-slate-200">Upload content</h2>
            <p className="mt-2 text-[11px] text-slate-500">
              Supported: .doc, .docx, .txt, .md, .pdf (pdf saved as attachment only).
            </p>
            <label className="mt-4 block text-xs text-slate-300">
              Upload file
              <input
                type="file"
                accept=".doc,.docx,.txt,.md,.pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,application/pdf"
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white"
                onChange={(event) =>
                  setContentFile(event.target.files?.[0] ?? null)
                }
              />
            </label>
            {contentFile && (
              <p className="mt-2 text-[10px] text-slate-500">
                Selected: {contentFile.name} -{" "}
                {(contentFile.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            )}
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                className="rounded-full border border-white/20 px-4 py-1.5 text-xs text-slate-200"
                disabled={!selectedNovel || !contentFile || contentUploading}
                onClick={handleUploadContent}
              >
                {contentUploading ? "Uploading..." : "Upload & parse"}
              </button>
              {contentStatus && (
                <span className="text-[10px] text-slate-400">{contentStatus}</span>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <button
              type="button"
              className="rounded-full border border-white/20 px-6 py-2 text-xs text-slate-200"
              onClick={() => setStep(1)}
            >
              Back
            </button>
            <button
              type="button"
              className="rounded-full border border-white/20 px-6 py-2 text-xs text-slate-200"
              onClick={handleSkipToPreview}
            >
              Skip to preview
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="mt-8 space-y-6">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-200">
                  Extracted full text
                </h2>
                {selectedNovel?.needsChapterReview && (
                  <span className="text-[10px] text-amber-300">
                    Needs review
                  </span>
                )}
              </div>
              <textarea
                className="mt-4 h-[60vh] w-full rounded-xl border border-white/10 bg-slate-900/60 p-4 text-xs text-slate-200"
                value={fullText}
                readOnly
              />
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-200">
                  Chapters editor
                </h2>
                <button
                  type="button"
                  className="rounded-full border border-white/20 px-3 py-1 text-[10px] text-slate-200"
                  onClick={handleAddChapter}
                >
                  + Add chapter
                </button>
              </div>
              {chapters.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">
                  No chapters parsed yet.
                </p>
              ) : (
                <div className="mt-4 max-h-[60vh] space-y-4 overflow-y-auto">
                  {chapters.map((chapter, index) => (
                    <div key={chapter.id} className="rounded-xl border border-white/10 p-4">
                      <div className="flex items-center justify-between text-xs text-slate-200">
                        <span>Order {chapter.orderIndex}</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="rounded-full border border-white/10 px-2 py-0.5 text-[10px]"
                            onClick={() => handleMoveChapter(index, "up")}
                          >
                            Up
                          </button>
                          <button
                            type="button"
                            className="rounded-full border border-white/10 px-2 py-0.5 text-[10px]"
                            onClick={() => handleMoveChapter(index, "down")}
                          >
                            Down
                          </button>
                          <button
                            type="button"
                            className="rounded-full border border-rose-500/30 px-2 py-0.5 text-[10px] text-rose-300"
                            onClick={() => handleDeleteChapter(chapter.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <input
                        className="mt-3 w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-slate-100"
                        value={chapter.title}
                        onChange={(event) =>
                          handleChapterChange(index, "title", event.target.value)
                        }
                      />
                      <textarea
                        className="mt-3 h-32 w-full rounded-lg border border-white/10 bg-slate-900/60 p-3 text-xs text-slate-100"
                        value={chapter.content}
                        onChange={(event) =>
                          handleChapterChange(index, "content", event.target.value)
                        }
                      />
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          className="rounded-full border border-white/20 px-3 py-1 text-[10px] text-slate-200"
                          onClick={() => handleSaveChapter(chapter)}
                        >
                          Save chapter
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <button
              type="button"
              className="rounded-full border border-white/20 px-6 py-2 text-xs text-slate-200"
              onClick={() => setStep(2)}
            >
              Back to upload
            </button>
            <button
              type="button"
              className="rounded-full bg-white px-6 py-2 text-xs font-semibold text-slate-900"
              onClick={() => setStep(4)}
              disabled={chapters.length === 0}
            >
              Continue
            </button>
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="mt-8 space-y-6">
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
            <h2 className="text-sm font-semibold text-slate-200">
              Operational settings
            </h2>
            <label className="mt-4 flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={autoPostHall}
                onChange={(event) => setAutoPostHall(event.target.checked)}
                className="h-4 w-4 rounded bg-slate-900"
              />
              Auto-post to Hall upon publishing
            </label>
            <p className="mt-2 text-[10px] text-slate-500">
              When published, an official post is created in the Hall.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              className="rounded-full border border-white/20 px-6 py-2 text-xs text-slate-200"
              onClick={() => setStep(3)}
            >
              Back to preview
            </button>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-full border border-white/20 px-6 py-2 text-xs text-slate-200"
                onClick={() => handlePublish("DRAFT")}
                disabled={!selectedNovel || saving}
              >
                Save draft
              </button>
              <button
                type="button"
                className="rounded-full bg-white px-6 py-2 text-xs font-semibold text-slate-900"
                onClick={() => handlePublish("PUBLISHED")}
                disabled={!selectedNovel || saving}
              >
                {saving ? "Saving..." : "Publish to user side"}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
