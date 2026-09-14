import { WhotGame } from "@/components/whot";

export default async function WhotGamePage({ params }: { params: Promise<{ id: string }> }) {
  return <WhotGame roomId={(await params).id} />;
}
