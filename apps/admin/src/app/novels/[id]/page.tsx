"use client";

import { useParams } from "next/navigation";
import NovelEditor from "../NovelEditor";

export default function EditNovelPage() {
  const params = useParams();
  const novelId = typeof params?.id === "string" ? params.id : "";
  return <NovelEditor novelId={novelId} />;
}
