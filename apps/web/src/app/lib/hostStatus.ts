export type HostPageType = "hall" | "rooms" | "room" | "private" | "other";

export type HostStatusDetail = {
  page: HostPageType;
  cold?: boolean;
};

export const HOST_STATUS_EVENT = "host-status-update";

export const emitHostStatus = (detail: HostStatusDetail) => {
  if (typeof window === "undefined") {
    return;
  }
  const event = new CustomEvent(HOST_STATUS_EVENT, { detail });
  window.dispatchEvent(event);
};
