"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";

export function Button({ children, loading, variant = "primary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  return <button {...props} disabled={props.disabled || loading} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55 ${variant === "primary" ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-400" : variant === "danger" ? "bg-red-500/15 text-red-200 hover:bg-red-500/25" : variant === "secondary" ? "border border-white/10 bg-white/[.06] text-slate-100 hover:bg-white/10" : "text-slate-300 hover:bg-white/[.06]"} ${className}`}>{loading && <Loader2 className="h-4 w-4 animate-spin" />}{children}</button>;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`glass rounded-2xl p-5 shadow-2xl shadow-black/10 ${className}`}>{children}</section>;
}

export function Input({ label, error, ...props }: InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  return <label className="grid gap-2 text-sm text-slate-300">{label}{props.required && <span className="sr-only">required</span>}<input {...props} className={`min-h-11 rounded-xl border bg-white/[.04] px-3 text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-indigo-400 ${error ? "border-red-400/70" : "border-white/10"} ${props.className ?? ""}`} />{error && <span className="text-xs text-red-300" role="alert">{error}</span>}</label>;
}

export function Avatar({ name = "Talkingston", src, size = "md" }: { name?: string; src?: string | null; size?: "sm" | "md" | "lg" }) {
  const initials = name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  return src ? <Image src={src} alt="" width={size === "lg" ? 80 : size === "sm" ? 32 : 44} height={size === "lg" ? 80 : size === "sm" ? 32 : 44} unoptimized className={`rounded-full object-cover ${size === "lg" ? "h-20 w-20" : size === "sm" ? "h-8 w-8" : "h-11 w-11"}`} /> : <span aria-hidden="true" className={`grid place-items-center rounded-full bg-gradient-to-br from-indigo-400 to-pink-400 font-bold text-white ${size === "lg" ? "h-20 w-20 text-2xl" : size === "sm" ? "h-8 w-8 text-xs" : "h-11 w-11 text-sm"}`}>{initials}</span>;
}

export function StateCard({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <Card className="text-center"><div className="mx-auto mb-3 h-2 w-16 rounded-full bg-gradient-to-r from-indigo-400 to-pink-400" /><h2 className="text-lg font-semibold">{title}</h2><p className="mt-1 text-sm text-muted">{description}</p>{action && <div className="mt-5">{action}</div>}</Card>;
}
