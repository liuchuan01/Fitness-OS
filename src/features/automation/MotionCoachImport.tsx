import { useState, type ChangeEvent } from "react";
import { importMotionCoachFile } from "../../api/motion-coach";

export function MotionCoachImport() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const result = await importMotionCoachFile(file);
      setMessage(`已导入 ${result.imported} 组，按记录编号跳过 ${result.skipped} 组重复记录。涉及 ${result.dates.length} 天。`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "导入失败，请检查文件后重试。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="motion-coach-import">
      <p>在 AI Motion Coach 的训练记录中选择“导出全部训练记录”，再在这里选择 JSON 文件。相同记录编号再次导入会自动跳过。</p>
      <p>仅保留已观察的次数、平板保持时长和俄罗斯转体每侧计数；未记录的重量与主观强度保持空白。</p>
      <label>
        选择训练记录文件
        <input
          accept=".json,application/json"
          aria-label="选择 AI Motion Coach 导出文件"
          disabled={busy}
          onChange={(event) => void handleFile(event)}
          type="file"
        />
      </label>
      {busy ? <p role="status">正在校验并导入…</p> : null}
      {message ? <p role="status" className="settings-feedback">{message}</p> : null}
      {error ? <p role="alert" className="automation-error">{error}</p> : null}
    </div>
  );
}
