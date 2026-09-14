import { PublicProfileView } from "@/components/social";

export default async function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  return <PublicProfileView userId={(await params).id} />;
}
