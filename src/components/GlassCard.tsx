import type { HTMLAttributes } from "react";

type GlassCardProps = HTMLAttributes<HTMLElement> & {
  as?: "div" | "section" | "article" | "aside";
  tone?: "default" | "quiet";
};

/** Shared material; feature styles own placement, spacing and interaction. */
export function GlassCard({
  as: Tag = "div",
  tone = "default",
  className = "",
  ...props
}: GlassCardProps) {
  return (
    <Tag
      {...props}
      className={`glass-card ${tone === "quiet" ? "glass-card--quiet" : ""} ${className}`}
    />
  );
}
