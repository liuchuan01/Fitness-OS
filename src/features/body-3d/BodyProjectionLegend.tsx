type SelectionDetail = { id: string; label: string; coverage: string };
type BodyProjectionLegendProps = {
  exerciseTargets: boolean;
  selectedMuscle: boolean;
  region: boolean;
  projectionLabel?: string;
  loadColors: readonly string[];
  selectedDetails: SelectionDetail[];
  professionalMode: boolean;
};

/** Product semantics stay fixed; the load swatch uses the renderer's theme color scale. */
export function BodyProjectionLegend({
  exerciseTargets,
  selectedMuscle,
  region,
  projectionLabel,
  loadColors,
  selectedDetails,
  professionalMode
}: BodyProjectionLegendProps) {
  return (
    <div className="body-projection-label" aria-label="身体投影图例">
      <span className="body-projection-title">
        {exerciseTargets
          ? "动作涉及部位 · 非刺激评分"
          : selectedMuscle
            ? "肌肉焦点"
            : region
              ? "部位探索"
              : (projectionLabel ?? "训练负荷估算")}
      </span>
      <span className="body-projection-keys">
        {(selectedMuscle || region) && (
          <span>
            <i className="projection-swatch projection-focus" />
            当前焦点
          </span>
        )}
        {exerciseTargets ? (
          <>
            <span>
              <i className="projection-swatch projection-primary" />
              主练
            </span>
            <span>
              <i className="projection-swatch projection-secondary" />
              参与
            </span>
          </>
        ) : !selectedMuscle && !region ? (
          loadColors ? (
            <span>
              低刺激
              <i
                className="projection-swatch projection-continuous"
                style={{
                  background: `linear-gradient(90deg, ${loadColors.join(",")})`
                }}
              />
              高刺激
            </span>
          ) : (
            <>
              <span>
                <i className="projection-swatch projection-load" />
                低至高刺激
              </span>
              <span>
                <i className="projection-swatch projection-warning" />
                高负荷
              </span>
            </>
          )
        ) : null}
      </span>
      <div className="body-selection-context" aria-label="模型覆盖说明">
        {selectedDetails
          .filter((detail) => professionalMode || detail.coverage === "partial")
          .map((detail) => (
            <span key={detail.id}>
              {detail.label}
              {detail.coverage === "partial" ? " · 模型近似显示" : ""}
              {professionalMode ? ` · ${detail.id} · ${detail.coverage}` : ""}
            </span>
          ))}
      </div>
    </div>
  );
}
