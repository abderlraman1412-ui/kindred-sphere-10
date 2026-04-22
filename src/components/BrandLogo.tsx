import { useState } from "react";
import { Link } from "react-router-dom";
import { useBranding, SITE_NAME } from "@/contexts/BrandingContext";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  /** Wrap as a link to "/" */
  asLink?: boolean;
  /** Hide the text on small screens */
  hideTextOnMobile?: boolean;
  /** Visual size of the logo mark */
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Override visible name (for cases like "TAIPING MEDIA Admin") */
  nameOverride?: string;
}

const SIZES = {
  sm: { box: "h-8 w-8", text: "text-base", letter: "text-sm" },
  md: { box: "h-9 w-9", text: "text-lg", letter: "text-lg" },
  lg: { box: "h-12 w-12", text: "text-2xl", letter: "text-2xl" },
} as const;

export const BrandLogo = ({
  asLink = true,
  hideTextOnMobile = false,
  size = "md",
  className,
  nameOverride,
}: BrandLogoProps) => {
  const { logoUrl } = useBranding();
  const [errored, setErrored] = useState(false);
  const s = SIZES[size];
  const showImage = logoUrl && !errored;
  const name = nameOverride ?? SITE_NAME;

  const inner = (
    <span className={cn("flex items-center gap-2.5 transition-opacity hover:opacity-90", className)}>
      <span
        className={cn(
          "flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary text-primary-foreground shadow-card",
          s.box,
        )}
      >
        {showImage ? (
          <img
            src={logoUrl!}
            alt={`${name} logo`}
            className="h-full w-full object-cover"
            onError={() => setErrored(true)}
          />
        ) : (
          <span className={cn("font-black", s.letter)}>T</span>
        )}
      </span>
      <span
        className={cn(
          "font-bold tracking-tight",
          s.text,
          hideTextOnMobile && "hidden sm:inline",
        )}
      >
        {name}
      </span>
    </span>
  );

  if (!asLink) return inner;
  return (
    <Link to="/" aria-label={`${name} home`} className="flex items-center">
      {inner}
    </Link>
  );
};
