import { Users } from "lucide-react";
import { StateCard } from "@/components/ui";
export default function FriendsPage() { return <div className="grid gap-6"><header><p className="text-sm font-semibold text-emerald-300">CONNECTIONS</p><h1 className="mt-2 text-3xl font-semibold">Friends</h1><p className="mt-2 text-muted">Your people will have a welcoming place here.</p></header><StateCard title="Social features are paused" description="Friends and messaging are intentionally outside Pass 1 scope." action={<Users className="mx-auto h-10 w-10 text-emerald-300/60" />} /></div>; }
