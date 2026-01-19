"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import PageShell from "../components/PageShell";
import ProfileCard from "../components/ProfileCard";
import { emitHostStatus } from "../lib/hostStatus";

export const dynamic = "force-dynamic";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

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

const QUICK_PROMPTS = [
  "Ask a question that makes you curious.",
  "Listening well still counts as participating.",
  "Say hello, then follow the energy."
];

const TRACE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const TRACE_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp"
]);

type RoomItem = {
  id: string;
  title: string;
  description: string | null;
  tagsJson: string[] | null;
  status: "SCHEDULED" | "LIVE" | "ENDED";
  startsAt: string | null;
  endsAt: string | null;
  isOfficial: boolean;
  allowSpectators: boolean;
  capacity: number | null;
  createdAt: string;
};

type TraceAuthor = {
  id: string;
  maskName: string | null;
  maskAvatarUrl: string | null;
  role: string;
  gender: string | null;
  dob: string | null;
  preference: {
    gender: string | null;
    lookingForGender: string | null;
    smPreference: string | null;
    tagsJson: string[] | null;
  } | null;
} | null;

type TraceItem = {
  id: string;
  content: string;
  createdAt: string;
  replyCount: number;
  likeCount?: number;
  likedByMe?: boolean;
  novelId?: string | null;
  author: TraceAuthor;
  imageUrl?: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
};

type TraceReply = {
  id: string;
  content: string;
  createdAt: string;
  author: TraceAuthor;
};

type HallResponse = {
  rooms: {
    live: RoomItem[];
    scheduled: RoomItem[];
  };
  traces: TraceItem[];
  novels?: NovelItem[];
};

type NovelItem = {
  id: string;
  title: string;
  coverImageUrl: string | null;
  description: string | null;
  tagsJson?: string[] | null;
  favoriteCount?: number;
  dislikeCount?: number;
  myReaction?: "LIKE" | "DISLIKE" | null;
};

type NovelPreview = {
  id: string;
  title: string;
  coverImageUrl: string | null;
  description: string | null;
  tagsJson?: string[] | null;
  favoriteCount?: number;
  dislikeCount?: number;
  myReaction?: "LIKE" | "DISLIKE" | null;
  chapters: Array<{
    id: string;
    title: string;
    content: string;
    orderIndex: number;
    isFree: boolean;
    isPublished: boolean;
    isLocked?: boolean;
  }>;
};

type TraceDetailResponse = {
  trace: TraceItem;
  replies: TraceReply[];
  nextCursor: string | null;
};

type PublicProfile = {
  id: string;
  maskName: string | null;
  maskAvatarUrl: string | null;
  bio: string | null;
  preference?: {
    vibeTags?: string[] | null;
    interests?: string[] | null;
    allowStrangerPrivate?: boolean | null;
  } | null;
};

export default function HallPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [hall, setHall] = useState<HallResponse | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [traceInput, setTraceInput] = useState("");
  const [postingTrace, setPostingTrace] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadedImageData, setUploadedImageData] = useState<{
    imageUrl: string;
    width: number | null;
    height: number | null;
  } | null>(null);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [traceDetail, setTraceDetail] = useState<TraceDetailResponse | null>(
    null
  );
  const [novelPreview, setNovelPreview] = useState<NovelPreview | null>(null);
  const [novelLoading, setNovelLoading] = useState(false);
  const [replyInput, setReplyInput] = useState("");
  const [postingReply, setPostingReply] = useState(false);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [profileCard, setProfileCard] = useState<PublicProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const authHeader = useMemo(() => {
    if (!token) {
      return null;
    }
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  useEffect(() => {
    setToken(localStorage.getItem("accessToken"));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const seen = localStorage.getItem("hallWelcomeSeen");
    if (!seen) {
      setShowWelcome(true);
    }
  }, []);

  useEffect(() => {
    if (!authHeader) {
      return;
    }
    fetch(`${API_BASE}/me`, { headers: { ...authHeader } })
      .then(async (res) => {
        if (!res.ok) {
          return null;
        }
        return res.json();
      })
      .then((data: { id: string } | null) => {
        setCurrentUserId(data?.id ?? null);
      })
      .catch(() => setCurrentUserId(null));
  }, [authHeader]);

  const fetchHall = async () => {
    const res = await fetch(`${API_BASE}/hall`, {
      headers: authHeader ? { ...authHeader } : undefined
    });
    if (!res.ok) {
      setStatus("Failed to load the Hall.");
      return;
    }
    const data = (await res.json()) as HallResponse;
    setHall(data);
  };

  const startConversation = async (userId: string) => {
    if (!authHeader) {
      setStatus("Please sign in to start a private conversation.");
      return;
    }
    if (currentUserId && userId === currentUserId) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/private/conversations/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader
        },
        body: JSON.stringify({ userId })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const errorMessage = body?.message ?? `HTTP ${res.status}`;
        if (errorMessage === "PRIVATE_NOT_ALLOWED") {
          setStatus("This user only accepts private chats after they reply.");
          return;
        }
        throw new Error(errorMessage);
      }
      const data = (await res.json()) as { conversationId: string };
      router.push(`/private?conversationId=${data.conversationId}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to start conversation.";
      setStatus(message);
    }
  };

  const openProfileCard = async (userId: string) => {
    if (!authHeader) {
      setStatus("Please sign in to view profiles.");
      return;
    }
    setProfileLoading(true);
    try {
      const isSelf = currentUserId && userId === currentUserId;
      const res = await fetch(isSelf ? `${API_BASE}/me` : `${API_BASE}/users/${userId}`, {
        headers: { ...authHeader }
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as PublicProfile;
      setProfileCard({
        id: data.id,
        maskName: data.maskName ?? (isSelf ? "You" : null),
        maskAvatarUrl: data.maskAvatarUrl ?? null,
        bio: data.bio ?? null,
        preference: data.preference ?? null
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load profile.";
      setStatus(message);
    } finally {
      setProfileLoading(false);
    }
  };

  const blockUser = async (userId: string) => {
    if (!authHeader) {
      setStatus("Please sign in to manage blocks.");
      return;
    }
    if (!confirm("Block this user? You won't be able to message each other.")) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/users/${userId}/block`, {
        method: "POST",
        headers: { ...authHeader }
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? `HTTP ${res.status}`);
      }
      setStatus("User blocked.");
      setProfileCard(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to block user.";
      setStatus(message);
    }
  };

  const toggleLike = async (traceId: string) => {
    if (!authHeader) {
      setStatus("Please sign in to like a post.");
      return;
    }
    const trace = hall?.traces.find((item) => item.id === traceId);
    const liked = Boolean(trace?.likedByMe);
    const nextLiked = !liked;
    setHall((prev) =>
      prev
        ? {
            ...prev,
            traces: prev.traces.map((item) =>
              item.id === traceId
                ? {
                    ...item,
                    likedByMe: nextLiked,
                    likeCount: Math.max(
                      0,
                      (item.likeCount ?? 0) + (nextLiked ? 1 : -1)
                    )
                  }
                : item
            )
          }
        : prev
    );

    try {
      const res = await fetch(`${API_BASE}/traces/${traceId}/like`, {
        method: nextLiked ? "POST" : "DELETE",
        headers: { ...authHeader }
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        traceId: string;
        likeCount: number;
        likedByMe: boolean;
      };
      setHall((prev) =>
        prev
          ? {
              ...prev,
              traces: prev.traces.map((item) =>
                item.id === data.traceId
                  ? {
                      ...item,
                      likedByMe: data.likedByMe,
                      likeCount: data.likeCount
                    }
                  : item
              )
            }
          : prev
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update like.";
      setStatus(message);
      setHall((prev) =>
        prev
          ? {
              ...prev,
              traces: prev.traces.map((item) =>
                item.id === traceId
                  ? {
                      ...item,
                      likedByMe: liked,
                      likeCount: item.likeCount ?? 0
                    }
                  : item
              )
            }
          : prev
      );
    }
  };

  const reportUser = async (userId: string) => {
    if (!authHeader) {
      setStatus("Please sign in to report.");
      return;
    }
    const reasonRaw = window.prompt(
      "Report reason (SPAM / ABUSE / HARASSMENT / OTHER):",
      "OTHER"
    );
    if (!reasonRaw) {
      return;
    }
    const normalized = reasonRaw.trim().toUpperCase();
    const reasonType = ["SPAM", "ABUSE", "HARASSMENT", "OTHER"].includes(normalized)
      ? normalized
      : "OTHER";
    const detail = window.prompt("Optional details:", "") ?? "";
    try {
      const res = await fetch(`${API_BASE}/users/${userId}/report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader
        },
        body: JSON.stringify({
          reasonType,
          detail: detail.trim() || undefined
        })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? `HTTP ${res.status}`);
      }
      setStatus("Report submitted.");
      setProfileCard(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to report user.";
      setStatus(message);
    }
  };

  const openNovelPreview = async (novelId: string) => {
    setNovelLoading(true);
    try {
      const res = await fetch(`${API_BASE}/novels/${novelId}/preview`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as NovelPreview;
      setNovelPreview(data);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load novel preview.";
      setStatus(message);
    } finally {
      setNovelLoading(false);
    }
  };

  const toggleNovelReaction = async (
    novelId: string,
    type: "LIKE" | "DISLIKE"
  ) => {
    if (!authHeader) {
      setStatus("Please sign in to react to a novel.");
      return;
    }
    const endpoint = type === "LIKE" ? "like" : "dislike";
    try {
      const res = await fetch(`${API_BASE}/novels/${novelId}/${endpoint}`, {
        method: "POST",
        headers: { ...authHeader }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message ?? `HTTP ${res.status}`);
      }
      setHall((prev) => {
        if (!prev?.novels) return prev;
        return {
          ...prev,
          novels: prev.novels.map((item) =>
            item.id === novelId
              ? {
                  ...item,
                  favoriteCount: data.favoriteCount,
                  dislikeCount: data.dislikeCount,
                  myReaction: data.myReaction
                }
              : item
          )
        };
      });
      setNovelPreview((prev) =>
        prev?.id === novelId
          ? {
              ...prev,
              favoriteCount: data.favoriteCount,
              dislikeCount: data.dislikeCount,
              myReaction: data.myReaction
            }
          : prev
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to react to novel.";
      setStatus(message);
    }
  };

  const fetchTraceDetail = async (traceId: string) => {
    const res = await fetch(`${API_BASE}/traces/${traceId}`);
    if (!res.ok) {
      setStatus("Failed to load trace details.");
      return;
    }
    const data = (await res.json()) as TraceDetailResponse;
    setTraceDetail(data);
  };

  useEffect(() => {
    fetchHall().catch(() => setStatus("Failed to load the Hall."));
  }, []);

  useEffect(() => {
    emitHostStatus({
      page: "hall",
      cold: !(hall?.traces.length ?? 0)
    });
  }, [hall]);

  useEffect(() => {
    if (!selectedTraceId) {
      setTraceDetail(null);
      return;
    }
    fetchTraceDetail(selectedTraceId).catch(() => {
      setStatus("Failed to load trace details.");
    });
  }, [selectedTraceId]);

  const uploadTraceImage = async (file: File) => {
    if (!authHeader) {
      throw new Error("Please sign in to upload an image.");
    }
    const formData = new FormData();
    formData.append("file", file, file.name);
    const res = await fetch(`${API_BASE}/uploads/image`, {
      method: "POST",
      headers: {
        ...authHeader
      },
      body: formData
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.message ?? "Image upload failed.");
    }
    const data = await res.json();
    if (!data?.imageUrl) {
      throw new Error("Upload failed: no imageUrl returned");
    }
    // Ensure imageUrl is a valid http/https URL
    if (!data.imageUrl.startsWith("http://") && !data.imageUrl.startsWith("https://")) {
      throw new Error(`Invalid imageUrl format: ${data.imageUrl}`);
    }
    return {
      imageUrl: data.imageUrl,
      width: data?.width ?? null,
      height: data?.height ?? null
    };
  };

  const clearSelectedImage = () => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setSelectedImageFile(null);
    setImagePreview(null);
    setUploadedImageData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setImageError(null);
  };

  const handlePostTrace = async () => {
    if (!authHeader) {
      setStatus("Please sign in to post a trace.");
      return;
    }
    if (!traceInput.trim()) {
      setStatus("Please enter trace content.");
      return;
    }
    if (selectedImageFile && !uploadedImageData) {
      setImageError("Please wait for image upload to complete.");
      return;
    }
    setPostingTrace(true);
    setStatus(null);
    setImageError(null);
    try {
      const tracePayload: {
        content: string;
        imageUrl?: string;
        imageWidth?: number;
        imageHeight?: number;
      } = {
        content: traceInput.trim()
      };
      if (uploadedImageData?.imageUrl) {
        // Validate imageUrl is a proper URL before sending
        if (!uploadedImageData.imageUrl.startsWith("http://") && !uploadedImageData.imageUrl.startsWith("https://")) {
          throw new Error(`Invalid imageUrl: ${uploadedImageData.imageUrl}`);
        }
        tracePayload.imageUrl = uploadedImageData.imageUrl;
        if (uploadedImageData.width !== null && uploadedImageData.width > 0) {
          tracePayload.imageWidth = uploadedImageData.width;
        }
        if (uploadedImageData.height !== null && uploadedImageData.height > 0) {
          tracePayload.imageHeight = uploadedImageData.height;
        }
      }
      const res = await fetch(`${API_BASE}/traces`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader
        },
        body: JSON.stringify(tracePayload)
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const errorMessage = body?.message ?? body?.error ?? Array.isArray(body?.message) ? body.message.join(", ") : `HTTP ${res.status}`;
        console.error("Trace creation failed:", { status: res.status, body, tracePayload });
        throw new Error(errorMessage);
      }
      setTraceInput("");
      clearSelectedImage();
      setUploadedImageData(null);
      await fetchHall();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to post.";
      setStatus(message);
    } finally {
      setPostingTrace(false);
    }
  };

  const handleImageSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (!TRACE_IMAGE_MIME_TYPES.has(file.type)) {
      setImageError("Allowed formats: jpg, png, webp.");
      event.target.value = "";
      return;
    }
    if (file.size > TRACE_IMAGE_MAX_BYTES) {
      setImageError("Image must be smaller than 5 MB.");
      event.target.value = "";
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setSelectedImageFile(file);
    setImagePreview(previewUrl);
    setImageError(null);
    setUploadedImageData(null);
    
    // Auto-upload image when selected
    if (authHeader) {
      try {
        setUploadingImage(true);
        const imageData = await uploadTraceImage(file);
        setUploadedImageData(imageData);
        // Use server URL for preview after upload - revoke blob URL first
        URL.revokeObjectURL(previewUrl);
        setImagePreview(imageData.imageUrl);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Upload failed.";
        setImageError(message);
        // On upload failure, keep the blob preview but clear uploaded data
        setUploadedImageData(null);
      } finally {
        setUploadingImage(false);
      }
    }
  };

  const formatBytes = (size: number) => {
    if (size < 1024) {
      return `${size} B`;
    }
    const kb = size / 1024;
    if (kb < 1024) {
      return `${kb.toFixed(1)} KB`;
    }
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const handlePostReply = async () => {
    if (!authHeader || !selectedTraceId) {
      setStatus("Please sign in to reply.");
      return;
    }
    if (!replyInput.trim()) {
      setStatus("Please enter a reply.");
      return;
    }
    setPostingReply(true);
    setStatus(null);
    try {
      const res = await fetch(`${API_BASE}/traces/${selectedTraceId}/replies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader
        },
        body: JSON.stringify({ content: replyInput })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? `HTTP ${res.status}`);
      }
      setReplyInput("");
      await fetchTraceDetail(selectedTraceId);
      await fetchHall();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to reply.";
      setStatus(message);
    } finally {
      setPostingReply(false);
    }
  };

  const loadMoreReplies = async () => {
    if (!traceDetail?.nextCursor || !selectedTraceId) {
      return;
    }
    setLoadingReplies(true);
    try {
      const params = new URLSearchParams();
      params.set("cursor", traceDetail.nextCursor);
      const res = await fetch(`${API_BASE}/traces/${selectedTraceId}?${params}`);
      if (!res.ok) {
        throw new Error("Failed to load more replies.");
      }
      const data = (await res.json()) as TraceDetailResponse;
      setTraceDetail({
        trace: data.trace,
        replies: [...(traceDetail?.replies ?? []), ...data.replies],
        nextCursor: data.nextCursor
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load more.";
      setStatus(message);
    } finally {
      setLoadingReplies(false);
    }
  };

  const renderTraceAuthor = (author: TraceAuthor) => {
    if (!author) {
      return "Anonymous";
    }
    if (author.role === "OFFICIAL") {
      return author.maskName ?? "Official";
    }
    return author.maskName ?? "Anonymous";
  };

  const normalizeTraceContent = (value: string) => {
    if (!value) return value;
    const sanitized = value.replace(/点击看全文/g, "Read full story");
    const lines = sanitized.split("\n").map((line) => line.trim());
    const filtered = lines.filter((line) => line.length > 0);
    if (filtered.length === 0) return sanitized;
    const last = filtered[filtered.length - 1];
    if (last.toLowerCase() === "read full story") {
      filtered.pop();
    }
    return filtered.join("\n");
  };

  const renderAuthorMeta = (author: TraceAuthor) => {
    if (!author) {
      return null;
    }
    const dob = author.dob ? new Date(author.dob) : null;
    const age = dob ? Math.max(0, new Date().getFullYear() - dob.getFullYear()) : null;
    const tags = Array.isArray(author.preference?.tagsJson)
      ? author.preference.tagsJson ?? []
      : [];
    const displayGender = author.preference?.gender ?? author.gender;
    const lines = [
      displayGender ? `Gender: ${displayGender}` : null,
      age ? `Age: ${age}` : null,
      author.preference?.lookingForGender
        ? `Interest: ${author.preference.lookingForGender}`
        : null,
      author.preference?.smPreference
        ? `Preference: ${author.preference.smPreference}`
        : null
    ].filter((item): item is string => Boolean(item));
    return (
      <div className="w-64 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600 shadow-lg">
        <p className="text-sm font-semibold text-slate-900">
          {renderTraceAuthor(author)}
        </p>
        {lines.length > 0 && (
          <div className="mt-2 space-y-1">
            {lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        )}
        <p className="mt-3 text-[10px] uppercase tracking-wide text-slate-500">
          Known for:
        </p>
        {tags.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-500"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-slate-500">бк</p>
        )}
        <div className="mt-3 space-y-1 text-slate-500">
          <p>Curious what they sound like?</p>
          <p>You can say hello бк or just remember the face.</p>
          <p>Private conversations are optional. You can also meet people in rooms.</p>
        </div>
      </div>
    );
  };

  const formatTraceTime = (value: string) =>
    new Date(value).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });

  const stageContent = (
    <>
      <div className="space-y-2 text-sm text-slate-200">
        <p>People pass through.</p>
        <p>Some stay.</p>
        <p>Something might happen.</p>
      </div>
      {showWelcome && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <p>Welcome to HookedUp?</p>
          <p>This is the main hall of the castle.</p>
          <p>Look around. See what’s happening.</p>
          <p>Join when something catches your interest.</p>
          <button
            type="button"
            className="mt-3 rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700"
            onClick={() => {
              localStorage.setItem("hallWelcomeSeen", "true");
              setShowWelcome(false);
            }}
          >
            Close
          </button>
        </div>
      )}
      {status && <p className="mt-3 text-sm text-rose-600">{status}</p>}

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Hall Traces</h2>
        </div>
        <div className="mt-4 columns-1 gap-4 sm:columns-2 lg:columns-3">
        {hall?.traces.map((trace) => {
          const isSelected = selectedTraceId === trace.id;
          const isImageTrace = Boolean(trace.imageUrl);
          const isNovelTrace = Boolean(trace.novelId);
          const cardClasses = [
            "block w-full break-inside-avoid mb-4 rounded-2xl border p-4 text-left transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/60",
            "bg-white/90 text-slate-900 border-slate-200/80 shadow-sm hover:border-slate-400",
            isNovelTrace
              ? "bg-gradient-to-br from-white via-white to-amber-50/80 border-amber-200/60 shadow-[0_16px_40px_rgba(251,191,36,0.15)]"
              : "",
            isSelected
              ? "ring-1 ring-slate-500/60 shadow-[0_25px_60px_rgba(15,23,42,0.7)]"
              : ""
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button
              key={trace.id}
              type="button"
              className={cardClasses}
              onClick={() => setSelectedTraceId(trace.id)}
            >
              <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.2em] text-slate-600">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 overflow-hidden"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (trace.author?.id) {
                        openProfileCard(trace.author.id);
                      }
                    }}
                    aria-label="Open profile"
                  >
                    {trace.author?.maskAvatarUrl ? (
                      <img
                        src={trace.author.maskAvatarUrl}
                        alt={renderTraceAuthor(trace.author)}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <span className="h-8 w-8 rounded-full bg-slate-200" />
                    )}
                  </button>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-700">
                    {renderTraceAuthor(trace.author)}
                  </span>
                </div>
                <span className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
                  {formatTraceTime(trace.createdAt)}
                </span>
              </div>
              {isImageTrace && trace.imageUrl ? (
                <>
                  <div className="mt-4 overflow-hidden rounded-xl bg-slate-100">
                    <img
                      src={resolveMediaUrl(trace.imageUrl) ?? ""}
                      alt={trace.content.slice(0, 40)}
                      className="aspect-[4/5] w-full object-cover"
                    />
                  </div>
                  <p
                    className="mt-3 text-sm leading-relaxed text-slate-800"
                    style={{
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden"
                    }}
                  >
                    {normalizeTraceContent(trace.content)}
                  </p>
                </>
              ) : (
                <p
                  className="mt-4 text-base leading-relaxed text-slate-800"
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 6,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden"
                  }}
                >
                  {normalizeTraceContent(trace.content)}
                </p>
              )}
              <div className="mt-4 flex items-center justify-between">
                {/* Replies icon - Chat bubble with notification badge */}
                <div className="flex items-center gap-2 group relative">
                  <div className="relative">
                    <svg
                      className="w-6 h-6 transition-all duration-200 group-hover:scale-110"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      {/* Yellow rounded chat bubble */}
                      <path
                        d="M20 2H4C2.9 2 2 2.9 2 4V12C2 13.1 2.9 14 4 14H6L8 18L12 14H20C21.1 14 22 13.1 22 12V4C22 2.9 21.1 2 20 2Z"
                        fill="#FCD34D"
                        className="group-hover:fill-yellow-400 transition-colors"
                      />
                      {/* Chat bubble tail */}
                      <path
                        d="M6 14L4 18L6 16H8V14H6Z"
                        fill="#FCD34D"
                        className="group-hover:fill-yellow-400 transition-colors"
                      />
                      {/* Three dots (typing indicator) */}
                      <circle cx="9" cy="7" r="1.2" fill="white" opacity="0.95" />
                      <circle cx="12" cy="7" r="1.2" fill="white" opacity="0.95" />
                      <circle cx="15" cy="7" r="1.2" fill="white" opacity="0.95" />
                    </svg>
                    {/* Red notification badge with number - animated */}
                    {trace.replyCount > 0 && (
                      <div className="absolute -top-1 -right-1">
                        <svg
                          className="w-5 h-5 animate-pulse"
                          viewBox="0 0 20 20"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <circle cx="10" cy="10" r="9" fill="#EF4444" />
                          <text
                            x="10"
                            y="13.5"
                            textAnchor="middle"
                            fill="white"
                            fontSize="10"
                            fontWeight="bold"
                            fontFamily="system-ui, -apple-system, sans-serif"
                          >
                            {trace.replyCount > 9 ? "9+" : trace.replyCount}
                          </text>
                        </svg>
                      </div>
                    )}
                  </div>
                  {trace.replyCount > 0 && (
                    <span className="text-xs text-slate-500 group-hover:text-slate-700 transition-colors font-medium">
                      {trace.replyCount}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 group relative">
                  <button
                    type="button"
                    className="group relative flex h-7 w-7 items-center justify-center rounded-full border border-transparent transition hover:scale-110"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleLike(trace.id);
                    }}
                    aria-label="Toggle like"
                  >
                    <svg
                      className="h-5 w-5 transition-colors"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M12 20.5c-5.05-3.62-8.5-6.7-8.5-10.6 0-2.3 1.74-4.1 4.06-4.1 1.62 0 3.18.9 4.44 2.38 1.26-1.48 2.82-2.38 4.44-2.38 2.32 0 4.06 1.8 4.06 4.1 0 3.9-3.45 6.98-8.5 10.6z"
                        fill={trace.likedByMe ? "#EF4444" : "none"}
                        stroke={trace.likedByMe ? "#EF4444" : "#94a3b8"}
                        strokeWidth="1.6"
                      />
                    </svg>
                    {(trace.likeCount ?? 0) > 0 && (
                      <div className="absolute -top-1 -right-1">
                        <svg
                          className="w-5 h-5"
                          viewBox="0 0 20 20"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <circle cx="10" cy="10" r="9" fill="#EF4444" />
                          <text
                            x="10"
                            y="13.5"
                            textAnchor="middle"
                            fill="white"
                            fontSize="10"
                            fontWeight="bold"
                            fontFamily="system-ui, -apple-system, sans-serif"
                          >
                            {(trace.likeCount ?? 0) > 9 ? "9+" : trace.likeCount}
                          </text>
                        </svg>
                      </div>
                    )}
                  </button>
                  {(trace.likeCount ?? 0) > 0 && (
                    <span className="text-xs text-slate-500 group-hover:text-slate-700 transition-colors font-medium">
                      {trace.likeCount}
                    </span>
                  )}
                </div>
              </div>
              {trace.novelId && (
                <button
                  type="button"
                  className="mt-3 w-full rounded-full border border-slate-300 px-3 py-2 text-[10px] font-semibold text-slate-700"
                  onClick={(event) => {
                    event.stopPropagation();
                    router.push(`/novels/${trace.novelId}`);
                  }}
                >
                  Read full story
                </button>
              )}
              {currentUserId &&
                trace.author?.id &&
                trace.author.role !== "OFFICIAL" &&
                trace.author.id !== currentUserId && (
                  <button
                    type="button"
                    className="mt-3 w-full rounded-full border border-slate-300 px-3 py-2 text-[10px] font-semibold text-slate-700"
                    onClick={(event) => {
                      event.stopPropagation();
                      startConversation(trace.author!.id);
                    }}
                  >
                    Start private
                  </button>
                )}
            </button>
          );
        })}
      </div>
        {hall && hall.traces.length === 0 && (
          <p className="mt-4 text-sm text-slate-500">No traces in the Hall yet.</p>
        )}
      </section>

      {traceDetail && (
        <div className="fixed inset-0 z-40 flex items-stretch" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm animate-trace-backdrop"
            onClick={() => setSelectedTraceId(null)}
          />
          <div className="relative ml-auto flex h-full w-full max-w-[520px] flex-col overflow-hidden bg-white text-slate-900 shadow-[0_30px_60px_rgba(2,6,23,0.4)] animate-trace-drawer">
            <header className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Trace details</h3>
                <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                  <button
                    type="button"
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 overflow-hidden"
                    onClick={() => {
                      if (traceDetail.trace.author?.id) {
                        openProfileCard(traceDetail.trace.author.id);
                      }
                    }}
                    aria-label="Open profile"
                  >
                    {traceDetail.trace.author?.maskAvatarUrl ? (
                      <img
                        src={traceDetail.trace.author.maskAvatarUrl}
                        alt={renderTraceAuthor(traceDetail.trace.author)}
                        className="h-6 w-6 rounded-full object-cover"
                      />
                    ) : (
                      <span className="h-6 w-6 rounded-full bg-slate-200" />
                    )}
                  </button>
                  <span>
                    {renderTraceAuthor(traceDetail.trace.author)} ·{" "}
                    {new Date(traceDetail.trace.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="text-xs text-slate-500"
                onClick={() => setSelectedTraceId(null)}
              >
                Close
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {traceDetail.trace.imageUrl && (
                <div className="overflow-hidden rounded-2xl bg-slate-100">
                  <img
                    src={resolveMediaUrl(traceDetail.trace.imageUrl) ?? ""}
                    alt={traceDetail.trace.content.slice(0, 40)}
                    className="w-full object-cover"
                  />
                </div>
              )}
              <p className="mt-4 text-sm text-slate-800 whitespace-pre-wrap">
                {normalizeTraceContent(traceDetail.trace.content)}
              </p>
              {traceDetail.trace.novelId && (
                <button
                  type="button"
                  className="mt-4 rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
                  onClick={() => router.push(`/novels/${traceDetail.trace.novelId}`)}
                >
                  Read full story
                </button>
              )}

              <div className="mt-6 space-y-3">
                {traceDetail.replies.map((reply) => (
                  <div
                    key={reply.id}
                    className="rounded-xl border border-slate-100 bg-slate-50 p-3"
                  >
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{renderTraceAuthor(reply.author)}</span>
                      <span>{new Date(reply.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">{reply.content}</p>
                  </div>
                ))}
                {traceDetail.replies.length === 0 && (
                  <p className="text-sm text-slate-500">No replies yet.</p>
                )}
              </div>

              {traceDetail.nextCursor && (
                <button
                  type="button"
                  className="mt-4 rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
                  onClick={loadMoreReplies}
                  disabled={loadingReplies}
                >
                  {loadingReplies ? "Loading..." : "Load more replies"}
                </button>
              )}
            </div>

            <div className="border-t border-slate-200 px-6 py-4">
              <label className="text-xs font-semibold text-slate-600">Reply</label>
              <textarea
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
                rows={2}
                maxLength={200}
                placeholder="Write a reply (max 200)."
                value={replyInput}
                onChange={(event) => setReplyInput(event.target.value)}
              />
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span>{replyInput.length}/200</span>
                <button
                  type="button"
                  className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
                  onClick={handlePostReply}
                  disabled={postingReply}
                >
                  {postingReply ? "Replying..." : "Reply"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {novelPreview && (
        <div className="fixed inset-0 z-40 flex items-stretch" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setNovelPreview(null)}
          />
          <div className="relative ml-auto flex h-full w-full max-w-[560px] flex-col overflow-hidden bg-slate-950 text-slate-100 shadow-[0_30px_60px_rgba(2,6,23,0.6)]">
            <header className="flex items-start justify-between border-b border-white/10 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold">{novelPreview.title}</h3>
                {novelPreview.description && (
                  <p className="mt-1 text-xs text-slate-400">
                    {novelPreview.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="text-xs text-slate-400 hover:text-white"
                onClick={() => setNovelPreview(null)}
              >
                Close
              </button>
            </header>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div className="flex items-center gap-3 text-xs text-slate-300">
                <button
                  type="button"
                  className={`rounded-full border px-3 py-1 transition ${
                    novelPreview.myReaction === "LIKE"
                      ? "border-emerald-400/60 text-emerald-200"
                      : "border-white/10 text-slate-300 hover:text-white"
                  }`}
                  onClick={() => toggleNovelReaction(novelPreview.id, "LIKE")}
                >
                  Like {novelPreview.favoriteCount ?? 0}
                </button>
                <button
                  type="button"
                  className={`rounded-full border px-3 py-1 transition ${
                    novelPreview.myReaction === "DISLIKE"
                      ? "border-rose-400/60 text-rose-200"
                      : "border-white/10 text-slate-300 hover:text-white"
                  }`}
                  onClick={() => toggleNovelReaction(novelPreview.id, "DISLIKE")}
                >
                  Dislike {novelPreview.dislikeCount ?? 0}
                </button>
                <button
                  type="button"
                  className="rounded-full border border-white/10 px-3 py-1 text-slate-300 hover:text-white"
                  onClick={() => router.push(`/novels/${novelPreview.id}`)}
                >
                  Read full story
                </button>
              </div>
              {novelPreview.coverImageUrl && (
                <img
                  src={resolveMediaUrl(novelPreview.coverImageUrl) ?? ""}
                  alt={novelPreview.title}
                  className="w-full rounded-2xl object-cover"
                />
              )}
              {novelPreview.chapters.map((chapter) => (
                <section
                  key={chapter.id}
                  className="rounded-2xl border border-white/10 bg-slate-900/60 p-4"
                >
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>
                      Chapter {chapter.orderIndex}: {chapter.title}
                    </span>
                    <span>{chapter.isFree ? "Free" : "Locked"}</span>
                  </div>
                  <p className="mt-3 text-sm text-slate-100 whitespace-pre-wrap">
                    {chapter.content}
                  </p>
                  {chapter.isLocked && (
                    <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-100">
                      Continue reading by purchasing or inviting a friend.
                    </div>
                  )}
                </section>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );

  const panelContent = (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
          Do something.
        </h3>
        <div className="space-y-4">
          <div className="space-y-3">
            <label className="text-xs font-semibold text-slate-300">Add a trace</label>
            <textarea
              className="mt-2 w-full rounded-xl border border-slate-700/60 bg-slate-950/50 px-3 py-2 text-sm text-white placeholder:text-slate-500"
              rows={3}
              maxLength={1000}
              placeholder="Add a thought to the hall..."
              value={traceInput}
              onChange={(event) => setTraceInput(event.target.value)}
            />
            <div className="space-y-2">
              <button
                type="button"
                className="flex flex-col items-center gap-1 rounded-2xl border border-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:border-slate-200"
                onClick={() => fileInputRef.current?.click()}
              >
                {selectedImageFile ? "Replace image" : "Attach image"}
                <span className="text-[10px] text-slate-400">jpg/png/webp · max 5MB</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleImageSelect}
              />
              {selectedImageFile && imagePreview && (
                <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3">
                  <div className="overflow-hidden rounded-2xl bg-slate-950 relative">
                    <img
                      src={imagePreview?.startsWith("http") ? imagePreview : `${API_BASE}${imagePreview}`}
                      alt={selectedImageFile.name}
                      className="h-32 w-full object-cover"
                    />
                    {uploadingImage && (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80">
                        <p className="text-xs text-white">Uploading...</p>
                      </div>
                    )}
                    {uploadedImageData && !uploadingImage && (
                      <div className="absolute top-2 right-2 rounded-full bg-green-500/90 px-2 py-1">
                        <p className="text-[10px] text-white font-semibold">✓ Uploaded</p>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-white">
                        {selectedImageFile.name}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {formatBytes(selectedImageFile.size)}
                        {uploadedImageData && uploadedImageData.width && uploadedImageData.height && (
                          <span> · {uploadedImageData.width}×{uploadedImageData.height}</span>
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="rounded-full border border-rose-400 px-2 py-1 text-[10px] text-rose-400"
                      onClick={clearSelectedImage}
                      disabled={uploadingImage}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
              {imageError && <p className="text-xs text-rose-400">{imageError}</p>}
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{traceInput.length}/1000</span>
              <button
                type="button"
                className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                onClick={handlePostTrace}
                disabled={postingTrace || uploadingImage}
              >
                {postingTrace || uploadingImage ? "Posting..." : "Post"}
              </button>
            </div>
          </div>
          <div className="space-y-2 border-t border-white/10 pt-4 text-white">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
              Start a Room
            </h4>
            <button
              type="button"
              className="w-full rounded-full border border-slate-700/80 px-4 py-2 text-xs font-semibold text-white transition hover:border-slate-500"
              onClick={() => router.push("/rooms")}
            >
              Start something
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-3 border-t border-white/10 pt-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
          Quick Prompts
        </h4>
        <ul className="space-y-2 text-sm text-slate-200">
          {QUICK_PROMPTS.map((prompt) => (
            <li key={prompt} className="text-xs leading-relaxed">
              {prompt}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  return (
    <>
      <PageShell title="The Grand Hall" stage={stageContent} panel={panelContent} />
      {profileCard && (
        <ProfileCard
          profile={profileCard}
          onClose={() => setProfileCard(null)}
          onStartPrivate={async (userId) => {
            await startConversation(userId);
            setProfileCard(null);
          }}
          onBlock={blockUser}
          onReport={reportUser}
        />
      )}
      {profileLoading && (
        <div className="fixed inset-0 z-40 flex items-center justify-center text-xs text-slate-200">
          Loading profile...
        </div>
      )}
    </>
  );
}
