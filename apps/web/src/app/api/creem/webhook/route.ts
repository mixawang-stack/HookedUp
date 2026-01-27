export const runtime = "nodejs";

const API_BASE =
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:3001";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("creem-signature") ?? "";
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

  console.log("Creem webhook", {
    eventType,
    eventId,
    productId,
    userId,
    novelId
  });

  try {
    await fetch(`${API_BASE}/webhooks/creem`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "creem-signature": signature
      },
      body: rawBody
    });
  } catch (error) {
    console.error("Creem webhook forward failed", error);
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
