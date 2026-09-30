import { useEffect, useRef, useState } from "react";
import {
  getModelPreferences,
  saveModelPreferences,
  type ModelPreferences,
  type ModelSelection
} from "../../../api/model-preferences";

export function useModelPreferences() {
  const [preferences, setPreferences] = useState<ModelPreferences>();
  const [draft, setDraft] = useState<ModelSelection>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const request = useRef<AbortController>();
  const mounted = useRef(false);

  async function refresh() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const next = await getModelPreferences(controller.signal);
      if (controller.signal.aborted) return;
      setPreferences(next);
      setDraft(next.selection);
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(cause instanceof Error ? cause.message : "无法读取模型设置。");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }
  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
      request.current?.abort();
    };
  }, []);

  async function save() {
    if (!draft || !preferences) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const next = await saveModelPreferences(draft, preferences.revision);
      if (!mounted.current) return;
      setPreferences(next);
      setDraft(next.selection);
      setMessage("默认模型已保存，新对话与新建自动任务会话将使用此设置。");
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "模型设置保存失败。");
    } finally {
      if (mounted.current) setSaving(false);
    }
  }
  return { preferences, draft, setDraft, loading, saving, error, message, refresh, save };
}
