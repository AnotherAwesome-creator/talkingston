import { Gamepad2 } from "lucide-react";
import { StateCard } from "@/components/ui";
export default function GamesPage() { return <div className="grid gap-6"><header><p className="text-sm font-semibold text-pink-300">PLAYGROUND</p><h1 className="mt-2 text-3xl font-semibold">Games</h1><p className="mt-2 text-muted">A playful space for future matches and challenges.</p></header><StateCard title="Games are taking a breather" description="Whot and Trivia are intentionally not enabled in Pass 1." action={<Gamepad2 className="mx-auto h-10 w-10 text-pink-300/60" />} /></div>; }
