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
    senderId?: string;
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
  <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border-default bg-surface text-[11px] font-semibold uppercase text-text-secondary">
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
  const isSystem = !sender && !message.senderId;
  const initial = displayName.charAt(0).toUpperCase();

  const bubbleClasses = [
    "inline-block",
    "w-fit",
    "max-w-[60%]",
    "break-words",
    "overflow-hidden",
    "rounded-[18px]",
    "px-4",
    "py-3",
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
    bubbleClasses.push("bg-rose-400", "text-white", "shadow-sm");
  } else {
    bubbleClasses.push(
      "bg-surface",
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
    <div className={`flex w-full items-end gap-3 ${alignClass}`}>
      {!isMine && !isSystem && (
        <Avatar avatarUrl={sender?.maskAvatarUrl ?? null} label={initial} />
      )}
      <div className={`flex flex-col ${isMine ? "items-end" : "items-start"} gap-1`}>
        <div
          className={bubbleClasses.join(" ")}
          style={{ wordBreak: "break-word", overflowWrap: "break-word" }}
        >
          {message.ciphertext}
        </div>
        {!isSystem && (
          <span className="text-[10px] text-text-muted">
            {formatShortTime(message.createdAt)}
          </span>
        )}
      </div>
    </div>
  );
}
