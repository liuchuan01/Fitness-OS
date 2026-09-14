import type { ButtonHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import "./icon-button.css";

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label"> & {
  label: string;
  icon: LucideIcon;
};

export function IconButton({ label, icon: Icon, className = "", ...props }: IconButtonProps) {
  return (
    <button
      {...props}
      type="button"
      aria-label={label}
      title={label}
      className={`icon-button ${className}`}
    >
      <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}
