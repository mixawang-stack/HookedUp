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

const getData = (payload: Record<string, unknown>) =>
  (payload?.data as Record<string, unknown> | undefined) ?? payload;

const getMetadata = (payload: Record<string, unknown>) => {
  const data = getData(payload);
  return (data?.metadata as Record<string, unknown> | undefined) ?? {};
};

const getUserId = (payload: Record<string, unknown>) => {
  const metadata = getMetadata(payload);
  return (metadata.user_id ?? metadata.userId ?? null) as string | null;
};

const getCheckoutId = (payload: Record<string, unknown>) => {
  const data = getData(payload);
  const checkout = data?.checkout as Record<string, unknown> | undefined;
  return (
    (data?.checkout_id as string | undefined) ??
    (data?.id as string | undefined) ??
    (checkout?.id as string | undefined) ??
    null
  );
};

const getOrderAmount = (payload: Record<string, unknown>) => {
  const data = getData(payload);
  const order = (data?.order as Record<string, unknown> | undefined) ?? data;
  return toNumber(order?.amount);
};

const getCurrency = (payload: Record<string, unknown>) => {
  const data = getData(payload);
  const order = (data?.order as Record<string, unknown> | undefined) ?? data;
  const currency = (order?.currency as string | undefined) ?? "USD";
  return currency.toUpperCase();
};

const getPaidAt = (payload: Record<string, unknown>) => {
  const data = getData(payload);
  const order = (data?.order as Record<string, unknown> | undefined) ?? data;
  return (
    (order?.paid_at as string | undefined) ??
    (order?.paidAt as string | undefined) ??
    null
  );
};

const getSubscriptionId = (payload: Record<string, unknown>) => {
  const data = getData(payload);
  const subscription = data?.subscription as Record<string, unknown> | undefined;
  return (
    (data?.subscription_id as string | undefined) ??
    (data?.id as string | undefined) ??
    (subscription?.id as string | undefined) ??
    null
  );
};

const getCurrentPeriodEnd = (payload: Record<string, unknown>) => {
  const data = getData(payload);
  const subscription = data?.subscription as Record<string, unknown> | undefined;
  return (
    (data?.current_period_end as string | undefined) ??
    (data?.period_end as string | undefined) ??
    (data?.ends_at as string | undefined) ??
    (subscription?.current_period_end as string | undefined) ??
    null
  );
};

const resolveMaxPeriodEnd = async (
  subscriptionId: string,
  nextValue: string | null
) => {
  if (!nextValue) return nextValue;
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("subscriptions")
    .select("current_period_end")
    .eq("provider_subscription_id", subscriptionId)
    .maybeSingle();
  const existing = data?.current_period_end as string | null | undefined;
  if (!existing) return nextValue;
  return new Date(existing) > new Date(nextValue) ? existing : nextValue;
};

const updateOrder = async (
  payload: Record<string, unknown>,
  status: string
) => {
  const supabase = getSupabaseAdmin();
  const checkoutId = getCheckoutId(payload);
  if (!checkoutId) return;
  await supabase.from("orders").upsert(
    {
      provider: "creem",
      provider_checkout_id: checkoutId,
      status,
      amount: getOrderAmount(payload),
      currency: getCurrency(payload),
      paid_at: getPaidAt(payload),
      user_id: getUserId(payload)
    },
    { onConflict: "provider_checkout_id" }
  );
};

const updateSubscription = async (
  payload: Record<string, unknown>,
  status: string,
  options?: { updatePeriodEnd?: boolean; cancelAtPeriodEnd?: boolean }
) => {
  const supabase = getSupabaseAdmin();
  const subscriptionId = getSubscriptionId(payload);
  if (!subscriptionId) return;
  const currentPeriodEnd = options?.updatePeriodEnd
    ? await resolveMaxPeriodEnd(subscriptionId, getCurrentPeriodEnd(payload))
    : getCurrentPeriodEnd(payload);
  await supabase.from("subscriptions").upsert(
    {
      provider: "creem",
      provider_subscription_id: subscriptionId,
      status,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: options?.cancelAtPeriodEnd ?? false,
      user_id: getUserId(payload)
    },
    { onConflict: "provider_subscription_id" }
  );
};

const updateEntitlementsFromMetadata = async (payload: Record<string, unknown>) => {
  const metadata = getMetadata(payload);
  const userId = getUserId(payload);
  if (!userId) return;
  const supabase = getSupabaseAdmin();
  const type = (metadata.type as string | undefined) ?? "";
  if (type === "story_unlock") {
    const refId = (metadata.story_id as string | undefined) ?? null;
    if (!refId) return;
    await supabase.from("entitlements").upsert(
      {
        user_id: userId,
        entitlement_type: "story",
        ref_id: refId,
        status: "active",
        starts_at: new Date().toISOString()
      },
      { onConflict: "user_id,entitlement_type,ref_id" }
    );
  }
  if (type === "chapter_unlock") {
    const refId = (metadata.chapter_id as string | undefined) ?? null;
    if (!refId) return;
    await supabase.from("entitlements").upsert(
      {
        user_id: userId,
        entitlement_type: "chapter",
        ref_id: refId,
        status: "active",
        starts_at: new Date().toISOString()
      },
      { onConflict: "user_id,entitlement_type,ref_id" }
    );
  }
};

const updateMembershipEntitlement = async (
  payload: Record<string, unknown>
) => {
  const userId = getUserId(payload);
  if (!userId) return;
  const metadata = getMetadata(payload);
  const planId =
    (metadata.plan_id as string | undefined) ??
    (metadata.planId as string | undefined) ??
    "default";
  const endsAt = getCurrentPeriodEnd(payload);
  const supabase = getSupabaseAdmin();
  await supabase.from("entitlements").upsert(
    {
      user_id: userId,
      entitlement_type: "membership",
      ref_id: planId,
      status: "active",
      ends_at: endsAt
    },
    { onConflict: "user_id,entitlement_type,ref_id" }
  );
};

const revokeEntitlements = async (payload: Record<string, unknown>) => {
  const userId = getUserId(payload);
  if (!userId) return;
  const supabase = getSupabaseAdmin();
  await supabase
    .from("entitlements")
    .update({ status: "revoked" })
    .eq("user_id", userId);
};

const handleCreemEvent = async (event: CreemEvent) => {
  const type = event.type;
  const payload = event.payload_json;

  switch (type) {
    case "checkout.completed":
      await updateOrder(payload, "completed");
      await updateEntitlementsFromMetadata(payload);
      return "success";
    case "subscription.active":
      await updateSubscription(payload, "active", { updatePeriodEnd: true });
      await updateMembershipEntitlement(payload);
      return "success";
    case "subscription.trialing":
      await updateSubscription(payload, "trialing", { updatePeriodEnd: true });
      await updateMembershipEntitlement(payload);
      return "success";
    case "subscription.paid":
      await updateSubscription(payload, "active", { updatePeriodEnd: true });
      await updateMembershipEntitlement(payload);
      return "success";
    case "subscription.past_due":
    case "subscription.unpaid":
      await updateSubscription(payload, "past_due");
      return "success";
    case "subscription.paused":
      await updateSubscription(payload, "paused");
      return "success";
    case "subscription.canceled":
      await updateSubscription(payload, "canceled");
      return "success";
    case "subscription.expired":
      await updateSubscription(payload, "expired");
      return "success";
    case "subscription.scheduled_cancel":
      await updateSubscription(payload, "active", { cancelAtPeriodEnd: true });
      return "success";
    case "subscription.update":
      await updateSubscription(payload, "active", { updatePeriodEnd: true });
      return "success";
    case "refund.created":
      await updateOrder(payload, "refunded");
      await revokeEntitlements(payload);
      return "success";
    case "dispute.created":
      await updateOrder(payload, "disputed");
      await revokeEntitlements(payload);
      return "success";
    default:
      return "skipped";
  }
};

export const processCreemEvents = async (limit = 50) => {
  const { data, error } = await fetchPendingWebhookEvents(limit);
  if (error) {
    throw new Error(error.message);
  }
  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of data) {
    const event = {
      event_id: item.event_id as string,
      type: item.type as string,
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
