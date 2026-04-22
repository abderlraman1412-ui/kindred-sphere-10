import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";

export const AdminBadge = ({ className, size = "sm" }: { className?: string; size?: "xs" | "sm" }) => {
  const sizes = {
    xs: "h-4 px-1.5 text-[9px] gap-0.5",
    sm: "h-5 px-2 text-[10px] gap-1",
  } as const;
  const icon = size === "xs" ? "h-2.5 w-2.5" : "h-3 w-3";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-gradient-to-r from-warning to-vip font-bold uppercase tracking-wide text-warning-foreground shadow-card",
        sizes[size],
        className,
      )}
      aria-label="Admin"
      title="Admin"
    >
      <Crown className={icon} fill="currentColor" />
      Admin
    </span>
  );
};
