"use client";

type SenderProfile = {
  id: string;
  maskName: string | null;
  maskAvatarUrl: string | null;
} | null;

type ChatBubbleProps = {
  message: {
    id: string;
    ciphertext: string;
    createdAt: string;
    sender: SenderProfile;
  };
  isMine: boolean;
  showMeta: boolean;
};

const formatShortTime = (value: string) =>
  new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });

const Avatar = ({ avatarUrl, label }: { avatarUrl: string | null; label: string }) => (
  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border-default bg-surface text-xs font-semibold uppercase text-text-secondary">
    {avatarUrl ? (
      <img
        src={avatarUrl}
        alt={`${label} avatar`}
        className="h-full w-full rounded-full object-cover"
      />
    ) : (
      <span>{label}</span>
    )}
  </div>
);

export default function ChatBubble({ message, isMine, showMeta }: ChatBubbleProps) {
  const sender = message.sender;
  const senderName = sender?.maskName?.trim();
  const displayName =
    senderName && senderName.length > 0
      ? senderName
      : isMine
      ? "You"
      : "Anonymous";
  const isSystem = !sender;
  const initial = displayName.charAt(0).toUpperCase();

  const bubbleClasses = [
    "inline-block",
    "w-fit",
    "min-w-[72px]",
    "max-w-[min(640px,85%)]",
    "break-words",
    "overflow-hidden",
    "rounded-[16px]",
    "px-[14px]",
    "py-[12px]",
    "text-sm",
    "leading-[1.5]",
    "animate-chat-bubble",
    "transition"
  ];

  if (isSystem) {
    bubbleClasses.push(
      "bg-surface",
      "border",
      "border-border-default",
      "text-text-muted",
      "shadow-sm",
      "text-xs",
      "uppercase",
      "tracking-[0.4em]"
    );
  } else if (isMine) {
    bubbleClasses.push(
      "bg-brand-primary",
      "text-card",
      "shadow-sm",
      "border",
      "border-brand-primary/40"
    );
  } else {
    bubbleClasses.push(
      "bg-card",
      "border",
      "border-border-default",
      "text-text-primary",
      "shadow-sm"
    );
  }

  const alignClass = isSystem
    ? "justify-center"
    : isMine
    ? "justify-end"
    : "justify-start";

  return (
    <div className={`flex w-full items-start gap-3 ${alignClass}`}>
      {!isMine && !isSystem && showMeta && (
        <Avatar avatarUrl={sender?.maskAvatarUrl ?? null} label={initial} />
      )}
      <div className={`flex flex-col ${isMine ? "items-end" : "items-start"} gap-1`}>
        {showMeta && !isSystem && (
          <div className="text-[11px] text-text-muted flex items-center gap-2">
            <span className="font-semibold">{displayName}</span>
            <span>{formatShortTime(message.createdAt)}</span>
          </div>
        )}
        <div 
          className={bubbleClasses.join(" ")} 
          style={{ wordBreak: "break-word", overflowWrap: "break-word" }}
        >
          {message.ciphertext}
        </div>
      </div>
      {isMine && !isSystem && showMeta && (
        <Avatar avatarUrl={sender?.maskAvatarUrl ?? null} label={initial} />
      )}
    </div>
  );
}
