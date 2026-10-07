import { useModelPreferences } from "./useModelPreferences";

const effortLabels: Record<string, string> = {
  off: "关闭思考",
  low: "低",
  high: "高",
  max: "最高"
};

export function ModelPreferences() {
  const { preferences, draft, setDraft, loading, saving, error, message, refresh, save } =
    useModelPreferences();
  const models = preferences?.models ?? [];
  const selectedIndex = models.findIndex(
    (model) => model.id === draft?.model && model.provider === draft?.provider
  );
  const selected = models[selectedIndex];
  const effortAvailable =
    !draft?.reasoningEffort ||
    selected?.efforts.some((effort) => effort.id === draft.reasoningEffort);
  const disabled = loading || saving || !preferences?.writable;
  const dirty = JSON.stringify(draft) !== JSON.stringify(preferences?.selection);
  return (
    <section className="model-preferences" aria-label="DSH 默认模型设置">
      <div className="model-preferences-heading">
        <h4>模型与思考</h4>
        <button type="button" disabled={loading || saving} onClick={() => void refresh()}>
          重新读取
        </button>
      </div>
      <p className="model-preferences-hint">
        用于新对话与新建自动任务会话；已有会话保留自己的模型选择。
      </p>
      {loading ? <p role="status">正在读取 DSH 模型设置，首次启动需等待 DSH 就绪…</p> : null}
      {preferences && draft ? (
        <>
          <div className="automation-fields">
            <label>
              默认模型
              <select
                aria-label="默认模型"
                disabled={disabled || models.length === 0}
                value={selectedIndex < 0 ? "" : String(selectedIndex)}
                onChange={(event) => {
                  const model = models[Number(event.target.value)];
                  setDraft({ provider: model.provider, model: model.id });
                }}
              >
                {selectedIndex < 0 ? (
                  <option value="" disabled>
                    当前模型不在可用目录：{draft.model}
                  </option>
                ) : null}
                {models.map((model, index) => (
                  <option key={`${model.provider}/${model.id}`} value={index}>
                    {model.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              思考强度
              <select
                aria-label="思考强度"
                disabled={disabled || !selected || selected.efforts.length === 0}
                value={draft.reasoningEffort ?? ""}
                onChange={(event) => {
                  setDraft({
                    provider: draft.provider,
                    model: draft.model,
                    ...(event.target.value ? { reasoningEffort: event.target.value } : {})
                  });
                }}
              >
                <option value="">
                  {selected?.defaultEffort
                    ? `模型默认（${effortLabels[selected.defaultEffort] ?? selected.defaultEffort}）`
                    : "模型默认"}
                </option>
                {!effortAvailable ? (
                  <option value={draft.reasoningEffort} disabled>
                    当前强度不可用：{draft.reasoningEffort}
                  </option>
                ) : null}
                {selected?.efforts.map((effort) => (
                  <option key={effort.id} value={effort.id}>
                    {effortLabels[effort.id] ?? effort.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {selected && selected.efforts.length === 0 ? (
            <p className="model-preferences-hint">此模型未提供可调思考强度。</p>
          ) : null}
          {preferences.catalogIncomplete ? <p>部分模型目录暂时不可用，可重新读取。</p> : null}
          {!preferences.writable ? <p>当前 DSH 模型设置为只读。</p> : null}
          <footer>
            <span className="settings-save-state">
              {dirty ? "有未保存的更改" : "与 DSH 设置一致"}
            </span>
            <button
              className="automation-primary"
              type="button"
              disabled={disabled || !dirty || !selected || !effortAvailable}
              onClick={() => void save()}
            >
              {saving ? "正在保存…" : "保存模型设置"}
            </button>
          </footer>
        </>
      ) : null}
      {error ? (
        <p role="alert" className="automation-error">
          {error}
        </p>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}
