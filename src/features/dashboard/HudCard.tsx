import { GlassCard } from "../../components/GlassCard";
import { useId, useState, type ReactNode } from "react";

type HudCardProps = {
  position: string;
  label: string;
  detail: ReactNode;
  children: ReactNode;
};
export function HudCard({ position, label, detail, children }: HudCardProps) {
  const [expanded, setExpanded] = useState(false);
  const detailId = useId();
  return (
    <GlassCard
      as="section"
      tone="quiet"
      className={`body-hud-card hud-${position}`}
      aria-label={label}
      data-expanded={expanded}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setExpanded(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setExpanded(false);
      }}
    >
      <button
        className="body-hud-summary"
        aria-label={`${label}详情`}
        aria-expanded={expanded}
        aria-controls={detailId}
        onClick={() => setExpanded((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setExpanded(false);
        }}
      >
        <div className="body-hud-heading">
          <span>{label}</span>
        </div>
        <div className="body-hud-value">{children}</div>
      </button>
      <div id={detailId} className="body-hud-detail" hidden={!expanded}>
        {detail}
      </div>
    </GlassCard>
  );
}
