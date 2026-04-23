import { cn } from "@/lib/utils";

export const OnlineDot = ({ online, className }: { online: boolean; className?: string }) => (
  <span
    aria-label={online ? "Online" : "Offline"}
    className={cn(
      "inline-block h-2.5 w-2.5 rounded-full ring-2 ring-surface transition-colors",
      online ? "bg-success" : "bg-muted-foreground/40",
      className,
    )}
  />
);
