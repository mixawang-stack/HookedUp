import crypto from "crypto";

const SIGNATURE_HEADER = "creem-signature";

export const verifyCreemSignature = (
  rawBody: string,
  signatureHeader: string,
  secret: string
) => {
  if (!secret) {
    return false;
  }
  const signature = signatureHeader.startsWith("sha256=")
    ? signatureHeader.slice("sha256=".length)
    : signatureHeader;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  return (
    signatureBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  );
};

export const verifyCreemRequest = (request: Request, rawBody: string) => {
  if (process.env.NODE_ENV === "development") {
    const skipHeader = request.headers.get("x-skip-creem-signature");
    if (skipHeader === "true") {
      return true;
    }
  }
  const secret = process.env.CREEM_WEBHOOK_SECRET ?? "";
  const signatureHeader = request.headers.get(SIGNATURE_HEADER) ?? "";
  return verifyCreemSignature(rawBody, signatureHeader, secret);
};
