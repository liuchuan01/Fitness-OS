import { useEffect, useRef, useState } from "react";
import {
  getXparseCredentials,
  getXparseSettings,
  saveXparseCredentials,
  saveXparseSettings,
  type XparseCredentials,
  type XparseSettings
} from "../../../api/xparse";

export function useXparseSettings() {
  const [settings, setSettings] = useState<XparseSettings>();
  const [saved, setSaved] = useState<XparseSettings>();
  const [credentials, setCredentials] = useState<XparseCredentials>();
  const [appId, setAppId] = useState("");
  const [secretCode, setSecretCode] = useState("");
  const [error, setError] = useState("");
  const [credentialError, setCredentialError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [credentialBusy, setCredentialBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const controller = useRef<AbortController>();

  async function refresh() {
    controller.current?.abort();
    const next = new AbortController();
    controller.current = next;
    setLoading(true);
    setError("");
    setCredentialError("");
    const [config, auth] = await Promise.allSettled([
      getXparseSettings(next.signal),
      getXparseCredentials(next.signal)
    ]);
    if (next.signal.aborted) return;
    if (config.status === "fulfilled") {
      setSaved(config.value);
      setSettings((current) =>
        !current || JSON.stringify(current) === JSON.stringify(saved) ? config.value : current
      );
    } else setError("文件解析设置读取失败，请重新读取。");
    if (auth.status === "fulfilled") setCredentials(auth.value);
    else setCredentialError("TextIn 凭据状态暂不可用，可重新读取或填写后尝试保存。");
    setLoading(false);
  }
  useEffect(() => {
    void refresh();
    return () => controller.current?.abort();
  }, []);

  async function save() {
    if (!settings) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const value = await saveXparseSettings(settings);
      setSaved(value);
      setSettings(value);
      setMessage(
        value.enabled
          ? "文件解析已开启，从下一条对话起可用。"
          : "文件解析已关闭，已保存的凭据保留。"
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }
  async function saveCredentials(clear = false) {
    setCredentialBusy(true);
    setCredentialError("");
    setMessage("");
    try {
      setCredentials(await saveXparseCredentials(clear ? { clear: true } : { appId, secretCode }));
      setAppId("");
      setSecretCode("");
      setMessage(clear ? "TextIn 凭据已清除。" : "TextIn 凭据已保存，尚未验证云端连通性。");
    } catch (cause) {
      setCredentialError(cause instanceof Error ? cause.message : "凭据保存失败");
    } finally {
      setCredentialBusy(false);
    }
  }
  return {
    settings,
    setSettings,
    saved,
    credentials,
    appId,
    setAppId,
    secretCode,
    setSecretCode,
    error,
    credentialError,
    message,
    busy,
    credentialBusy,
    loading,
    refresh,
    save,
    saveCredentials
  };
}
