import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../_lib/supabaseAdmin";
import { requireAdminUser } from "../../_lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAdminUser(request);
    const supabase = getSupabaseAdmin();
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
    const pageSize = Math.max(
      1,
      Math.min(100, Number(url.searchParams.get("pageSize") ?? "20"))
    );
    const search = (url.searchParams.get("search") ?? "").trim();
    const country = (url.searchParams.get("country") ?? "").trim();
    const gender = (url.searchParams.get("gender") ?? "").trim();
    const status = (url.searchParams.get("status") ?? "").trim();

    const rangeFrom = (page - 1) * pageSize;
    const rangeTo = rangeFrom + pageSize - 1;

    let query = supabase
      .from("User")
      .select(
        "id,email,maskName,maskAvatarUrl,country,gender,dob,createdAt,updatedAt,status",
        { count: "exact" }
      )
      .order("createdAt", { ascending: false })
      .range(rangeFrom, rangeTo);

    if (search) {
      query = query.or(`email.ilike.%${search}%,maskName.ilike.%${search}%`);
    }
    if (country) {
      query = query.eq("country", country);
    }
    if (gender) {
      query = query.eq("gender", gender);
    }
    if (status) {
      query = query.eq("status", status);
    }

    const { data, error, count } = await query;
    if (error) {
      return NextResponse.json({ error: "FAILED_TO_LOAD" }, { status: 500 });
    }
    return NextResponse.json({ data: data ?? [], count: count ?? 0 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status =
      message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
