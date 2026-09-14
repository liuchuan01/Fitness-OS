import { useMemo } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { IconButton } from "../../components/IconButton";
import type { CSSProperties } from "react";
import type { TimelineWorkout } from "../../api/client";

type TimelineGroup = TimelineWorkout["group"];

type WorkoutTimelineProps = {
  currentDate?: string;
  isOpen: boolean;
  onDateSelect: (date: string) => void;
  onOpenChange: (isOpen: boolean) => void;
  onSearchChange: (search: string) => void;
  search: string;
  selectedDate: string | null;
  workouts: TimelineWorkout[];
};

const timelineGroups: TimelineGroup[] = ["today", "yesterday", "this_week", "earlier"];

const groupLabels: Record<TimelineGroup, string> = {
  today: "今天",
  yesterday: "昨天",
  this_week: "本周",
  earlier: "更早"
};

export function WorkoutTimeline({
  currentDate,
  isOpen,
  onDateSelect,
  onOpenChange,
  onSearchChange,
  search,
  selectedDate,
  workouts
}: WorkoutTimelineProps) {
  const groupedWorkouts = useMemo(
    () =>
      timelineGroups
        .map((group) => ({
          group,
          workouts: workouts.filter((workout) => workout.group === group)
        }))
        .filter(({ workouts: groupWorkouts }) => groupWorkouts.length > 0),
    [workouts]
  );
  const hasCurrentDateWorkout = workouts.some((workout) => workout.date === currentDate);

  return (
    <aside className="timeline" aria-label="Workout timeline">
      {!isOpen && (
        <IconButton
          aria-expanded={false}
          aria-controls="training-history"
          label="展开训练时间线"
          icon={PanelLeftOpen}
          className="rail-toggle"
          onClick={() => onOpenChange(true)}
        />
      )}

      {isOpen ? (
        <div className="timeline-expanded" id="training-history">
          <div className="timeline-heading">
            <div>
              <p className="eyebrow">Training history</p>
              <h1>训练时间线</h1>
            </div>
            <IconButton
              aria-expanded={true}
              aria-controls="training-history"
              label="收起训练时间线"
              icon={PanelLeftClose}
              className="timeline-close"
              onClick={() => onOpenChange(false)}
            />
          </div>
          <label className="search-field">
            <span>搜索训练</span>
            <input
              aria-label="Search workouts"
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="动作、标题或日期"
              type="search"
              value={search}
            />
          </label>
          {!hasCurrentDateWorkout && currentDate ? (
            <button
              aria-current={selectedDate === currentDate ? "date" : undefined}
              className={`timeline-entry today-entry ${selectedDate === currentDate ? "active" : ""}`}
              onClick={() => onDateSelect(currentDate)}
              type="button"
            >
              <span>
                <strong>今天</strong>
                <small>{currentDate}</small>
              </span>
            </button>
          ) : null}
          {groupedWorkouts.length === 0 && search ? (
            <p className="empty-copy">没有匹配“{search}”的训练。</p>
          ) : (
            groupedWorkouts.map(({ group, workouts: groupWorkouts }) => (
              <section className="timeline-group" key={group}>
                <h2>{groupLabels[group]}</h2>
                <ol>
                  {groupWorkouts.map((workout) => (
                    <li key={workout.id}>
                      <button
                        aria-current={selectedDate === workout.date ? "date" : undefined}
                        className={`timeline-entry ${selectedDate === workout.date ? "active" : ""}`}
                        onClick={() => onDateSelect(workout.date)}
                        type="button"
                      >
                        <span>
                          <strong>{workout.title}</strong>
                          <small>{workout.date}</small>
                        </span>
                        <i
                          aria-label={`Intensity ${workout.intensity}`}
                          className="intensity-bar"
                          style={{ "--intensity": workout.intensity / 100 } as CSSProperties}
                        />
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
            ))
          )}
        </div>
      ) : (
        <ol className="rail-dates" id="training-history">
          {workouts.slice(0, 7).map((workout) => (
            <li key={workout.id}>
              <button
                aria-label={`${workout.date} ${workout.title}`}
                aria-current={selectedDate === workout.date ? "date" : undefined}
                className={selectedDate === workout.date ? "active" : ""}
                onClick={() => onDateSelect(workout.date)}
                type="button"
              >
                <span>{workout.date.slice(8)}</span>
                <i
                  className="rail-intensity"
                  style={{ opacity: Math.max(0.24, workout.intensity / 100) }}
                />
              </button>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
