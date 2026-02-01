"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "../../lib/supabaseClient";

export const dynamic = "force-dynamic";

const STORAGE_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "uploads";
const ADMIN_EMAIL = "admin@hookedup.me";

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
  pricingMode?: "BOOK" | "CHAPTER";
  bookPrice?: number | string | null;
  bookPromoPrice?: number | string | null;
  currency?: string | null;
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

const extractTextFromFile = async (file: File) => {
  return await file.text();
};

const splitChapters = (text: string) => {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const markers: Array<{ title: string }> = [];

  lines.forEach((line) => {
    const match = line.match(
      /^\s*(INTRO|EPILOGUE|CHAPTER\s*\d+)\s*\|\s*(.+)$/i
    );
    if (match) {
      markers.push({ title: match[2].trim() });
    }
  });

  if (markers.length === 0) {
    return [
      {
        title: "Chapter 1",
        content: text.trim()
      }
    ];
  }

  const chapters: Array<{ title: string; content: string }> = [];
  let currentTitle = "";
  let currentLines: string[] = [];

  const pushChapter = () => {
    if (!currentTitle) return;
    chapters.push({
      title: currentTitle,
      content: currentLines.join("\n").trim()
    });
  };

  lines.forEach((line) => {
    const match = line.match(
      /^\s*(INTRO|EPILOGUE|CHAPTER\s*\d+)\s*\|\s*(.+)$/i
    );
    if (match) {
      pushChapter();
      currentTitle = match[2].trim();
      currentLines = [];
      return;
    }
    currentLines.push(line);
  });
  pushChapter();

  return chapters.filter((chapter) => chapter.content.length > 0);
};

export default function AdminNovelsPage() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
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
  const [contentMode, setContentMode] = useState<"BOOK" | "CHAPTER">("BOOK");
  const [bookPrice, setBookPrice] = useState("");
  const [bookPromoPrice, setBookPromoPrice] = useState("");
  const [currency, setCurrency] = useState("USD");

  const [chapterTitle, setChapterTitle] = useState("");
  const [chapterContent, setChapterContent] = useState("");
  const [chapterOrder, setChapterOrder] = useState(1);
  const [chapterFree, setChapterFree] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      const { data } = await supabase.auth.getUser();
      setUserEmail(data.user?.email ?? null);
    };
    loadUser().catch(() => undefined);
  }, []);

  const loadNovels = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setStatus(null);
    const { data, error } = await supabase
      .from("Novel")
      .select(
        `
        id,
        title,
        coverImageUrl,
        description,
        tagsJson,
        status,
        category,
        isFeatured,
        pricingMode,
        bookPrice,
        bookPromoPrice,
        currency,
        chapters:NovelChapter(count)
      `
      )
      .order("createdAt", { ascending: false });
    if (error) {
      setStatus("Failed to load novels.");
      return;
    }
    const normalized =
      data?.map((item) => ({
        ...item,
        _count: { chapters: item.chapters?.[0]?.count ?? 0 }
      })) ?? [];
    setNovels(normalized as NovelItem[]);
  };

  const loadChapters = async (novelId: string) => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { data, error } = await supabase
      .from("NovelChapter")
      .select("id,title,content,orderIndex,isFree,isPublished")
      .eq("novelId", novelId)
      .order("orderIndex", { ascending: true });
    if (error) {
      setStatus("Failed to load chapters.");
      return;
    }
    setChapters((data ?? []) as ChapterItem[]);
  };

  useEffect(() => {
    if (!userEmail) return;
    loadNovels().catch(() => undefined);
  }, [userEmail]);

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
    setContentMode("BOOK");
    setBookPrice("");
    setBookPromoPrice("");
    setCurrency("USD");
  };

  const handleSaveNovel = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setStatus(null);
    const payload = {
      title,
      coverImageUrl,
      description,
      tagsJson: parseTags(tags),
      status: novelStatus,
      category,
      isFeatured,
      pricingMode: contentMode,
      bookPrice: bookPrice ? Number(bookPrice) : null,
      bookPromoPrice: bookPromoPrice ? Number(bookPromoPrice) : null,
      currency
    };
    if (selectedNovel) {
      const { error } = await supabase
        .from("Novel")
        .update(payload)
        .eq("id", selectedNovel.id);
      if (error) {
        setStatus("Failed to save novel.");
        return;
      }
    } else {
      const { error } = await supabase.from("Novel").insert(payload);
      if (error) {
        setStatus("Failed to save novel.");
        return;
      }
    }
    resetForm();
    setSelectedNovel(null);
    await loadNovels();
  };

  const uploadFileToStorage = async (file: File, novelId: string) => {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    const path = `novels/${novelId}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, { upsert: true });
    if (error) {
      throw new Error("Upload failed.");
    }
    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  };

  const handleUploadContent = async () => {
    if (!contentFile) return;
    if (!selectedNovel) {
      setStatus("Save the novel first, then upload content.");
      return;
    }
    setContentUploading(true);
    setStatus(null);
    setContentStatus(null);
    const supabase = getSupabaseClient();
    if (!supabase) {
      setStatus("Supabase is not configured.");
      setContentUploading(false);
      return;
    }
    const isPdf = contentFile.name.toLowerCase().endsWith(".pdf");
    const isDocx = contentFile.name.toLowerCase().endsWith(".docx");
    const isTxt = contentFile.name.toLowerCase().endsWith(".txt");
    const isMd = contentFile.name.toLowerCase().endsWith(".md");
    try {
      const fileUrl = await uploadFileToStorage(contentFile, selectedNovel.id);
      if (!fileUrl) {
        setStatus("Failed to upload file.");
        return;
      }
      if (isPdf || isDocx) {
        await supabase
          .from("Novel")
          .update({
            attachmentUrl: fileUrl,
            contentSourceType: isPdf ? "PDF" : "DOCX",
            parseStatus: "DONE",
            parsedChaptersCount: 0,
            lastParsedAt: new Date().toISOString()
          })
          .eq("id", selectedNovel.id);
        setContentStatus(
          "Uploaded attachment. Parsing not available for this file type."
        );
        return;
      }

      if (isTxt || isMd) {
        const text = await extractTextFromFile(contentFile);
        const chaptersParsed = splitChapters(text);
        const chaptersPayload = chaptersParsed.map((chapter, index) => ({
          novelId: selectedNovel.id,
          title: chapter.title,
          content: chapter.content,
          orderIndex: index + 1,
          isFree: index === 0,
          isPublished: true
        }));
        await supabase
          .from("NovelChapter")
          .delete()
          .eq("novelId", selectedNovel.id);
        if (chaptersPayload.length > 0) {
          await supabase.from("NovelChapter").insert(chaptersPayload);
        }
        const wordCount = text.split(/\s+/).filter(Boolean).length;
        await supabase
          .from("Novel")
          .update({
            contentSourceType: isMd ? "MD" : "TXT",
            parseStatus: "DONE",
            parsedChaptersCount: chaptersPayload.length,
            chapterCount: chaptersPayload.length,
            wordCount,
            lastParsedAt: new Date().toISOString()
          })
          .eq("id", selectedNovel.id);
        setContentStatus(
          `Parsed ${chaptersPayload.length} chapters - ${wordCount} words`
        );
        await loadChapters(selectedNovel.id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed.";
      setStatus(message);
    } finally {
      setContentUploading(false);
      setContentFile(null);
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
    setContentMode(novel.pricingMode ?? "BOOK");
    setBookPrice(novel.bookPrice ? String(novel.bookPrice) : "");
    setBookPromoPrice(novel.bookPromoPrice ? String(novel.bookPromoPrice) : "");
    setCurrency(novel.currency ?? "USD");
    loadChapters(novel.id).catch(() => undefined);
  };

  const handleDeleteNovel = async (novelId: string) => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    if (!confirm("Delete this novel?")) return;
    const { error } = await supabase.from("Novel").delete().eq("id", novelId);
    if (error) {
      setStatus("Failed to delete novel.");
      return;
    }
    setSelectedNovel(null);
    setChapters([]);
    await loadNovels();
  };

  const handleAddChapter = async () => {
    if (!selectedNovel) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { error } = await supabase.from("NovelChapter").insert({
      novelId: selectedNovel.id,
      title: chapterTitle,
      content: chapterContent,
      orderIndex: chapterOrder,
      isFree: chapterFree,
      isPublished: true
    });
    if (error) {
      setStatus("Failed to add chapter.");
      return;
    }
    await supabase
      .from("Novel")
      .update({ chapterCount: chapterOrder })
      .eq("id", selectedNovel.id);
    setChapterTitle("");
    setChapterContent("");
    setChapterOrder((prev) => prev + 1);
    setChapterFree(false);
    await loadChapters(selectedNovel.id);
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 text-slate-100">
      {userEmail && userEmail !== ADMIN_EMAIL && (
        <p className="mb-4 rounded-xl border border-rose-400/60 bg-rose-500/10 p-3 text-xs text-rose-200">
          You are signed in as {userEmail}. This page is restricted to admins.
        </p>
      )}
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
          <label className="text-xs text-slate-300">
            Pricing mode
            <select
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
              value={contentMode}
              onChange={(event) =>
                setContentMode(event.target.value as "BOOK" | "CHAPTER")
              }
            >
              <option value="BOOK">Book</option>
              <option value="CHAPTER">Chapter</option>
            </select>
          </label>
          {contentMode === "BOOK" && (
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs text-slate-300">
                Book price
                <input
                  type="number"
                  min={0}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
                  value={bookPrice}
                  onChange={(event) => setBookPrice(event.target.value)}
                />
              </label>
              <label className="text-xs text-slate-300">
                Promo price
                <input
                  type="number"
                  min={0}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
                  value={bookPromoPrice}
                  onChange={(event) => setBookPromoPrice(event.target.value)}
                />
              </label>
            </div>
          )}
          <label className="text-xs text-slate-300">
            Currency
            <input
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
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
                accept=".doc,.docx,.txt,.md,.pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,application/pdf"
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
