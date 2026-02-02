import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs";

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const CREEM_WEBHOOK_SECRET = process.env.CREEM_WEBHOOK_SECRET ?? "";

const getSupabaseAdmin = () => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
};

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("creem-signature") ?? "";
  const signature = signatureHeader.startsWith("sha256=")
    ? signatureHeader.slice("sha256=".length)
    : signatureHeader;

  if (!CREEM_WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ error: "WEBHOOK_SECRET_MISSING" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  const expectedSignature = crypto
    .createHmac("sha256", CREEM_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  const signatureValid =
    signatureBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
  if (!signatureValid) {
    return new Response(JSON.stringify({ error: "INVALID_SIGNATURE" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  let eventId = "";
  let eventType = "";
  let productId = "";
  let userId = "";
  let novelId = "";
  try {
    const parsed = JSON.parse(rawBody);
    eventId = parsed?.id ?? "";
    eventType = parsed?.type ?? "";
    const order = parsed?.data?.object?.order;
    const metadata = parsed?.data?.object?.metadata ?? {};
    const product =
      typeof order?.product === "string" ? order.product : order?.product?.id ?? "";
    productId = product ?? "";
    userId = metadata?.userId ?? metadata?.user_id ?? "";
    novelId = metadata?.novelId ?? metadata?.novel_id ?? "";
  } catch {
    // ignore parse failure
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return new Response(
      JSON.stringify({ received: true, warning: "supabase-not-configured" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  let amount = 0;
  let currency = "USD";
  let orderId = "";
  let checkoutId = "";
  let orderStatus = "";

  try {
    const parsed = JSON.parse(rawBody);
    const order = parsed?.data?.object?.order;
    amount = Number(order?.amount ?? 0) / 100;
    currency = String(order?.currency ?? "USD").toUpperCase();
    orderId = String(order?.id ?? "");
    checkoutId = String(order?.checkout?.id ?? "");
    orderStatus = String(order?.status ?? "");
  } catch {
    // ignore parse failure
  }

  const isPaid =
    ["paid", "succeeded", "completed"].includes(orderStatus) ||
    /completed|paid|succeeded/i.test(eventType);

  try {
    await supabase.from("PaymentWebhookEvent").upsert(
      {
        provider: "CREEM",
        eventId,
        eventType,
        payload: JSON.parse(rawBody),
        processedAt: new Date().toISOString()
      },
      { onConflict: "provider,eventId" }
    );
  } catch {
    // ignore logging failure
  }

  if (isPaid && userId && novelId) {
    await supabase.from("Entitlement").upsert(
      {
        userId,
        novelId,
        scope: "BOOK"
      },
      { onConflict: "userId,novelId,scope" }
    );
    await supabase.from("NovelPurchase").upsert(
      {
        userId,
        novelId,
        pricingMode: "BOOK",
        amount,
        currency,
        provider: "CREEM",
        providerOrderId: orderId || null,
        providerEventId: eventId || null,
        providerCheckoutId: checkoutId || null
      },
      { onConflict: "provider,providerEventId" }
    );
  }

  if (eventId) {
    await supabase.from("CreemOrder").upsert(
      {
        creemEventId: eventId,
        creemOrderId: orderId || null,
        creemCheckoutId: checkoutId || null,
        creemProductId: productId || null,
        amount: amount || 0,
        currency: currency || "USD",
        status: orderStatus || eventType,
        userId: userId || null,
        novelId: novelId || null
      },
      { onConflict: "creemEventId" }
    );
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
