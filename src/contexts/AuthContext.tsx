import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AccountTier = "normal" | "premium" | "pro" | "vip";

export interface Profile {
  id: string;
  email: string | null;
  name: string;
  avatar_url: string | null;
  bio: string | null;
  tier: AccountTier;
  banned: boolean;
}

interface AuthCtx {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (uid: string) => {
    setLoading(true);
    const [{ data: p, error: profileError }, { data: roles, error: roleError }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);

    if (profileError) {
      console.error("Failed to load profile", profileError);
      setProfile(null);
    } else {
      setProfile((p as Profile) ?? null);
    }

    if (roleError) {
      console.error("Failed to load roles", roleError);
      setIsAdmin(false);
    } else {
      setIsAdmin(!!roles?.some((r: { role: string }) => r.role === "admin"));
    }

    setLoading(false);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);

      if (sess?.user) {
        setTimeout(() => {
          void loadProfile(sess.user.id);
        }, 0);
      } else {
        setProfile(null);
        setIsAdmin(false);
        setLoading(false);
      }
    });

    void supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        void loadProfile(sess.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const refreshProfile = async () => {
    if (user) await loadProfile(user.id);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setIsAdmin(false);
    setLoading(false);
  };

  return (
    <Ctx.Provider value={{ session, user, profile, isAdmin, loading, refreshProfile, signOut }}>
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
};
