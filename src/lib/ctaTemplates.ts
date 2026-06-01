export type CtaVariant =
  | "primary"
  | "gradient"
  | "outline"
  | "success"
  | "danger"
  | "dark"
  | "white"
  | "neon"
  | "custom";

export interface CtaTemplate {
  id: CtaVariant;
  name: string;
  /** Tailwind classes describing the look. Ignored when variant is "custom". */
  className: string;
  /** Preview swatch used in the picker. */
  previewClassName: string;
}

export const CTA_TEMPLATES: CtaTemplate[] = [
  {
    id: "primary",
    name: "أساسي",
    className: "bg-primary text-primary-foreground hover:bg-primary/90",
    previewClassName: "bg-primary text-primary-foreground",
  },
  {
    id: "gradient",
    name: "تدرّج",
    className:
      "bg-gradient-to-r from-primary via-vip to-warning text-primary-foreground hover:brightness-110",
    previewClassName: "bg-gradient-to-r from-primary via-vip to-warning text-primary-foreground",
  },
  {
    id: "outline",
    name: "حدّي",
    className: "border-2 border-primary bg-transparent text-primary hover:bg-primary/10",
    previewClassName: "border-2 border-primary bg-transparent text-primary",
  },
  {
    id: "success",
    name: "نجاح",
    className: "bg-success text-success-foreground hover:bg-success/90",
    previewClassName: "bg-success text-success-foreground",
  },
  {
    id: "danger",
    name: "تنبيه",
    className: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    previewClassName: "bg-destructive text-destructive-foreground",
  },
  {
    id: "dark",
    name: "داكن",
    className: "bg-foreground text-background hover:opacity-90",
    previewClassName: "bg-foreground text-background",
  },
  {
    id: "white",
    name: "أبيض",
    className: "bg-white text-black border border-black/10 hover:bg-white/90",
    previewClassName: "bg-white text-black border border-black/10",
  },
  {
    id: "neon",
    name: "نيون",
    className:
      "bg-black text-[#39ff14] border border-[#39ff14] shadow-[0_0_18px_rgba(57,255,20,0.55)] hover:brightness-110",
    previewClassName: "bg-black text-[#39ff14] border border-[#39ff14]",
  },
  {
    id: "custom",
    name: "مخصّص",
    className: "",
    previewClassName: "bg-gradient-to-br from-muted to-muted-foreground/20 text-foreground",
  },
];

export const getCtaTemplate = (variant?: string | null): CtaTemplate =>
  CTA_TEMPLATES.find((t) => t.id === variant) ?? CTA_TEMPLATES[0];

/** Returns inline style for the custom variant. */
export const getCtaCustomStyle = (
  bg?: string | null,
  fg?: string | null,
): React.CSSProperties | undefined => {
  if (!bg && !fg) return undefined;
  return {
    backgroundColor: bg || undefined,
    color: fg || undefined,
    border: bg ? "none" : undefined,
  };
};
