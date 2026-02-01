"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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
  viewCount?: number | null;
  favoriteCount?: number;
  dislikeCount?: number;
  myReaction?: "LIKE" | "DISLIKE" | null;
  room?: {
    id: string;
    title: string;
    _count: { memberships: number };
  } | null;
};

type HallFeedItem =
  | { kind: "novel"; novel: NovelItem }
  | { kind: "trace"; trace: TraceItem };

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
  city?: string | null;
  country?: string | null;
  preference?: {
    vibeTags?: string[] | null;
    interests?: string[] | null;
    allowStrangerPrivate?: boolean | null;
    smPreference?: string | null;
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
  const [replyInput, setReplyInput] = useState("");
  const [postingReply, setPostingReply] = useState(false);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "story" | "post">("all");
  const [columnCount, setColumnCount] = useState(1);
  const [profileCard, setProfileCard] = useState<PublicProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [meProfile, setMeProfile] = useState<PublicProfile | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const redirectToLogin = () => {
    if (typeof window !== "undefined") {
      const fullPath = `${window.location.pathname}${window.location.search}`;
      router.push(`/login?redirect=${encodeURIComponent(fullPath)}`);
      return;
    }
    router.push("/login");
  };

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
    if (typeof window === "undefined") {
      return;
    }
    const updateColumns = () => {
      const width = window.innerWidth;
      if (width >= 1024) {
        setColumnCount(2);
        return;
      }
      setColumnCount(1);
    };
    updateColumns();
    window.addEventListener("resize", updateColumns);
    return () => window.removeEventListener("resize", updateColumns);
  }, []);

  useEffect(() => {
    if (!authHeader) {
      setCurrentUserId(null);
      setMeProfile(null);
      return;
    }
    fetch(`${API_BASE}/me`, { headers: { ...authHeader } })
      .then(async (res) => {
        if (!res.ok) {
          return null;
        }
        return res.json();
      })
      .then((data: PublicProfile | null) => {
        setCurrentUserId(data?.id ?? null);
        setMeProfile(data ?? null);
      })
      .catch(() => {
        setCurrentUserId(null);
        setMeProfile(null);
      });
  }, [authHeader]);

  const fetchHall = async () => {
    const res = await fetch(`${API_BASE}/hall`, {
      headers: authHeader ? { ...authHeader } : undefined
    });
    if (!res.ok) {
      setStatus("Failed to load the Forum.");
      return;
    }
    const data = (await res.json()) as HallResponse;
    setHall(data);
  };

  const startConversation = async (userId: string) => {
    if (!authHeader) {
      redirectToLogin();
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
      redirectToLogin();
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
        city: data.city ?? null,
        country: data.country ?? null,
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
      redirectToLogin();
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
      redirectToLogin();
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
      redirectToLogin();
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
    fetchHall().catch(() => setStatus("Failed to load the Forum."));
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

  useEffect(() => {
    if (!traceDetail) {
      return;
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedTraceId(null);
      }
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [traceDetail]);

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
      redirectToLogin();
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
      redirectToLogin();
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
      return author.maskName ?? "House";
    }
    return author.maskName ?? "Anonymous";
  };

  const normalizeTraceContent = (value: string) => {
    if (!value) return value;
    const sanitized = value.replace(/\u70b9\u51fb\u770b\u5168\u6587/g, "Read full story");
    const lines = sanitized.split("\n").map((line) => line.trim());
    const filtered = lines.filter((line) => line.length > 0);
    if (filtered.length === 0) return sanitized;
    const last = filtered[filtered.length - 1];
    if (last.toLowerCase() === "read full story") {
      filtered.pop();
    }
    return filtered.join("\n");
  };

  const isProfileComplete = Boolean(
    meProfile?.maskName &&
      meProfile.maskName.trim().length > 0 &&
      meProfile?.maskAvatarUrl &&
      ((meProfile.preference?.vibeTags?.length ?? 0) > 0 ||
        (meProfile.preference?.interests?.length ?? 0) > 0) &&
      (meProfile.preference?.smPreference?.trim().length ?? 0) > 0
  );

  const openProfileOnboarding = () => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new Event("open-profile-onboarding"));
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
      <div className="w-64 rounded-xl border border-border-default bg-card p-3 text-xs text-text-secondary shadow-sm">
        <p className="text-sm font-semibold text-text-primary">
          {renderTraceAuthor(author)}
        </p>
        {lines.length > 0 && (
          <div className="mt-2 space-y-1">
            {lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        )}
        <p className="mt-3 text-[10px] uppercase tracking-wide text-text-muted">
          Known for:
        </p>
        {tags.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-border-default px-2 py-0.5 text-[10px] text-text-muted"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-text-muted">бк</p>
        )}
        <div className="mt-3 space-y-1 text-text-muted">
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

  const cardBaseClasses =
    "ui-card w-full p-4 text-left text-text-primary transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40";

  const renderNovelCard = (novel: NovelItem) => {
    const teaser = (novel.description ?? novel.title).split("\n")[0] ?? "";
    const metaParts = [
      novel.viewCount ? `${novel.viewCount} views` : null,
      novel.favoriteCount ? `${novel.favoriteCount} favorites` : null
    ].filter(Boolean);
    return (
      <button
        key={novel.id}
        type="button"
        className={`${cardBaseClasses} flex flex-col gap-3 bg-gradient-to-br from-brand-primary/10 via-surface to-card hover:border-brand-primary/40 max-h-[50vh] overflow-hidden`}
        onClick={() => router.push(`/novels/${novel.id}`)}
      >
        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-text-muted">
          <span className="rounded-full bg-accent-premium/15 px-2 py-1 text-[10px] font-semibold text-accent-premium">
            Story
          </span>
          {metaParts.length > 0 && (
            <span className="text-[10px] uppercase tracking-[0.3em] text-text-muted">
              {metaParts.join(" · ")}
            </span>
          )}
        </div>
        <div className="overflow-hidden rounded-xl border border-border-default bg-card">
          {novel.coverImageUrl ? (
            <img
              src={resolveMediaUrl(novel.coverImageUrl) ?? ""}
              alt={novel.title}
              className="w-full max-h-[32vh] object-cover"
            />
          ) : (
            <div className="flex min-h-[160px] items-center justify-center text-xs text-text-muted">
              No cover
            </div>
          )}
        </div>
        <div>
          <p
            className="text-base font-semibold text-text-primary"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden"
            }}
          >
            {novel.title}
          </p>
          <p
            className="mt-2 text-sm text-text-secondary"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden"
            }}
          >
            {teaser}
          </p>
        </div>
        <div className="mt-auto flex items-center justify-between text-xs text-text-muted">
          <span>{novel.room?.title ?? "House story"}</span>
          <span className="font-semibold text-brand-primary">Read story</span>
        </div>
      </button>
    );
  };

  const renderTraceCard = (trace: TraceItem) => {
    const isSelected = selectedTraceId === trace.id;
    const isImageTrace = Boolean(trace.imageUrl);
    const cardClasses = [
      cardBaseClasses,
      "bg-card hover:border-brand-primary/40",
      isSelected ? "ring-1 ring-brand-primary/40" : ""
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
        <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.2em] text-text-muted">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-surface overflow-hidden"
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
                <span className="h-8 w-8 rounded-full bg-surface" />
              )}
            </button>
            <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-text-primary">
              {renderTraceAuthor(trace.author)}
            </span>
          </div>
          <span className="text-[10px] uppercase tracking-[0.3em] text-text-muted">
            {formatTraceTime(trace.createdAt)}
          </span>
        </div>
        {isImageTrace && trace.imageUrl ? (
          <>
            <div className="mt-4 overflow-hidden rounded-xl bg-surface">
              <img
                src={resolveMediaUrl(trace.imageUrl) ?? ""}
                alt={trace.content.slice(0, 40)}
                className="w-full object-contain"
                style={{
                  aspectRatio:
                    trace.imageWidth && trace.imageHeight
                      ? `${trace.imageWidth} / ${trace.imageHeight}`
                      : "4 / 5"
                }}
              />
            </div>
            <p
              className="mt-3 text-sm leading-relaxed text-text-secondary"
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
            className="mt-4 text-base leading-relaxed text-text-secondary"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 5,
              WebkitBoxOrient: "vertical",
              overflow: "hidden"
            }}
          >
            {normalizeTraceContent(trace.content)}
          </p>
        )}
        <div className="mt-4 flex items-center gap-4 text-text-muted">
          <div className="inline-flex items-center gap-2 text-sm opacity-70 transition hover:opacity-100">
            <span className="flex h-9 w-9 items-center justify-center">
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M20 2H4C2.9 2 2 2.9 2 4V12C2 13.1 2.9 14 4 14H6L8 18L12 14H20C21.1 14 22 13.1 22 12V4C22 2.9 21.1 2 20 2Z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
                <path
                  d="M6 14L4 18L6 16H8V14H6Z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
                <circle cx="9" cy="7" r="1.2" fill="currentColor" />
                <circle cx="12" cy="7" r="1.2" fill="currentColor" />
                <circle cx="15" cy="7" r="1.2" fill="currentColor" />
              </svg>
            </span>
            <span className="text-sm">{trace.replyCount}</span>
          </div>
          <button
            type="button"
            className={`inline-flex items-center gap-2 text-sm opacity-70 transition hover:opacity-100 ${
              trace.likedByMe ? "text-brand-primary" : "text-brand-secondary"
            }`}
            onClick={(event) => {
              event.stopPropagation();
              toggleLike(trace.id);
            }}
            aria-label="Toggle like"
          >
            <span className="flex h-9 w-9 items-center justify-center">
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M12 20.5c-5.05-3.62-8.5-6.7-8.5-10.6 0-2.3 1.74-4.1 4.06-4.1 1.62 0 3.18.9 4.44 2.38 1.26-1.48 2.82-2.38 4.44-2.38 2.32 0 4.06 1.8 4.06 4.1 0 3.9-3.45 6.98-8.5 10.6z"
                  fill={trace.likedByMe ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
              </svg>
            </span>
            <span className="text-sm">{trace.likeCount ?? 0}</span>
          </button>
        </div>
        {currentUserId &&
          trace.author?.id &&
          trace.author.role !== "OFFICIAL" &&
          trace.author.id !== currentUserId && (
            <button
              type="button"
              className="mt-3 w-full rounded-full border border-border-default px-3 py-2 text-[10px] font-semibold text-text-secondary"
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
  };

  const postTraces = useMemo(
    () => (hall?.traces ?? []).filter((trace) => !trace.novelId),
    [hall]
  );

  const feedItems = useMemo<HallFeedItem[]>(() => {
    const novels = hall?.novels ?? [];
    if (activeTab === "story") {
      return novels.map((novel) => ({ kind: "novel" as const, novel }));
    }
    if (activeTab === "post") {
      return postTraces.map((trace) => ({ kind: "trace" as const, trace }));
    }
    return [
      ...novels.map((novel) => ({ kind: "novel" as const, novel })),
      ...postTraces.map((trace) => ({ kind: "trace" as const, trace }))
    ];
  }, [activeTab, hall, postTraces]);

  const feedColumns = useMemo(() => {
    const columns = Array.from({ length: columnCount }, () => [] as HallFeedItem[]);
    feedItems.forEach((item, index) => {
      columns[index % columnCount].push(item);
    });
    return columns;
  }, [columnCount, feedItems]);

    return (
    <>
      <main className="ui-page">
        <div className="ui-container py-8">
          <section className="ui-card p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">
              Stories &amp; Spaces
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-text-primary">
              Here, users can explore and read digital fiction.
            </h1>
            <p className="mt-2 text-sm text-text-secondary">
              Some of the stories are free to enjoy, and some require a purchase to
              unlock the full experience.
            </p>
            <div className="mt-4 space-y-2 text-sm text-text-secondary">
              <p>It is a place for entertainment.</p>
              <p>Some stories are light and fun, others are intense and immersive.</p>
              <p>Whatever you're in the mood for, there's something here.</p>
            </div>
          </section>

          {showWelcome && (
            <div className="mt-4 ui-surface p-4 text-sm text-text-secondary">
              <p>Welcome to HookedUp?</p>
              <p>This is the main hub of our platform.</p>
              <p>Look around and discover the stories you love.</p>
              <p>
                If something catches your interest, feel free to unlock more content
                and continue reading.
              </p>
              <button
                type="button"
                className="btn-secondary mt-3 px-3 py-1 text-xs"
                onClick={() => {
                  localStorage.setItem("hallWelcomeSeen", "true");
                  setShowWelcome(false);
                }}
              >
                Close
              </button>
            </div>
          )}
          {status && <p className="mt-3 text-sm text-text-secondary">{status}</p>}

          <section className="mt-6 space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">
                  Forum Feed
                </h2>
                <p className="text-xs text-text-muted">
                  Anything can show up here.
                </p>
              </div>
              <div />
            </div>

            <div className="ui-card p-4 sm:p-5">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-border-default bg-surface text-sm font-semibold text-text-secondary">
                    {meProfile?.maskAvatarUrl ? (
                      <img
                        src={meProfile.maskAvatarUrl}
                        alt={meProfile.maskName ?? "Avatar"}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <span>
                        {(meProfile?.maskName ?? "U").slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <textarea
                    className="flex-1 resize-none rounded-full border border-border-default bg-card px-4 py-3 text-sm text-text-primary placeholder:text-text-muted"
                    rows={1}
                    maxLength={1000}
                    placeholder="What's on your mind tonight?"
                    value={traceInput}
                    onChange={(event) => setTraceInput(event.target.value)}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-border-default bg-card text-text-secondary"
                      onClick={() => fileInputRef.current?.click()}
                      aria-label="Attach image"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        className="h-5 w-5"
                      >
                        <path d="M12 5v14" />
                        <path d="M5 12h14" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-primary text-card"
                      onClick={handlePostTrace}
                      disabled={postingTrace || uploadingImage}
                      aria-label="Start a post"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        className="h-5 w-5"
                      >
                        <path d="M5 12h14" />
                        <path d="M13 6l6 6-6 6" />
                      </svg>
                    </button>
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleImageSelect}
                />

                {selectedImageFile && imagePreview && (
                  <div className="ui-surface p-3">
                    <div className="overflow-hidden rounded-2xl bg-card relative">
                      <img
                        src={
                          imagePreview?.startsWith("http")
                            ? imagePreview
                            : `${API_BASE}${imagePreview}`
                        }
                        alt={selectedImageFile.name}
                        className="h-32 w-full object-cover"
                      />
                      {uploadingImage && (
                        <div className="absolute inset-0 flex items-center justify-center bg-text-primary/30">
                          <p className="text-xs text-text-primary">Uploading...</p>
                        </div>
                      )}
                      {uploadedImageData && !uploadingImage && (
                        <div className="absolute top-2 right-2 rounded-full bg-brand-secondary px-2 py-1">
                          <p className="text-[10px] text-card font-semibold">Uploaded</p>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-text-primary">
                          {selectedImageFile.name}
                        </p>
                        <p className="text-[10px] text-text-muted">
                          {formatBytes(selectedImageFile.size)}
                          {uploadedImageData &&
                            uploadedImageData.width &&
                            uploadedImageData.height && (
                              <span>
                                {" "}- {uploadedImageData.width}x{uploadedImageData.height}
                              </span>
                            )}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="rounded-full border border-border-default px-2 py-1 text-[10px] text-text-secondary"
                        onClick={clearSelectedImage}
                        disabled={uploadingImage}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}
                {imageError && (
                  <p className="text-xs text-text-secondary">{imageError}</p>
                )}
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span>{traceInput.length}/1000</span>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              {feedColumns.map((column, columnIndex) => (
                <div key={`feed-col-${columnIndex}`} className="flex flex-col gap-4">
                  {column.map((item) =>
                    item.kind === "novel"
                      ? renderNovelCard(item.novel)
                      : renderTraceCard(item.trace)
                  )}
                </div>
              ))}
            </div>
            {hall && feedItems.length === 0 && (
              <p className="mt-4 text-sm text-text-muted">
                <span>It is quiet right now.</span>
                <br />
                <span>Be the one who breaks it.</span>
              </p>
            )}
            <p className="mt-4 text-sm text-text-muted">
              You do not have to reply. But you probably want to.
            </p>
          </section>

          {traceDetail && (
            <div role="dialog" aria-modal="true">
              <div
                className="fixed inset-0 z-50 bg-black/40 animate-trace-backdrop"
                onClick={() => setSelectedTraceId(null)}
              />
              <div className="fixed right-0 top-0 z-[60] flex h-screen w-[420px] max-w-full flex-col overflow-hidden border-l border-black/10 bg-[rgb(var(--color-card-bg))] text-[rgb(var(--color-text-primary))] shadow-[0_8px_30px_rgba(0,0,0,0.18)] animate-trace-drawer">
                <header className="sticky top-0 z-10 flex min-h-[80px] items-start justify-between border-b border-black/10 bg-[rgb(var(--color-card-bg))] px-6 py-4">
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary">
                      Trace details
                    </h3>
                    <div className="mt-2 flex items-center gap-2 text-sm text-text-secondary">
                      <button
                        type="button"
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-surface overflow-hidden"
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
                          <span className="h-6 w-6 rounded-full bg-surface" />
                        )}
                      </button>
                      <span>
                        {renderTraceAuthor(traceDetail.trace.author)} - {new Date(traceDetail.trace.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="text-xs text-text-muted"
                    onClick={() => setSelectedTraceId(null)}
                  >
                    Close
                  </button>
                </header>

                <div className="h-[calc(100vh-80px)] overflow-y-auto px-6 py-5">
                  {traceDetail.trace.imageUrl && (
                    <div className="overflow-hidden rounded-2xl bg-surface">
                      <img
                        src={resolveMediaUrl(traceDetail.trace.imageUrl) ?? ""}
                        alt={traceDetail.trace.content.slice(0, 40)}
                        className="w-full object-contain"
                        style={{
                          aspectRatio:
                            traceDetail.trace.imageWidth &&
                            traceDetail.trace.imageHeight
                              ? `${traceDetail.trace.imageWidth} / ${traceDetail.trace.imageHeight}`
                              : "4 / 5"
                        }}
                      />
                    </div>
                  )}
                  <p className="mt-4 text-sm text-text-secondary whitespace-pre-wrap">
                    {normalizeTraceContent(traceDetail.trace.content)}
                  </p>
                  {traceDetail.trace.novelId && (
                    <button
                      type="button"
                      className="mt-4 rounded-full border border-border-default px-4 py-2 text-xs font-semibold text-text-secondary"
                      onClick={() =>
                        router.push(`/novels/${traceDetail.trace.novelId}`)
                      }
                    >
                      Read full story
                    </button>
                  )}

                  <div className="mt-6 space-y-3">
                    {traceDetail.replies.map((reply) => (
                      <div
                        key={reply.id}
                        className="rounded-xl border border-border-default bg-surface p-3"
                      >
                        <div className="flex items-center justify-between text-xs text-text-muted">
                          <span>{renderTraceAuthor(reply.author)}</span>
                          <span>
                            {new Date(reply.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-text-secondary">
                          {reply.content}
                        </p>
                      </div>
                    ))}
                    {traceDetail.replies.length === 0 && (
                      <p className="text-sm text-text-muted">No replies yet.</p>
                    )}
                  </div>

                  {traceDetail.nextCursor && (
                    <button
                      type="button"
                      className="mt-4 rounded-full border border-border-default px-4 py-2 text-xs font-semibold text-text-secondary"
                      onClick={loadMoreReplies}
                      disabled={loadingReplies}
                    >
                      {loadingReplies ? "Loading..." : "Load more replies"}
                    </button>
                  )}
                </div>

                <div className="border-t border-black/10 bg-[rgb(var(--color-card-bg))] px-6 py-4">
                  <label className="text-xs font-semibold text-text-secondary">
                    Reply
                  </label>
                  <textarea
                    className="mt-2 w-full rounded-xl border border-border-default bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
                    rows={2}
                    maxLength={200}
                    placeholder="Write a reply (max 200)."
                    value={replyInput}
                    onChange={(event) => setReplyInput(event.target.value)}
                  />
                  <div className="mt-2 flex items-center justify-between text-xs text-text-muted">
                    <span>{replyInput.length}/200</span>
                    <button
                      type="button"
                      className="rounded-full bg-brand-primary px-4 py-2 text-xs font-semibold text-card"
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
        </div>
      </main>
      {profileCard && (
        <ProfileCard
          profile={profileCard}
          onClose={() => setProfileCard(null)}
          onStartPrivate={async (userId) => {
            await startConversation(userId);
            setProfileCard(null);
          }}
          onViewProfile={(userId) => {
            if (currentUserId && userId === currentUserId) {
              router.push("/me");
              setProfileCard(null);
              return;
            }
            router.push(`/users/${userId}`);
            setProfileCard(null);
          }}
          onBlock={blockUser}
          onReport={reportUser}
        />
      )}
      {profileLoading && (
        <div className="fixed inset-0 z-40 flex items-center justify-center text-xs text-text-secondary">
          Loading profile...
        </div>
      )}
    </>
  );}



