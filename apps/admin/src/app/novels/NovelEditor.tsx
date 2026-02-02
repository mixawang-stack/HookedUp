
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "../lib/supabaseClient";
import { cleanNovelText, dumpWeirdChars } from "../../utils/textClean";

const STORAGE_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "uploads";

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
  parseStatus?: "IDLE" | "UPLOADING" | "PARSING" | "DONE" | "ERROR";
  parseError?: string | null;
  needsChapterReview?: boolean;
  contentRawText?: string | null;
  parsedChaptersCount?: number | null;
  lastParsedAt?: string | null;
  contentSourceType?: "DOC" | "DOCX" | "TXT" | "MD" | "PDF";
  attachmentUrl?: string | null;
  pricingMode?: "BOOK" | "CHAPTER";
  bookPrice?: number | string | null;
  bookPromoPrice?: number | string | null;
  currency?: string | null;
  creemProductId?: string | null;
  paymentLink?: string | null;
};

type ChapterItem = {
  id: string;
  title: string;
  content: string;
  orderIndex: number;
  isFree: boolean;
  isPublished: boolean;
  price?: number | string | null;
};

type Props = {
  novelId?: string;
};

const parseTags = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

const parseMoney = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const extractTextFromFile = async (file: File) => {
  return await file.text();
};

const normalizeRawText = (text: string) => {
  if (!text) return text;
  let normalized = cleanNovelText(text).replace(/\r\n/g, "\n");
  const placeholderCount = (normalized.match(/口/g) ?? []).length;
  const spaceCount = (normalized.match(/ /g) ?? []).length;
  const newlineCount = (normalized.match(/\n/g) ?? []).length;
  if (
    placeholderCount > 0 &&
    spaceCount < placeholderCount / 4 &&
    placeholderCount > 20
  ) {
    normalized = normalized.replace(/口{2,}/g, "\n").replace(/口/g, " ");
  }
  if (newlineCount === 0 && placeholderCount > 0) {
    normalized = normalized.replace(/口{2,}/g, "\n");
  }
  return normalized;
};

const splitChapters = (text: string) => {
  const lines = normalizeRawText(text).split("\n");
  const markers: Array<{ title: string }> = [];
  const headingPattern =
    /^\s*(?:chapter|ch\.?)\s*(\d+|[ivxlcdm]+)\s*(?:[|:\-–—]\s*)?(.*)$/i;
  const cnHeadingPattern =
    /^\s*(第\s*\d+\s*章|序章|序|楔子|前言|终章|尾声|后记|番外)\s*(?:[|:\-–—]\s*)?(.*)$/i;

  lines.forEach((line) => {
    const introMatch = line.match(/^\s*(INTRO|EPILOGUE)\s*(?:[|:\-–—]\s*)?(.*)$/i);
    if (introMatch) {
      const title = (introMatch[2] ?? introMatch[1]).trim();
      markers.push({ title: title || introMatch[1] });
      return;
    }
    const cnMatch = line.match(cnHeadingPattern);
    if (cnMatch) {
      const title = `${cnMatch[1]}${cnMatch[2] ? ` ${cnMatch[2].trim()}` : ""}`.trim();
      markers.push({ title });
      return;
    }
    const enMatch = line.match(headingPattern);
    if (enMatch) {
      const title = `Chapter ${enMatch[1]}${enMatch[2] ? ` ${enMatch[2].trim()}` : ""}`.trim();
      markers.push({ title });
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
    const introMatch = line.match(/^\s*(INTRO|EPILOGUE)\s*(?:[|:\-–—]\s*)?(.*)$/i);
    if (introMatch) {
      pushChapter();
      currentTitle = (introMatch[2] ?? introMatch[1]).trim() || introMatch[1];
      currentLines = [];
      return;
    }
    const cnMatch = line.match(cnHeadingPattern);
    if (cnMatch) {
      pushChapter();
      currentTitle = `${cnMatch[1]}${cnMatch[2] ? ` ${cnMatch[2].trim()}` : ""}`.trim();
      currentLines = [];
      return;
    }
    const enMatch = line.match(headingPattern);
    if (enMatch) {
      pushChapter();
      currentTitle = `Chapter ${enMatch[1]}${enMatch[2] ? ` ${enMatch[2].trim()}` : ""}`.trim();
      currentLines = [];
      return;
    }
    currentLines.push(line);
  });
  pushChapter();

  return chapters.filter((chapter) => chapter.content.length > 0);
};

export default function NovelEditor({ novelId }: Props) {
  const router = useRouter();
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
  const [pendingNovelId, setPendingNovelId] = useState<string | null>(null);

  const [pricingMode, setPricingMode] = useState<"BOOK" | "CHAPTER">("BOOK");
  const [bookPrice, setBookPrice] = useState("");
  const [bookPromoPrice, setBookPromoPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [creemProductId, setCreemProductId] = useState("");
  const [paymentLink, setPaymentLink] = useState("");

  const [contentFile, setContentFile] = useState<File | null>(null);
  const [contentUploading, setContentUploading] = useState(false);
  const [contentStatus, setContentStatus] = useState<string | null>(null);

  const supabase = useMemo(() => getSupabaseClient(), []);
  const ensureDraftId = () => {
    if (selectedNovel?.id) return selectedNovel.id;
    if (pendingNovelId) return pendingNovelId;
    const id = crypto.randomUUID();
    setPendingNovelId(id);
    return id;
  };
  const loadNovel = async (id: string) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("Novel")
      .select(
        "id,title,coverImageUrl,description,tagsJson,status,audience,category,isFeatured,autoHallPost,parseStatus,parseError,needsChapterReview,contentRawText,parsedChaptersCount,lastParsedAt,contentSourceType,attachmentUrl,pricingMode,bookPrice,bookPromoPrice,currency,creemProductId,paymentLink"
      )
      .eq("id", id)
      .maybeSingle();
    if (error || !data) {
      setStatus("Novel not found.");
      return;
    }
    setSelectedNovel(data as NovelItem);
    setTitle(data.title);
    setCoverImageUrl(data.coverImageUrl ?? "");
    setDescription(data.description ?? "");
    setTags((data.tagsJson ?? []).join(", "));
    setAudience(data.audience ?? "ALL");
    setCategory(data.category ?? "DRAMA");
    setIsFeatured(Boolean(data.isFeatured));
    setAutoPostHall(data.autoHallPost ?? true);
    setPricingMode(data.pricingMode ?? "BOOK");
    setBookPrice(data.bookPrice?.toString() ?? "");
    setBookPromoPrice(data.bookPromoPrice?.toString() ?? "");
    setCurrency(data.currency ?? "USD");
    setCreemProductId(data.creemProductId ?? "");
    setPaymentLink(data.paymentLink ?? "");
    if (data.contentRawText) {
      setFullText(data.contentRawText);
    }
    return data as NovelItem;
  };

  const loadChapters = async (id: string) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("NovelChapter")
      .select("id,title,content,orderIndex,isFree,isPublished,price")
      .eq("novelId", id)
      .order("orderIndex", { ascending: true });
    if (error) {
      setStatus("Failed to load chapters.");
      return;
    }
    setChapters((data ?? []) as ChapterItem[]);
    if (fullText.trim().length === 0 && (data ?? []).length > 0) {
      setFullText(
        (data ?? [])
          .map((chapter) => `${chapter.title}\n\n${chapter.content}`.trim())
          .join("\n\n")
      );
    }
    return data as ChapterItem[];
  };

  useEffect(() => {
    if (!supabase) return;
    if (novelId) {
      loadNovel(novelId).catch(() => undefined);
      loadChapters(novelId).catch(() => undefined);
    }
  }, [novelId, supabase]);

  const toSafeFileName = (name: string) => {
    const extMatch = name.match(/\.([^.]+)$/);
    const ext = extMatch ? `.${extMatch[1]}` : "";
    const base = name.replace(/\.[^.]+$/, "");
    const safeBase = base
      .normalize("NFKD")
      .replace(/[^\w.-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
    const safeExt = ext.replace(/[^\w.]+/g, "");
    return `${safeBase || "file"}${safeExt}`;
  };

  const uploadCoverIfNeeded = async () => {
    if (!supabase || !coverFile) return coverImageUrl;
    if (coverFile.size > 10 * 1024 * 1024) {
      setStatus("Cover image must be 10MB or smaller.");
      throw new Error("COVER_TOO_LARGE");
    }
    setCoverUploading(true);
    setStatus(null);
    const draftId = ensureDraftId();
    const path = `novels/${draftId}/covers/${Date.now()}-${toSafeFileName(
      coverFile.name
    )}`;
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, coverFile, { upsert: true });
    setCoverUploading(false);
    if (error) {
      setStatus(`Failed to upload cover: ${error.message}`);
      throw new Error("UPLOAD_FAILED");
    }
    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    setCoverImageUrl(data.publicUrl);
    setCoverFile(null);
    return data.publicUrl;
  };

  const handleSaveBasics = async () => {
    if (!supabase) return;
    setStatus(null);
    if (!title.trim()) {
      setStatus("Title is required.");
      return;
    }
    setSaving(true);
    setStatus("Saving...");
    try {
      const uploadedCoverUrl = await uploadCoverIfNeeded();
      const now = new Date().toISOString();
      const payload = {
        title,
        coverImageUrl: uploadedCoverUrl ?? coverImageUrl,
        description,
        tagsJson: parseTags(tags),
        audience,
        category,
        pricingMode,
        bookPrice: parseMoney(bookPrice),
        bookPromoPrice: parseMoney(bookPromoPrice),
        currency: currency.trim() || "USD",
        creemProductId: creemProductId.trim() || null,
        paymentLink: paymentLink.trim() || null,
        isFeatured,
        autoHallPost: autoPostHall,
        status: "DRAFT",
        updatedAt: now
      };
      if (selectedNovel) {
        const { data: updated, error } = await supabase
          .from("Novel")
          .update(payload)
          .eq("id", selectedNovel.id)
          .select("id")
          .maybeSingle();
        if (error || !updated) {
          setStatus("Failed to save novel.");
          return;
        }
        await loadNovel(selectedNovel.id);
      } else {
        const draftId = ensureDraftId();
        const { data, error } = await supabase
          .from("Novel")
          .insert({ id: draftId, ...payload, createdAt: now })
          .select()
          .single();
        if (error || !data) {
          setStatus("Failed to save novel.");
          return;
        }
        setSelectedNovel(data as NovelItem);
        setPendingNovelId(null);
        router.replace(`/novels/${data.id}`);
      }
      setStep(2);
      setStatus(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save novel.";
      setStatus(message);
    } finally {
      setSaving(false);
    }
  };
  const savePricing = async (id: string) => {
    if (!supabase) return false;
    const payload = {
      pricingMode,
      bookPrice: parseMoney(bookPrice),
      bookPromoPrice: parseMoney(bookPromoPrice),
      currency: currency.trim() || "USD",
      creemProductId: creemProductId.trim() || null,
      paymentLink: paymentLink.trim() || null
    };
    const { data: updated, error } = await supabase
      .from("Novel")
      .update(payload)
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error || !updated) {
      setStatus("Failed to save pricing.");
      return false;
    }
    return true;
  };

  const uploadContentFile = async (id: string, file: File) => {
    if (!supabase) return false;
    setContentUploading(true);
    setStatus(null);
    setContentStatus(null);
    const isPdf = file.name.toLowerCase().endsWith(".pdf");
    const isDocx = file.name.toLowerCase().endsWith(".docx");
    const isDoc = file.name.toLowerCase().endsWith(".doc");
    const isTxt = file.name.toLowerCase().endsWith(".txt");
    const isMd = file.name.toLowerCase().endsWith(".md");

    try {
      const path = `novels/${id}/${Date.now()}-${toSafeFileName(file.name)}`;
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, { upsert: true });
      if (uploadError) {
        setStatus(`Failed to upload content: ${uploadError.message}`);
        return false;
      }
      const { data: urlData } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(path);

      if (isPdf || isDocx) {
        await supabase
          .from("Novel")
          .update({
            attachmentUrl: urlData.publicUrl,
            contentSourceType: isPdf ? "PDF" : "DOCX",
            parsedChaptersCount: 0,
            lastParsedAt: new Date().toISOString()
          })
          .eq("id", id);
        setContentStatus("Uploaded attachment. Parsing not available.");
        return true;
      }

      if (isDoc) {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) {
          setStatus("Please sign in again.");
          return false;
        }
        const res = await fetch("/api/novels/parse-doc", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ bucket: STORAGE_BUCKET, path })
        });
        if (!res.ok) {
          setStatus("Failed to parse DOC file.");
          return false;
        }
        const payload = (await res.json()) as { text?: string };
        const rawText = payload.text ?? "";
        if (process.env.NODE_ENV !== "production") {
          console.log("weird chars:", dumpWeirdChars(rawText));
        }
        const text = normalizeRawText(rawText);
        const chaptersParsed = splitChapters(text);
        const chaptersPayload = chaptersParsed.map((chapter, index) => ({
          id: crypto.randomUUID(),
          novelId: id,
          title: chapter.title,
          content: chapter.content,
          orderIndex: index + 1,
          isFree: index === 0,
          isPublished: true
        }));
        await supabase.from("NovelChapter").delete().eq("novelId", id);
        if (chaptersPayload.length > 0) {
          await supabase.from("NovelChapter").insert(chaptersPayload);
        }
        const wordCount = text.split(/\s+/).filter(Boolean).length;
        await supabase
          .from("Novel")
          .update({
            attachmentUrl: urlData.publicUrl,
            contentSourceType: "DOCX",
            parsedChaptersCount: chaptersPayload.length,
            chapterCount: chaptersPayload.length,
            wordCount,
            lastParsedAt: new Date().toISOString(),
            contentRawText: text
          })
          .eq("id", id);
        setContentStatus(
          `Parsed ${chaptersPayload.length} chapters - ${wordCount} words`
        );
        await loadChapters(id);
        setFullText(text);
        return true;
      }

      if (isTxt || isMd) {
        const rawText = await extractTextFromFile(file);
        if (process.env.NODE_ENV !== "production") {
          console.log("weird chars:", dumpWeirdChars(rawText));
        }
        const text = normalizeRawText(rawText);
        const chaptersParsed = splitChapters(text);
        const chaptersPayload = chaptersParsed.map((chapter, index) => ({
          id: crypto.randomUUID(),
          novelId: id,
          title: chapter.title,
          content: chapter.content,
          orderIndex: index + 1,
          isFree: index === 0,
          isPublished: true
        }));
        await supabase.from("NovelChapter").delete().eq("novelId", id);
        if (chaptersPayload.length > 0) {
          await supabase.from("NovelChapter").insert(chaptersPayload);
        }
        const wordCount = text.split(/\s+/).filter(Boolean).length;
        await supabase
          .from("Novel")
          .update({
            contentSourceType: isMd ? "MD" : "TXT",
            parsedChaptersCount: chaptersPayload.length,
            chapterCount: chaptersPayload.length,
            wordCount,
            lastParsedAt: new Date().toISOString(),
            contentRawText: text
          })
          .eq("id", id);
        setContentStatus(
          `Parsed ${chaptersPayload.length} chapters - ${wordCount} words`
        );
        await loadChapters(id);
        setFullText(text);
        return true;
      }
      setStatus("Unsupported file type.");
      return false;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Upload failed.";
      setStatus(message);
      return false;
    } finally {
      setContentUploading(false);
      setContentFile(null);
    }
  };

  const handleUploadContent = async () => {
    if (!selectedNovel || !contentFile) {
      setStatus("Select a file to upload.");
      return;
    }
    await savePricing(selectedNovel.id);
    const success = await uploadContentFile(selectedNovel.id, contentFile);
    if (success) {
      setStep(3);
    }
  };

  const handleSkipToPreview = async () => {
    if (!selectedNovel) return;
    setStatus("Loading preview...");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    let refreshedChapters = chapters;
    let refreshedNovel = selectedNovel;
    if (chapters.length === 0) {
      refreshedChapters = (await loadChapters(selectedNovel.id)) ?? [];
      refreshedNovel = (await loadNovel(selectedNovel.id)) ?? selectedNovel;
    }
    if (refreshedChapters.length === 0) {
      const hasPdfAttachment =
        refreshedNovel.contentSourceType === "PDF" &&
        Boolean(refreshedNovel.attachmentUrl);
      if (hasPdfAttachment) {
        setStatus("PDF uploaded. Preview available as attachment.");
        setStep(3);
        return;
      }
      if (refreshedNovel.parseStatus === "ERROR") {
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
    if (!supabase || !selectedNovel) return;
    setSaving(true);
    setStatus("Saving...");
    try {
      const res = await fetch("/api/admin/novels/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          novelId: selectedNovel.id,
          status: nextStatus
        })
      });
      if (!res.ok) {
        setStatus("Failed to update novel.");
        return;
      }
      await loadNovel(selectedNovel.id);
      setStatus(
        nextStatus === "PUBLISHED"
          ? "Published successfully."
          : "Saved as draft."
      );
      if (nextStatus === "PUBLISHED") {
        router.push("/novels");
      }
    } finally {
      setSaving(false);
    }
  };
  const handleChapterChange = (
    index: number,
    field: "title" | "content" | "isFree" | "price",
    value: string | boolean
  ) => {
    setChapters((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSaveChapter = async (chapter: ChapterItem) => {
    if (!supabase || !selectedNovel) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch("/api/admin/novels/chapters/update", {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        id: chapter.id,
        title: chapter.title,
        content: chapter.content,
        orderIndex: chapter.orderIndex,
        isFree: chapter.isFree,
        isPublished: chapter.isPublished,
        price:
          chapter.price === null || chapter.price === undefined
            ? null
            : typeof chapter.price === "string"
            ? parseMoney(chapter.price)
            : chapter.price
      })
    });
    if (!res.ok) {
      setStatus("Failed to save chapter.");
      return;
    }
  };

  const handleAddChapter = async () => {
    if (!supabase || !selectedNovel) return;
    const orderIndex =
      chapters.length === 0
        ? 1
        : Math.max(...chapters.map((chapter) => chapter.orderIndex)) + 1;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const res = await fetch("/api/admin/novels/chapters", {
        method: "POST",
        headers,
        body: JSON.stringify({
          novelId: selectedNovel.id,
          orderIndex,
          title: `Chapter ${orderIndex}`
        })
      });
      if (!res.ok) {
        throw new Error("Failed to add chapter.");
      }
      const payload = (await res.json()) as { data?: ChapterItem };
      if (!payload.data) {
        throw new Error("Failed to add chapter.");
      }
      setChapters((prev) => [...prev, payload.data as ChapterItem]);
    } catch {
      setStatus("Failed to add chapter.");
    }
  };

  const handleDeleteChapter = async (chapterId: string) => {
    if (!supabase || !selectedNovel) return;
    const { error } = await supabase
      .from("NovelChapter")
      .delete()
      .eq("id", chapterId);
    if (error) {
      setStatus("Failed to delete chapter.");
      return;
    }
    setChapters((prev) => prev.filter((chapter) => chapter.id !== chapterId));
  };

  const handleMoveChapter = async (index: number, direction: "up" | "down") => {
    if (!supabase || !selectedNovel) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= chapters.length) return;
    const current = chapters[index];
    const target = chapters[targetIndex];
    const nextChapters = [...chapters];
    nextChapters[index] = { ...current, orderIndex: target.orderIndex };
    nextChapters[targetIndex] = { ...target, orderIndex: current.orderIndex };
    setChapters(nextChapters);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch("/api/admin/novels/chapters/reorder", {
      method: "POST",
      headers,
      body: JSON.stringify({
        currentId: current.id,
        targetId: target.id,
        currentOrder: current.orderIndex,
        targetOrder: target.orderIndex
      })
    });
    if (!res.ok) {
      setStatus("Failed to reorder chapters.");
      return;
    }
  };

  const steps = [
    "Basics",
    "Upload content",
    "Preview",
    "Operational settings"
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            {selectedNovel ? "Edit novel" : "Create novel"}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Build the story experience step by step.
          </p>
        </div>
        <Link
          href="/novels"
          className="rounded-full border border-white/20 px-4 py-2 text-xs text-slate-200"
        >
          Back to library
        </Link>
      </div>

      {status && <p className="mt-4 text-sm text-rose-400">{status}</p>}

      <div className="mt-6 flex flex-wrap gap-2 text-[11px] text-slate-400">
        {steps.map((label, index) => (
          <span
            key={label}
            className={`rounded-full border px-3 py-1 ${
              step === index + 1
                ? "border-white/30 text-white"
                : "border-white/10 text-slate-500"
            }`}
          >
            {index + 1}. {label}
          </span>
        ))}
      </div>

      {step === 1 && (
        <section className="mt-8 space-y-6">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/60 p-6">
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
                      src={coverImageUrl}
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
            <div className="space-y-6">
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

              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
                <h2 className="text-sm font-semibold text-slate-200">Pricing</h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(["BOOK", "CHAPTER"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={`rounded-full border px-3 py-1 text-[11px] ${
                        pricingMode === mode
                          ? "border-white/50 text-white"
                          : "border-white/10 text-slate-400"
                      }`}
                      onClick={() => setPricingMode(mode)}
                    >
                      {mode === "BOOK" ? "Full book" : "By chapter"}
                    </button>
                  ))}
                </div>
                <div className="mt-4 max-w-[180px]">
                  <label className="text-[11px] text-slate-400">
                    Currency
                    <input
                      className="mt-2 w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-white"
                      value={currency}
                      onChange={(event) => setCurrency(event.target.value)}
                    />
                  </label>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="text-[11px] text-slate-400">
                    Creem Product ID
                    <input
                      className="mt-2 w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-white"
                      value={creemProductId}
                      onChange={(event) => setCreemProductId(event.target.value)}
                      placeholder="creem_product_id"
                    />
                  </label>
                  <label className="text-[11px] text-slate-400">
                    Payment Link
                    <input
                      className="mt-2 w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-white"
                      value={paymentLink}
                      onChange={(event) => setPaymentLink(event.target.value)}
                      placeholder="https://..."
                    />
                  </label>
                </div>
                {pricingMode === "BOOK" ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="text-[11px] text-slate-400">
                      Book price
                      <input
                        className="mt-2 w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-white"
                        value={bookPrice}
                        onChange={(event) => setBookPrice(event.target.value)}
                        placeholder="e.g. 9.99"
                      />
                    </label>
                    <label className="text-[11px] text-slate-400">
                      Promo price
                      <input
                        className="mt-2 w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-white"
                        value={bookPromoPrice}
                        onChange={(event) => setBookPromoPrice(event.target.value)}
                        placeholder="optional"
                      />
                    </label>
                  </div>
                ) : (
                  <p className="mt-3 text-[11px] text-slate-500">
                    Set per-chapter pricing in the preview step.
                  </p>
                )}
              </div>
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
              Supported: .doc, .docx, .txt, .md, .pdf.
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
                    <div
                      key={chapter.id}
                      className="rounded-xl border border-white/10 p-4"
                    >
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
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-slate-400">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={chapter.isFree}
                            onChange={(event) =>
                              handleChapterChange(
                                index,
                                "isFree",
                                event.target.checked
                              )
                            }
                            className="h-4 w-4 rounded bg-slate-900"
                          />
                          Free
                        </label>
                        {pricingMode === "CHAPTER" && (
                          <label className="flex items-center gap-2">
                            <span>Price ({currency})</span>
                            <input
                              className="w-24 rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1 text-[10px] text-slate-100"
                              value={chapter.price ?? ""}
                              onChange={(event) =>
                                handleChapterChange(
                                  index,
                                  "price",
                                  event.target.value
                                )
                              }
                              disabled={chapter.isFree}
                              placeholder="0.00"
                            />
                          </label>
                        )}
                      </div>
                      <textarea
                        className="mt-3 h-32 w-full rounded-lg border border-white/10 bg-slate-900/60 p-3 text-xs text-slate-100"
                        value={chapter.content}
                        onChange={(event) =>
                          handleChapterChange(
                            index,
                            "content",
                            event.target.value
                          )
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
