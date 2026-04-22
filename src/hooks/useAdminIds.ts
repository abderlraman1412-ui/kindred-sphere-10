import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns a Set of user IDs (from the provided list) that have the "admin" role.
 * Safe with RLS: admins can see all roles; regular users only see their own,
 * so non-admin viewers will simply not see admin badges for others — that's fine.
 *
 * To make admin badges visible to everyone, we expose admin status via the
 * separate `has_role` security-definer function call per user when needed.
 */
export const useAdminIds = (userIds: string[]) => {
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (userIds.length === 0) {
      setAdminIds(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      const unique = Array.from(new Set(userIds));
      const { data } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", unique)
        .eq("role", "admin");
      if (cancelled) return;
      setAdminIds(new Set((data ?? []).map((r) => r.user_id)));
    })();
    return () => {
      cancelled = true;
    };
  }, [userIds.join(",")]);

  return adminIds;
};
