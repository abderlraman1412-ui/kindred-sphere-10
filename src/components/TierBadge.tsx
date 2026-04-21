import { AccountTier } from "@/contexts/AuthContext";
import { Crown, Star, Zap, Circle } from "lucide-react";

const config: Record<AccountTier, { label: string; cls: string; Icon: any }> = {
  vip:     { label: "VIP",     cls: "bg-tier-vip/15 text-tier-vip border-tier-vip/30",       Icon: Crown },
  pro:     { label: "Pro",     cls: "bg-tier-pro/15 text-tier-pro border-tier-pro/30",       Icon: Zap },
  premium: { label: "Premium", cls: "bg-tier-premium/15 text-tier-premium border-tier-premium/30", Icon: Star },
  normal:  { label: "Normal",  cls: "bg-muted text-muted-foreground border-border",          Icon: Circle },
};

export const TierBadge = ({ tier, size = "sm" }: { tier: AccountTier; size?: "sm" | "xs" }) => {
  const { label, cls, Icon } = config[tier];
  const sz = size === "xs" ? "text-[10px] px-1.5 py-0 h-4" : "text-[11px] px-2 py-0.5";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border font-semibold ${sz} ${cls}`}>
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
};
