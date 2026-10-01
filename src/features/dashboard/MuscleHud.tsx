import type { MuscleHistory } from "../../../shared/fitness/muscle-history-schema";
import { formatRecordedSet } from "../muscles/format-recorded-set";
import { HudCard } from "./HudCard";
import "./overview-hud.css";

type MuscleHudProps = { history: MuscleHistory | null; status: "loading" | "ready" | "error" };

export function MuscleHud({ history, status }: MuscleHudProps) {
  const placeholder = status === "error" ? "暂不可用" : "读取中";
  const pending = (
    <p>
      {status === "error"
        ? "训练档案暂时不可用，可在右侧详情重新加载。"
        : "正在读取该肌肉的训练记录…"}
    </p>
  );
  const latest = history?.history[0];
  const weekly =
    history?.history.filter(
      (entry) => entry.date >= history.windowStart && entry.date <= history.asOf
    ) ?? [];
  return (
    <>
      <HudCard
        anchored
        position="recovery"
        label="最近涉及训练"
        detail={
          history ? (
            <>
              <span className="hud-kicker">最近主练 · {history.lastPrimaryDate ?? "暂无记录"}</span>
              <p className="hud-record-title">{latest?.title ?? "截至这一天暂无关联力量训练"}</p>
              {latest?.exercises.map((exercise) => (
                <div className="hud-fact-row" key={exercise.viewId}>
                  <span>{exercise.name}</span>
                  <b>
                    {exercise.relation === "primary" ? "主练" : "参与"} · {exercise.sets.length} 组
                  </b>
                </div>
              ))}
              <p className="hud-footnote">截至 {history.asOf} 的真实记录，不代表恢复程度。</p>
            </>
          ) : (
            pending
          )
        }
      >
        <strong className="hud-date">
          {history ? (history.lastTrainedDate?.replace(/-/g, ".") ?? "暂无记录") : placeholder}
        </strong>
      </HudCard>
      <HudCard
        anchored
        position="load"
        label="近 7 日训练"
        detail={
          history ? (
            <>
              <span className="hud-kicker">
                {history.windowStart} — {history.asOf}
              </span>
              <ol className="hud-records">
                {weekly.map((entry) => (
                  <li key={entry.workoutId}>
                    <time dateTime={entry.date}>{entry.date.slice(5).replace("-", ".")}</time>
                    <span>
                      {entry.title}
                      <br />
                      {entry.exercises
                        .map((exercise) => `${exercise.name} · ${exercise.sets.length} 组`)
                        .join("；")}
                    </span>
                  </li>
                ))}
              </ol>
              {!weekly.length && <p>这 7 天没有关联记录；更早的训练仍可在“最近涉及训练”查看。</p>}
              <p className="hud-footnote">同一次训练涉及多个关联动作，也只计 1 次。</p>
            </>
          ) : (
            pending
          )
        }
      >
        <strong>
          {history?.weekly.sessions ?? "—"}
          <small>次</small>
        </strong>
      </HudCard>
      <HudCard
        anchored
        position="volume"
        label="主练 / 参与"
        detail={
          history ? (
            <>
              <span className="hud-kicker">近 7 日 · 按动作映射归类</span>
              {weekly.flatMap((entry) =>
                entry.exercises.map((exercise) => (
                  <div className="hud-fact-row" key={`${entry.workoutId}:${exercise.viewId}`}>
                    <span>
                      {entry.date.slice(5)} · {exercise.name}
                    </span>
                    <b>
                      {exercise.relation === "primary" ? "主练" : "参与"} · {exercise.sets.length}{" "}
                      组
                    </b>
                  </div>
                ))
              )}
              {!weekly.length && <p>这 7 天暂无可拆分的关联记录组。</p>}
              <p className="hud-footnote">已排除明确热身组，不等于有效组或实际刺激效果。</p>
              {history.weekly.unclassifiedSets > 0 && (
                <p className="hud-footnote">
                  {history.weekly.unclassifiedSets} 组未标记热身／工作类型，暂按记录计数。
                </p>
              )}
            </>
          ) : (
            pending
          )
        }
      >
        <strong>
          {history?.weekly.primarySets ?? "—"}
          <em>/</em>
          {history?.weekly.secondarySets ?? "—"}
          <small>组</small>
        </strong>
      </HudCard>
      <HudCard
        anchored
        position="stimulus"
        label="上次怎么练"
        detail={
          history ? (
            <>
              <span className="hud-kicker">
                {latest ? `${latest.date} · ${latest.title}` : "暂无关联动作记录"}
              </span>
              {latest?.exercises.map((exercise) => (
                <div key={exercise.viewId}>
                  <p className="hud-record-title">
                    {exercise.name} · {exercise.relation === "primary" ? "主练" : "参与"}
                  </p>
                  <ol className="muscle-set-list">
                    {exercise.sets.map((set, index) => (
                      <li key={index}>{formatRecordedSet(set)}</li>
                    ))}
                  </ol>
                </div>
              ))}
              {!latest && <p>记录训练后，这里会展示每组重量、次数／时长与已填写的 RPE。</p>}
            </>
          ) : (
            pending
          )
        }
      >
        <strong className="hud-action-name">
          {history ? (latest?.exercises[0]?.name ?? "尚无关联动作") : placeholder}
        </strong>
      </HudCard>
    </>
  );
}
