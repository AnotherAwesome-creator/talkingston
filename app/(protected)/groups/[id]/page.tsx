import { GroupView } from "@/components/social";
export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) { return <GroupView groupId={(await params).id} />; }
