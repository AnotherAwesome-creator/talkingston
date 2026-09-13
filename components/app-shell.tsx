"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Gamepad2, Home, LogOut, Menu, Settings, Users, FolderKanban, X } from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui";

const nav = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/games", label: "Games", icon: Gamepad2 },
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children, userName = "there" }: { children: React.ReactNode; userName?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };
  return <div className="shell-grid min-h-screen lg:flex">
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-white/10 bg-[#0d0f16]/95 p-5 backdrop-blur-xl transition-transform lg:static lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="flex items-center justify-between"><Link href="/home" className="flex items-center gap-3" onClick={() => setOpen(false)}><Avatar size="sm" /><span className="font-semibold tracking-tight">Talkingston</span></Link><button className="rounded-lg p-2 text-slate-400 lg:hidden" onClick={() => setOpen(false)} aria-label="Close navigation"><X className="h-5 w-5" /></button></div>
      <p className="mt-10 px-3 text-xs font-semibold uppercase tracking-[.2em] text-slate-500">Your space</p>
      <nav className="mt-3 grid gap-1" aria-label="Primary navigation">{nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setOpen(false)} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${pathname === href ? "bg-indigo-500/15 text-indigo-200" : "text-slate-400 hover:bg-white/[.05] hover:text-white"}`}><Icon className="h-5 w-5" />{label}</Link>)}</nav>
      <div className="mt-auto rounded-2xl border border-indigo-400/20 bg-indigo-500/10 p-4"><Avatar size="sm" /><p className="mt-3 text-sm font-semibold">I&apos;m here with you.</p><p className="mt-1 text-xs leading-5 text-slate-400">A calm place to think, plan, and play.</p></div>
      <button onClick={logout} className="mt-4 flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-400 hover:bg-white/[.05] hover:text-white"><LogOut className="h-5 w-5" />Sign out</button>
    </aside>
    {open && <button className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setOpen(false)} aria-label="Close navigation overlay" />}
    <div className="min-w-0 flex-1"><header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-white/10 bg-[#090a0f]/75 px-4 backdrop-blur-xl sm:px-8"><button className="rounded-lg p-2 text-slate-300 lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu className="h-5 w-5" /></button><div className="hidden text-sm text-slate-400 sm:block">Good to see you, <span className="text-slate-100">{userName}</span></div><div className="ml-auto flex items-center gap-2"><button className="rounded-lg p-2 text-slate-400 hover:bg-white/[.06]" aria-label="Notifications"><Bell className="h-5 w-5" /></button><Link href="/settings"><Avatar name={userName} size="sm" /></Link></div></header><main className="mx-auto max-w-7xl px-4 py-6 pb-24 sm:px-8 lg:pb-10">{children}</main></div>
    <nav className="fixed inset-x-3 bottom-3 z-20 grid grid-cols-5 rounded-2xl border border-white/10 bg-[#11131a]/95 p-2 shadow-2xl backdrop-blur-xl lg:hidden" aria-label="Mobile navigation">{nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`grid justify-items-center gap-1 rounded-xl py-2 text-[10px] ${pathname === href ? "bg-indigo-500/20 text-indigo-200" : "text-slate-500"}`}><Icon className="h-4 w-4" />{label}</Link>)}</nav>
  </div>;
}
