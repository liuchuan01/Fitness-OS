import { GlassCard } from "../../components/GlassCard";
import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

type HudCardProps = {
  anchored?: boolean;
  position: string;
  label: string;
  detail: ReactNode;
  children: ReactNode;
};
export function HudCard({ anchored = false, position, label, detail, children }: HudCardProps) {
  const [expanded, setExpanded] = useState(false);
  const detailId = useId();
  const summaryRef = useRef<HTMLButtonElement>(null);
  const [summaryHeight, setSummaryHeight] = useState(0);
  useLayoutEffect(() => {
    if (!anchored || !summaryRef.current) return;
    const summary = summaryRef.current;
    const measure = () => setSummaryHeight(summary.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(summary);
    return () => observer.disconnect();
  }, [anchored]);
  return (
    <GlassCard
      as="section"
      tone="quiet"
      className={`body-hud-card hud-${position}`}
      style={anchored ? { "--hud-summary-height": `${summaryHeight}px` } as CSSProperties : undefined}
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
        ref={summaryRef}
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
      {anchored ? (
        <GlassCard className="body-hud-surface" tone="quiet" data-expanded={expanded} hidden={!expanded}>
          <div id={detailId} className="body-hud-detail">{detail}</div>
        </GlassCard>
      ) : (
        <div id={detailId} className="body-hud-detail" hidden={!expanded}>{detail}</div>
      )}
    </GlassCard>
  );
}
