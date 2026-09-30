import type { ReactNode } from "react";
import { GlassCard } from "../../components/GlassCard";

export function SettingsCard({
  title,
  mark,
  description,
  children
}: {
  title: string;
  mark?: ReactNode;
  description: string;
  children: ReactNode;
}) {
  return (
    <GlassCard as="section" className="settings-card" aria-label={title}>
      <div className="settings-card-heading">
        <h3>
          {mark}
          {title}
        </h3>
        <p>{description}</p>
      </div>
      <div className="settings-card-content">{children}</div>
    </GlassCard>
  );
}
