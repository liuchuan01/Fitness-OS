import { GlassCard } from "../../components/GlassCard";
import { IconButton } from "../../components/IconButton";
import { X, ArrowUpRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getDshWeb, getModelSettings } from "../../api/client";
import {
  sessionHistoryEventSchema,
  type SessionHistoryState
} from "../../api/session-history-schemas";
import { SessionHistory } from "./SessionHistory";

export function AgentChat({ openRequest = 0 }: { openRequest?: number }) {
  const handledOpenRequest = useRef(0);
  const wasOpen = useRef(false);
  const [running, setRunning] = useState(false);
  const [open, setOpen] = useState(false);
  const [hostUrl, setHostUrl] = useState("");
  const [surfaceReady, setSurfaceReady] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [needsKey, setNeedsKey] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [history, setHistory] = useState<SessionHistoryState>();

  useEffect(() => {
    if (!hostUrl) return;
    const expectedOrigin = new URL(hostUrl).origin;
    const receive = (event: MessageEvent<unknown>) => {
      if (event.origin !== expectedOrigin || event.source !== frameRef.current?.contentWindow)
        return;
      const historyEvent = sessionHistoryEventSchema.safeParse(event.data);
      if (historyEvent.success) {
        setHistory(historyEvent.data);
        return;
      }
      if (
        typeof event.data === "object" &&
        event.data !== null &&
        "v" in event.data &&
        event.data.v === 1 &&
        "type" in event.data &&
        event.data.type === "fitness.surface.ready"
      ) {
        setSurfaceReady(true);
        setError("");
        return;
      }
      if (
        typeof event.data === "object" &&
        event.data !== null &&
        "v" in event.data &&
        event.data.v === 1 &&
        "type" in event.data &&
        event.data.type === "fitness.surface.collapse"
      ) {
        collapse();
        return;
      }
      if (!isFitnessAgentBridgeEvent(event.data)) return;
      setRunning(event.data.state === "running");
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [hostUrl]);

  useEffect(() => {
    if (!hostUrl || surfaceReady) return;
    const connect = () =>
      frameRef.current?.contentWindow?.postMessage(
        { v: 1, type: "fitness.surface.connect" },
        new URL(hostUrl).origin
      );
    connect();
    const handshake = window.setInterval(connect, 500);
    const timeout = window.setTimeout(() => {
      window.clearInterval(handshake);
      setError("训练 Agent 页面连接超时，请重新连接。");
    }, 30_000);
    return () => {
      window.clearInterval(handshake);
      window.clearTimeout(timeout);
    };
  }, [hostUrl, surfaceReady]);

  useEffect(() => {
    if (!open && wasOpen.current) launcherRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  async function expand(reconnect = false) {
    if (loading) return;
    if (reconnect) {
      setHostUrl("");
      setSurfaceReady(false);
    }
    setLoading(true);
    setError("");
    try {
      const settings = await getModelSettings();
      if (!settings.configured) {
        setNeedsKey(true);
        return;
      }
      setNeedsKey(false);
      setOpen(true);
      if (hostUrl && !reconnect) return;
      for (let attempt = 0; attempt < 30; attempt += 1) {
        const host = await getDshWeb();
        if (host.status === "ready") {
          setHostUrl(host.url);
          return;
        }
        if (host.status === "failed") throw new Error(host.error);
        await new Promise((resolve) => window.setTimeout(resolve, 500));
      }
      throw new Error("DSH Web 启动超时，请检查本地服务日志。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "DSH Web 暂时不可用。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (openRequest <= handledOpenRequest.current) return;
    handledOpenRequest.current = openRequest;
    void expand();
  });

  function collapse() {
    setOpen(false);
    setHistory(undefined);
  }

  function historyCommand(type: "close" | "refresh" | "select", id?: string) {
    if (!hostUrl) return;
    frameRef.current?.contentWindow?.postMessage(
      { v: 1, type: `fitness.history.${type}`, ...(id ? { id } : {}) },
      new URL(hostUrl).origin
    );
    if (type === "close") {
      setHistory(undefined);
      frameRef.current?.focus();
    }
  }

  return (
    <>
      {open && history?.open ? (
        <SessionHistory
          state={history}
          onClose={() => historyCommand("close")}
          onRefresh={() => historyCommand("refresh")}
          onSelect={(id) => historyCommand("select", id)}
        />
      ) : null}
      {!open ? (
        <button
          ref={launcherRef}
          className="agent-chat-launcher glass-card"
          disabled={loading}
          onClick={() => void expand()}
          type="button"
        >
          <span>
            {loading ? "正在检查模型配置…" : running ? "训练 Agent 正在处理…" : "和训练 Agent 对话"}
          </span>
          <strong>
            <ArrowUpRight size={18} strokeWidth={1.75} aria-hidden="true" />
          </strong>
        </button>
      ) : null}
      {!open && (needsKey || error) ? (
        <GlassCard className="agent-config-notice" role="alert">
          <span>
            {needsKey ? "尚未配置模型密钥，请先前往配置后台填写 DeepSeek API Key。" : error}
          </span>
          <a href="#/settings?section=connection">前往配置后台</a>
          <IconButton
            label="关闭配置提示"
            icon={X}
            onClick={() => {
              setNeedsKey(false);
              setError("");
            }}
          />
        </GlassCard>
      ) : null}
      {open || hostUrl ? (
        <section hidden={!open} className="agent-chat-layer" aria-label="训练 Agent 对话">
          {!surfaceReady ? (
            <div className="agent-chat-controls" aria-label="训练 Agent 控制">
              {running ? (
                <span className="agent-run-state" role="status">
                  正在处理
                </span>
              ) : null}
              <button
                aria-label="收起 Agent 对话"
                onClick={collapse}
                title="收起对话"
                type="button"
              >
                收起
              </button>
            </div>
          ) : null}
          <div className="agent-chat-host">
            {hostUrl ? (
              <iframe
                style={{ visibility: surfaceReady ? "visible" : "hidden" }}
                allow="clipboard-read; clipboard-write"
                ref={frameRef}
                src={hostUrl}
                title="训练 Agent 会话"
              />
            ) : null}
            {!surfaceReady ? (
              <div className="agent-chat-host-state" role={error ? "alert" : "status"}>
                <i />
                <span>{error || "正在启动训练 Agent 会话…"}</span>
                {error ? (
                  <button onClick={() => void expand(true)} type="button">
                    重试
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </>
  );
}

type FitnessAgentBridgeEvent = {
  v: 1;
  type: "fitness.agent.run-state";
  sessionId: string;
  state: "idle" | "running";
  at: string;
};

function isFitnessAgentBridgeEvent(value: unknown): value is FitnessAgentBridgeEvent {
  if (typeof value !== "object" || value === null) return false;
  const event = value as Record<string, unknown>;
  return (
    event.v === 1 &&
    event.type === "fitness.agent.run-state" &&
    typeof event.sessionId === "string" &&
    (event.state === "idle" || event.state === "running") &&
    typeof event.at === "string"
  );
}
