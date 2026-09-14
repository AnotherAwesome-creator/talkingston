import Link from "next/link";
import { WhotLobby } from "@/components/whot";

export default function GamesPage() {
  return <div className="grid gap-6"><WhotLobby /><Link href="/trivia" className="text-sm text-cyan-300">Open Trivia</Link></div>;
}
