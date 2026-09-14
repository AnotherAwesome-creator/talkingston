import Link from "next/link";
import { PrivacySettings } from "@/components/privacy-settings";

export default function PrivacySettingsPage() {
  return <div className="grid gap-6"><Link href="/settings" className="text-sm text-indigo-300 hover:text-indigo-200">← Back to settings</Link><header><h1 className="text-3xl font-semibold">Privacy & notifications</h1><p className="mt-2 text-muted">Control profile visibility and the in-app updates you receive.</p></header><PrivacySettings /></div>;
}
