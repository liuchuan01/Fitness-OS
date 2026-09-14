import { Settings2, CalendarDays } from "lucide-react";
import { IconButton } from "../components/IconButton";
import { formatDisplayDate } from "./view-helpers";

type HeaderProps = {
  mode: string;
  date?: string;
  timelineOpen: boolean;
  onOverview: () => void;
  onTimelineToggle: () => void;
};

export function DashboardHeader({
  mode,
  date,
  timelineOpen,
  onOverview,
  onTimelineToggle
}: HeaderProps) {
  return (
    <header className="top-bar">
      <button className="brand" onClick={onOverview} type="button">
        <span className="brand-mark">AF</span>
        <span>AI Fitness OS</span>
      </button>
      <div className="mode-indicator">
        <span>{mode}</span>
        <strong>{formatDisplayDate(date)}</strong>
      </div>
      <div className="top-actions">
        <IconButton
          label="配置后台"
          icon={Settings2}
          onClick={() => {
            window.location.hash = "/settings";
          }}
        />
        <IconButton
          label="训练记录"
          icon={CalendarDays}
          aria-expanded={timelineOpen}
          className="top-action"
          onClick={onTimelineToggle}
        />
      </div>
    </header>
  );
}
