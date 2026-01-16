process.env.NODE_ENV = "test";
process.env.AUTH_RETURN_VERIFY_TOKEN = "true";
process.env.AUTH_ALLOW_UNVERIFIED_LOGIN = "false";
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ?? "test-access-secret";
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ?? "test-refresh-secret";
process.env.JWT_ACCESS_TTL = process.env.JWT_ACCESS_TTL ?? "900";
process.env.JWT_REFRESH_TTL = process.env.JWT_REFRESH_TTL ?? "604800";
process.env.EMAIL_VERIFY_TTL = process.env.EMAIL_VERIFY_TTL ?? "86400";
process.env.API_PUBLIC_BASE_URL =
  process.env.API_PUBLIC_BASE_URL ?? "http://localhost:3001";
process.env.AUTH_REFRESH_COOKIE_NAME =
  process.env.AUTH_REFRESH_COOKIE_NAME ?? "hookedup_refresh";
process.env.CRYPTO_KEY =
  process.env.CRYPTO_KEY ?? "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";
process.env.CRYPTO_KEY_ID =
  process.env.CRYPTO_KEY_ID ?? "test-primary";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://hookedup:hookedup@localhost:5432/hookedup?schema=public";
