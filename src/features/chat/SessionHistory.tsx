import { useEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import type { SessionHistoryState } from "../../api/session-history-schemas";
import "./session-history.css";

type Props = {
  state: SessionHistoryState;
  onClose(): void;
  onSelect(id: string): void;
  onRefresh(): void;
};

export function SessionHistory({ state, onClose, onSelect, onRefresh }: Props) {
  const [scroll, setScroll] = useState({ top: 0, height: 500, width: 360 });
  const viewport = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const centered = useRef(false);
  const items = state.items;

  useEffect(() => {
    closeButton.current?.focus();
    const insights = document.querySelector<HTMLElement>(".insights");
    const previous = insights?.inert;
    if (insights) insights.inert = true;
    return () => {
      if (insights) insights.inert = previous ?? false;
    };
  }, []);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(() =>
      setScroll({
        top: element.scrollTop,
        height: element.clientHeight,
        width: element.clientWidth
      })
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!items.length || centered.current) return;
    centered.current = true;
    const index = Math.max(
      0,
      items.findIndex((item) => item.id === state.current)
    );
    viewport.current?.scrollTo({ top: index * 88, behavior: "instant" });
  }, [items, state.current]);

  const root = document.querySelector(".shell");
  if (!root) return null;
  return createPortal(
    <aside
      className="session-history glass-card"
      ref={panel}
      role="dialog"
      aria-label="历史对话"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
        if (event.key === "Tab") {
          const controls = [
            ...(panel.current?.querySelectorAll<HTMLElement>(
              'button:not(:disabled), input, [tabindex="0"]'
            ) ?? [])
          ];
          const first = controls[0],
            last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          }
          if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }
      }}
    >
      <header>
        <div>
          <span>SESSION ARCHIVE</span>
          <h2>历史对话</h2>
        </div>
        <button ref={closeButton} type="button" onClick={onClose} aria-label="关闭历史对话">
          ×
        </button>
      </header>
      <p className="session-history__intro">沿时间回看，继续上一次对话。</p>
      <div className="session-history__meta">
        <span>{items.length} 段对话</span>
        <button type="button" onClick={onRefresh} disabled={state.loading}>
          刷新
        </button>
      </div>
      {state.error ? (
        <p role="alert" className="session-history__error">
          {state.error}
        </p>
      ) : null}
      {state.loading ? <p role="status">正在读取历史对话…</p> : null}
      {!state.loading && !items.length ? (
        <p className="session-history__empty">还没有历史对话，开始聊聊你的训练吧。</p>
      ) : null}
      <div className="session-history__orbit">
        <svg
          className="session-history__arc"
          viewBox={`0 0 ${scroll.width || 1} ${scroll.height || 1}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d={`M 88 0 Q -56 ${scroll.height / 2} 88 ${scroll.height}`} />
        </svg>
        <div
          className="session-history__wheel"
          ref={viewport}
          onScroll={(event) =>
            flushSync(() =>
              setScroll({
                top: event.currentTarget.scrollTop,
                height: event.currentTarget.clientHeight,
                width: event.currentTarget.clientWidth
              })
            )
          }
        >
          <div className="session-history__rows" role="list" aria-label="历史会话记录">
            {items.map((item, index) => {
              const distance = (index * 88 - scroll.top) / Math.max(1, scroll.height / 2);
              // Same parabola as the SVG: x = 16 + 72 * (2y / height - 1)^2.
              const dotX = 16 + 72 * distance * distance;
              const date = new Date(item.updatedAt);
              return (
                <div role="listitem" className="session-history__row" key={item.id}>
                  <button
                    type="button"
                    className="session-history__record"
                    aria-current={item.id === state.current ? "true" : undefined}
                    style={{
                      transform: `translateX(${dotX}px)`,
                      opacity: 1 - Math.min(1, Math.abs(distance)) * 0.25
                    }}
                    onFocus={(event) => {
                      if (!event.currentTarget.matches(":focus-visible")) return;
                      viewport.current?.scrollTo({
                        top: index * 88,
                        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                          ? "instant"
                          : "smooth"
                      });
                    }}
                    onKeyDown={(event) => {
                      const next =
                        event.key === "ArrowDown"
                          ? index + 1
                          : event.key === "ArrowUp"
                            ? index - 1
                            : event.key === "Home"
                              ? 0
                              : event.key === "End"
                                ? items.length - 1
                                : undefined;
                      if (next !== undefined) {
                        event.preventDefault();
                        const buttons =
                          viewport.current?.querySelectorAll<HTMLButtonElement>("button");
                        buttons?.[Math.max(0, Math.min(items.length - 1, next))]?.focus();
                      }
                    }}
                    onClick={() => onSelect(item.id)}
                    title={item.title}
                  >
                    <i aria-hidden="true" />
                    <span>
                      <strong>{item.title}</strong>
                      <time dateTime={date.toISOString()}>
                        {date.toLocaleString("zh-CN", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false
                        })}
                      </time>
                      <small>
                        {item.running
                          ? "正在处理"
                          : item.id === state.current
                            ? "当前对话"
                            : "继续对话 ↗"}
                      </small>
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <footer>滚动浏览 · 点击继续 · Esc 关闭</footer>
    </aside>,
    root
  );
}
