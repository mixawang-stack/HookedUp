export const AUTH_REFRESH_COOKIE_NAME =
  process.env.AUTH_REFRESH_COOKIE_NAME ?? "hookedup_refresh";

export const AUTH_ALLOW_UNVERIFIED_LOGIN =
  (process.env.AUTH_ALLOW_UNVERIFIED_LOGIN ?? "false").toLowerCase() === "true";

export const AUTH_RETURN_VERIFY_TOKEN =
  (process.env.AUTH_RETURN_VERIFY_TOKEN ?? "false").toLowerCase() === "true";

const accessTtlRaw = Number(process.env.JWT_ACCESS_TTL ?? 900);
const refreshTtlRaw = Number(process.env.JWT_REFRESH_TTL ?? 604800);
const verifyTtlRaw = Number(process.env.EMAIL_VERIFY_TTL ?? 86400);

export const JWT_ACCESS_TTL_SECONDS = Number.isFinite(accessTtlRaw)
  ? accessTtlRaw
  : 900;

const adminAccessTtlRaw = Number(
  process.env.ADMIN_JWT_ACCESS_TTL ?? JWT_ACCESS_TTL_SECONDS
);
export const ADMIN_JWT_ACCESS_TTL_SECONDS = Number.isFinite(adminAccessTtlRaw)
  ? adminAccessTtlRaw
  : JWT_ACCESS_TTL_SECONDS;
export const JWT_REFRESH_TTL_SECONDS = Number.isFinite(refreshTtlRaw)
  ? refreshTtlRaw
  : 604800;
export const EMAIL_VERIFY_TTL_SECONDS = Number.isFinite(verifyTtlRaw)
  ? verifyTtlRaw
  : 86400;

export const JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ?? "dev-access-secret";
export const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ?? "dev-refresh-secret";

export const API_PUBLIC_BASE_URL =
  process.env.API_PUBLIC_BASE_URL ?? "http://localhost:3001";

export const SMTP_HOST = process.env.SMTP_HOST ?? "";
export const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587);
export const SMTP_USER = process.env.SMTP_USER ?? "";
export const SMTP_PASS = process.env.SMTP_PASS ?? "";
export const SMTP_FROM = process.env.SMTP_FROM ?? "";
export const SMTP_SECURE =
  (process.env.SMTP_SECURE ?? "false").toLowerCase() === "true";
