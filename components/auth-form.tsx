"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input } from "@/components/ui";

export function AuthForm({ mode }: { mode: "login" | "signup" | "recovery" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(""); setMessage(""); setLoading(true);
    try {
      const supabase = createClient();
      if (mode === "recovery") {
        const { error: result } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/login` });
        if (result) throw result;
        setMessage("Check your inbox for a secure password reset link.");
      } else if (mode === "login") {
        const { error: result } = await supabase.auth.signInWithPassword({ email, password });
        if (result) throw result;
        router.push("/home"); router.refresh();
      } else {
        const { data, error: result } = await supabase.auth.signUp({ email, password, options: { data: { display_name: name } } });
        if (result) throw result;
        if (data.session) router.push("/onboarding"); else setMessage("Account created. Check your inbox to confirm your email.");
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Something went wrong. Please try again."); } finally { setLoading(false); }
  };
  const title = mode === "login" ? "Welcome back" : mode === "signup" ? "Make room for better days" : "Reset your password";
  return <Card className="w-full max-w-md"><div className="mb-8"><p className="text-sm font-semibold text-indigo-300">TALKINGSTON</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">{title}</h1><p className="mt-2 text-sm text-muted">{mode === "login" ? "Your companion is ready when you are." : mode === "signup" ? "A thoughtful companion for your everyday life." : "We&apos;ll send a secure link to your email."}</p></div><form onSubmit={submit} className="grid gap-4">{mode === "signup" && <Input label="Preferred name" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />}{<Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />}{mode !== "recovery" && <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} />}{error && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}{message && <p role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-200">{message}</p>}<Button type="submit" loading={loading}>{mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}</Button></form><div className="mt-6 grid gap-2 text-center text-sm text-muted">{mode === "login" && <Link href="/forgot-password" className="text-indigo-300 hover:text-indigo-200">Forgot password?</Link>}{mode !== "login" && <Link href="/login" className="text-indigo-300 hover:text-indigo-200">Already have an account? Sign in</Link>}{mode === "login" && <Link href="/signup" className="text-indigo-300 hover:text-indigo-200">New here? Create an account</Link>}</div></Card>;
}
