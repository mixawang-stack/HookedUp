const DEFAULT_ALLOWED_ORIGINS = [
  "https://hooked-up.vercel.app",
  "https://hooked-up-admin.vercel.app",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002"
];

const VERCEL_PREVIEW_REGEX =
  /^https:\/\/hooked-up(?:-admin)?(?:-[a-z0-9-]+)*\.vercel\.app$/i;

const loadEnvOrigins = () =>
  (process.env.CORS_ORIGIN ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

export const isAllowedOrigin = (origin?: string | null) => {
  if (!origin) {
    return true;
  }
  if (DEFAULT_ALLOWED_ORIGINS.includes(origin)) {
    return true;
  }
  const envOrigins = loadEnvOrigins();
  if (envOrigins.includes(origin)) {
    return true;
  }
  if (VERCEL_PREVIEW_REGEX.test(origin)) {
    return true;
  }
  return false;
};

export const buildCorsOrigin = () => (origin: string | undefined, callback: Function) => {
  if (isAllowedOrigin(origin)) {
    callback(null, true);
  } else {
    callback(new Error("Not allowed by CORS"));
  }
};
