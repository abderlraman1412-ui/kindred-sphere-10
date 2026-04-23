import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Tracks online users via a global Supabase Realtime presence channel.
 * Returns a Set of online user ids.
 */
export const usePresence = () => {
  const { user } = useAuth();
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel("presence:global", {
      config: { presence: { key: user.id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, unknown[]>;
        setOnlineIds(new Set(Object.keys(state)));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user_id: user.id, online_at: new Date().toISOString() });
        }
      });

    // Update last_seen on unload
    const updateLastSeen = () => {
      void supabase.from("profiles").update({ last_seen: new Date().toISOString() }).eq("id", user.id);
    };
    window.addEventListener("beforeunload", updateLastSeen);

    return () => {
      updateLastSeen();
      window.removeEventListener("beforeunload", updateLastSeen);
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return onlineIds;
};
