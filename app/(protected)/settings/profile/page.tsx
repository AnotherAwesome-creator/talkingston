import { ProfileForm } from "@/components/settings-forms";
import { createClient } from "@/lib/supabase/server";

export default async function ProfileSettingsPage() {
  let profile: { display_name?: string; username?: string; avatar_url?: string | null; bio?: string | null } | null = null;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const result = await supabase.from("profiles").select("display_name, username, avatar_url, bio").eq("id", user.id).maybeSingle();
      profile = result.data;
    }
  }
  return <div className="grid gap-6"><header><h1 className="text-3xl font-semibold">Profile</h1><p className="mt-2 text-muted">Keep your identity and avatar up to date.</p></header><ProfileForm initialName={profile?.display_name} initialUsername={profile?.username} initialAvatar={profile?.avatar_url ?? ""} initialBio={profile?.bio ?? ""} /></div>;
}
