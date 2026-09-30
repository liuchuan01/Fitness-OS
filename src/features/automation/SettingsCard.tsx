import type { ReactNode } from "react";
import { GlassCard } from "../../components/GlassCard";

export function SettingsCard({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <GlassCard as="section" className="settings-card" aria-label={title}>
      <div className="settings-card-heading">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <div className="settings-card-content">{children}</div>
    </GlassCard>
  );
}
