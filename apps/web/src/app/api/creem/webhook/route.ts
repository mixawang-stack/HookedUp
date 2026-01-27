export const runtime = "nodejs";

const API_BASE =
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:3001";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("creem-signature") ?? "";

  const res = await fetch(`${API_BASE}/webhooks/creem`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "creem-signature": signature
    },
    body: rawBody
  });

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/json"
    }
  });
}
