import { useAuth } from "@/contexts/AuthContext";
import { PostFeed } from "@/components/PostFeed";
import { TierBadge } from "@/components/TierBadge";

const Index = () => {
  const { profile } = useAuth();
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border bg-gradient-to-br from-primary to-primary-hover p-5 text-primary-foreground shadow-elevated">
        <p className="text-xs uppercase tracking-wider opacity-80">Welcome back</p>
        <h1 className="mt-1 text-2xl font-bold">{profile?.name}</h1>
        <div className="mt-2 flex items-center gap-2 text-sm opacity-90">
          <span>Your tier:</span>
          {profile && <TierBadge tier={profile.tier} />}
        </div>
      </section>
      <PostFeed />
    </div>
  );
};

export default Index;
