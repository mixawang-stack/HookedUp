import { getSupabaseAdmin } from "./supabaseAdmin";

const readBearerToken = (request: Request) => {
  const header = request.headers.get("authorization") ?? "";
  const [type, token] = header.split(" ");
  if (type?.toLowerCase() !== "bearer" || !token) {
    return null;
  }
  return token;
};

export const requireUser = async (request: Request) => {
  const token = readBearerToken(request);
  if (!token) {
    throw new Error("UNAUTHORIZED");
  }
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    throw new Error("UNAUTHORIZED");
  }
  return { id: data.user.id, email: data.user.email ?? null };
};

export const requireAdminUser = async (request: Request) => {
  const user = await requireUser(request);
  if (user.email !== "admin@hookedup.me") {
    throw new Error("FORBIDDEN");
  }
  return user;
};
