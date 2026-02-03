import { getSupabaseAdmin } from "../../api/_lib/supabaseAdmin";
import { fetchPendingWebhookEvents, markWebhookEvent } from "./store";

type CreemEvent = {
  event_id: string;
  type: string;
  payload_json: Record<string, unknown>;
};

const toNumber = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getObject = (payload: Record<string, unknown>) => {
  const data = payload?.data as Record<string, unknown> | undefined;
  const object = data?.object as Record<string, unknown> | undefined;
  return object ?? data ?? payload;
};

const getMetadata = (payload: Record<string, unknown>) => {
  const obj = getObject(payload);
  const metadata = (obj?.metadata ?? payload?.metadata) as
    | Record<string, unknown>
    | undefined;
  return metadata ?? {};
};

const getUserId = (payload: Record<string, unknown>) => {
  const metadata = getMetadata(payload);
  return (metadata.userId ??
    metadata.user_id ??
    metadata.userid ??
    null) as string | null;
};

const getCheckoutId = (payload: Record<string, unknown>) => {
  const obj = getObject(payload);
  const checkout = obj?.checkout as Record<string, unknown> | undefined;
  return (
    (checkout?.id as string | undefined) ??
    (obj?.checkout_id as string | undefined) ??
    (obj?.id as string | undefined) ??
    null
  );
};

const getOrderAmount = (payload: Record<string, unknown>) => {
  const obj = getObject(payload);
  const order = (obj?.order as Record<string, unknown> | undefined) ?? obj;
  const amount = toNumber(order?.amount);
  return amount;
};

const getCurrency = (payload: Record<string, unknown>) => {
  const obj = getObject(payload);
  const order = (obj?.order as Record<string, unknown> | undefined) ?? obj;
  const currency = (order?.currency as string | undefined) ?? "USD";
  return currency.toUpperCase();
};

const getPaidAt = (payload: Record<string, unknown>) => {
  const obj = getObject(payload);
  const order = (obj?.order as Record<string, unknown> | undefined) ?? obj;
  const paidAt =
    (order?.paid_at as string | undefined) ??
    (order?.paidAt as string | undefined) ??
    null;
  return paidAt;
};

const getSubscriptionId = (payload: Record<string, unknown>) => {
  const obj = getObject(payload);
  const subscription = obj?.subscription as Record<string, unknown> | undefined;
  return (
    (subscription?.id as string | undefined) ??
    (obj?.subscription_id as string | undefined) ??
    (obj?.id as string | undefined) ??
    null
  );
};

const getCurrentPeriodEnd = (payload: Record<string, unknown>) => {
  const obj = getObject(payload);
  const subscription = obj?.subscription as Record<string, unknown> | undefined;
  return (
    (subscription?.current_period_end as string | undefined) ??
    (obj?.current_period_end as string | undefined) ??
    null
  );
};

const getCancelAtPeriodEnd = (payload: Record<string, unknown>) => {
  const obj = getObject(payload);
  const subscription = obj?.subscription as Record<string, unknown> | undefined;
  const value =
    (subscription?.cancel_at_period_end as boolean | undefined) ??
    (obj?.cancel_at_period_end as boolean | undefined);
  return Boolean(value);
};

const updateOrder = async (payload: Record<string, unknown>, status: string) => {
  const supabase = getSupabaseAdmin();
  const checkoutId = getCheckoutId(payload);
  if (!checkoutId) {
    return;
  }
  const amount = getOrderAmount(payload);
  const currency = getCurrency(payload);
  const paidAt = getPaidAt(payload);
  const userId = getUserId(payload);
  await supabase.from("orders").upsert(
    {
      provider_checkout_id: checkoutId,
      status,
      amount,
      currency,
      paid_at: paidAt,
      user_id: userId
    },
    { onConflict: "provider_checkout_id" }
  );
};

const updateSubscription = async (
  payload: Record<string, unknown>,
  status: string
) => {
  const supabase = getSupabaseAdmin();
  const subscriptionId = getSubscriptionId(payload);
  if (!subscriptionId) {
    return;
  }
  await supabase.from("subscriptions").upsert(
    {
      provider_subscription_id: subscriptionId,
      status,
      current_period_end: getCurrentPeriodEnd(payload),
      cancel_at_period_end: getCancelAtPeriodEnd(payload),
      user_id: getUserId(payload)
    },
    { onConflict: "provider_subscription_id" }
  );
};

const updateEntitlements = async (payload: Record<string, unknown>) => {
  const supabase = getSupabaseAdmin();
  const metadata = getMetadata(payload);
  const userId = getUserId(payload);
  const novelId = (metadata.novelId ?? metadata.novel_id ?? null) as
    | string
    | null;
  if (!userId || !novelId) {
    return;
  }
  await supabase.from("Entitlement").upsert(
    {
      userId,
      novelId,
      scope: "BOOK"
    },
    { onConflict: "userId,novelId,scope" }
  );
};

const handleCreemEvent = async (event: CreemEvent) => {
  const type = event.type;
  const payload = event.payload_json;

  switch (type) {
    case "checkout.completed":
      await updateOrder(payload, "checkout_completed");
      await updateEntitlements(payload);
      return "success";
    case "subscription.active":
      await updateSubscription(payload, "active");
      return "success";
    case "subscription.paid":
      await updateSubscription(payload, "active");
      return "success";
    case "subscription.trialing":
      await updateSubscription(payload, "trialing");
      return "success";
    case "subscription.canceled":
      await updateSubscription(payload, "canceled");
      return "success";
    case "subscription.scheduled_cancel":
      await updateSubscription(payload, "active");
      return "success";
    case "subscription.expired":
      await updateSubscription(payload, "expired");
      return "success";
    case "subscription.unpaid":
    case "subscription.past_due":
      await updateSubscription(payload, "past_due");
      return "success";
    case "subscription.update":
      await updateSubscription(payload, "active");
      return "success";
    case "subscription.paused":
      await updateSubscription(payload, "paused");
      return "success";
    case "refund.created":
      await updateOrder(payload, "refunded");
      // TODO: revoke or downgrade entitlements
      return "success";
    case "dispute.created":
      await updateOrder(payload, "disputed");
      return "success";
    default:
      return "skipped";
  }
};

export const processCreemEvents = async (limit = 25) => {
  const { data, error } = await fetchPendingWebhookEvents(limit);
  if (error) {
    throw new Error(error.message);
  }
  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of data) {
    const event = {
      event_id: item.event_id,
      type: item.type,
      payload_json: item.payload_json as Record<string, unknown>
    };
    try {
      const result = await handleCreemEvent(event);
      processed += 1;
      if (result === "skipped") {
        skipped += 1;
        await markWebhookEvent(event.event_id, "skipped");
      } else {
        await markWebhookEvent(event.event_id, "success");
      }
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : "PROCESS_FAILED";
      await markWebhookEvent(event.event_id, "failed", message);
    }
  }

  return { processed, skipped, failed };
};
