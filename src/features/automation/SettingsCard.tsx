import { useState, type ReactNode } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";

export function SettingsCard({
  title,
  eyebrow,
  description,
  icon: Icon,
  defaultOpen = false,
  children
}: {
  title: string;
  eyebrow: string;
  description: string;
  icon: LucideIcon;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [initialOpen] = useState(defaultOpen);
  return (
    <details className="settings-card glass-card" open={initialOpen}>
      <summary>
        <span className="settings-card-icon">
          <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <span className="settings-card-heading">
          <span className="settings-eyebrow">{eyebrow}</span>
          <h3>{title}</h3>
          <span className="settings-card-description">{description}</span>
        </span>
        <ChevronDown className="settings-chevron" size={18} aria-hidden="true" />
      </summary>
      <section className="settings-card-content" aria-label={title}>
        {children}
      </section>
    </details>
  );
}
