import NovelEditor from "../NovelEditor";

export const dynamic = "force-dynamic";

type Props = {
  params: { id: string };
};

export default function AdminNovelDetailPage({ params }: Props) {
  return <NovelEditor novelId={params.id} />;
}
