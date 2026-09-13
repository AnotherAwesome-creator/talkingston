import { DirectMessageView } from "@/components/social";
export default async function MessagePage({ params }: { params: Promise<{ userId: string }> }) { return <DirectMessageView userId={(await params).userId} />; }
