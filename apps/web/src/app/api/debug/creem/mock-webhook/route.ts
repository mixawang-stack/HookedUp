import crypto from "crypto";

export const runtime = "nodejs";

const API_BASE =
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:3001";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not Found", { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    userId?: string;
    novelId?: string;
    productId?: string;
    amount?: number;
    currency?: string;
    eventId?: string;
  };

  const userId = body.userId ?? "debug-user";
  const novelId = body.novelId ?? "debug-novel";
  const productId = body.productId ?? "debug-product";
  const currency = (body.currency ?? "USD").toUpperCase();
  const amountMinor = Math.round((body.amount ?? 9.99) * 100);
  const eventId = body.eventId ?? `evt_debug_${Date.now()}`;
  const orderId = `order_debug_${Date.now()}`;

  const payload = {
    id: eventId,
    type: "checkout.completed",
    data: {
      object: {
        request_id: `novel:${novelId}:user:${userId}`,
        metadata: { userId, novelId, pricingMode: "BOOK" },
        order: {
          id: orderId,
          status: "paid",
          currency,
          amount: amountMinor,
          product: { id: productId },
          checkout: { id: `co_${Date.now()}` }
        }
      }
    }
  };

  const rawBody = JSON.stringify(payload);
  const secret = process.env.CREEM_WEBHOOK_SECRET ?? "debug_secret";
  const signature = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  const res = await fetch(`${API_BASE}/webhooks/creem`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "creem-signature": signature
    },
    body: rawBody
  });

  const text = await res.text();
  return new Response(text, { status: res.status });
}
