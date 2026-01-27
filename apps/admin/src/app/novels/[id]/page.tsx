"use client";

import { useParams } from "next/navigation";
import NovelEditor from "../NovelEditor";

export default function EditNovelPage() {
  const params = useParams() as { id?: string };
  const novelId = params?.id;

  return <NovelEditor novelId={novelId} />;
}
