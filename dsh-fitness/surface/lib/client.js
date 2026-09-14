/* global window, document, fetch, AbortController */

window.__ModuleLoader__.load({
  id: "@ai-fitness-os/dsh-fitness-surface",
  factory: (require) => {
    const module = { exports: {} };
    const React = require("react");
    const { createElement, useEffect, useRef, useState } = React;
    const ControlsContext = React.createContext(null);
    function HeaderControls() {
      return React.useContext(ControlsContext);
    }

    class FitnessLayout {
      #navigation = new AbortController();
      #panel = { activePanelId: null };
      #listeners = new Set();

      getSnapshot = () => this.#panel;
      subscribe = (listener) => {
        this.#listeners.add(listener);
        return () => this.#listeners.delete(listener);
      };

      selectPanel(panelId) {
        if (panelId !== null) throw new Error("Fitness only exposes the conversation panel");
        this.#navigation.abort();
        this.#panel = { activePanelId: null };
        for (const listener of this.#listeners) listener();
      }

      beginNavigation() {
        this.#navigation.abort();
        this.#navigation = new AbortController();
        return this.#navigation.signal;
      }

      toggleSidebar() {}
      openRightbar() {}
      closeRightbar() {}
      dispose() {
        this.#navigation.abort();
      }
    }

    function FitnessSurface({ renderSlot, useSessions, sessions, uiWorkspace }) {
      const [parentOrigin, setParentOrigin] = useState("");
      const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
      const [bootstrapError, setBootstrapError] = useState("");
      const bootstrapStarted = useRef(false);
      const historyButton = useRef(null);
      const [historyOpen, setHistoryOpen] = useState(false);
      const [historyLoading, setHistoryLoading] = useState(false);
      const [historyError, setHistoryError] = useState("");
      const list = useSessions((value) => value);
      const current = useSessions((sessions) => sessions.current);
      const phase = useSessions((sessions) => sessions.phase);
      const session = useSessions((sessions) =>
        sessions.current === undefined ? undefined : sessions.byId[sessions.current]
      );
      const running = session?.running === true;
      const collapse = () => {
        if (!parentOrigin) return;
        setHistoryOpen(false);
        window.parent.postMessage({ v: 1, type: "fitness.surface.collapse" }, parentOrigin);
      };
      const refreshHistory = async () => {
        setHistoryLoading(true);
        setHistoryError("");
        try {
          await sessions.refresh();
        } catch {
          setHistoryError("历史对话读取失败，请点击刷新重试。");
        } finally {
          setHistoryLoading(false);
        }
      };
      useEffect(() => {
        if (!parentOrigin) return;
        const items = list.ids
          .map((id) => list.byId[id])
          .filter((item) => item && !item.blank && item.origin !== "subagent")
          .map((item) => ({
            id: item.id,
            title: item.title || item.displayTitle || "未命名对话",
            updatedAt: item.updatedAt,
            running: item.running
          }))
          .sort((a, b) => b.updatedAt - a.updatedAt);
        window.parent.postMessage(
          {
            v: 1,
            type: "fitness.history.state",
            open: historyOpen,
            current: list.current,
            items: historyOpen ? items : [],
            loading: historyLoading,
            error: historyError
          },
          parentOrigin
        );
      }, [list, parentOrigin, historyOpen, historyLoading, historyError]);
      useEffect(() => {
        const receive = (event) => {
          if (
            !parentOrigin ||
            event.origin !== parentOrigin ||
            event.source !== window.parent ||
            event.data?.v !== 1
          )
            return;
          if (event.data.type === "fitness.history.close") {
            setHistoryOpen(false);
            historyButton.current?.focus();
          }
          if (event.data.type === "fitness.history.refresh") void refreshHistory();
          if (event.data.type === "fitness.history.select" && typeof event.data.id === "string") {
            const row = sessions.list.getSnapshot().byId[event.data.id];
            if (!row || row.blank || row.origin === "subagent") {
              setHistoryError("这段对话已不可用，请刷新后重试。");
              return;
            }
            try {
              sessions.open(row.id);
              setHistoryOpen(false);
              historyButton.current?.focus();
            } catch {
              setHistoryError("会话切换失败，请刷新后重试。");
            }
          }
        };
        window.addEventListener("message", receive);
        return () => window.removeEventListener("message", receive);
      }, [parentOrigin, sessions]);
      useEffect(() => {
        const measure = () => setViewportWidth(window.innerWidth);
        window.addEventListener("resize", measure);
        return () => window.removeEventListener("resize", measure);
      }, []);
      useEffect(() => {
        const elements = [
          document.documentElement,
          document.body,
          ...document.querySelectorAll('[class*="_boot_"]')
        ];
        const previous = elements.map((element) => element.getAttribute("style"));
        for (const element of elements) {
          element.style.setProperty("background", "transparent", "important");
        }
        return () => {
          elements.forEach((element, index) => {
            const value = previous[index];
            if (value === null) element.removeAttribute("style");
            else element.setAttribute("style", value);
          });
        };
      }, []);
      useEffect(() => {
        const connect = (event) => {
          if (window.parent === window || event.source !== window.parent) return;
          if (event.data?.v !== 1 || event.data?.type !== "fitness.surface.connect") return;
          if (!/^https?:\/\//u.test(event.origin)) return;
          setParentOrigin(event.origin);
        };
        window.addEventListener("message", connect);
        return () => window.removeEventListener("message", connect);
      }, []);
      useEffect(() => {
        if (phase !== "ready" || !parentOrigin) return;
        window.parent.postMessage({ v: 1, type: "fitness.surface.ready" }, parentOrigin);
      }, [phase, parentOrigin]);
      useEffect(() => {
        if (phase !== "ready" || bootstrapStarted.current) return;
        bootstrapStarted.current = true;
        const selected = sessions.list.getSnapshot();
        if (selected.current !== undefined && selected.byId[selected.current]?.blank === false)
          return;
        let active = true;
        void (async () => {
          try {
            const response = await fetch("/fitness-bootstrap", { credentials: "same-origin" });
            const result = await response.json();
            if (!response.ok || result.ok !== true || typeof result.sessionId !== "string") {
              throw new Error(result.error || "训练会话初始化失败");
            }
            await sessions.refresh();
            if (!active) return;
            const snapshot = sessions.list.getSnapshot();
            if (snapshot.byId[result.sessionId] === undefined) {
              throw new Error("训练会话尚未出现在 DSH Session 列表中");
            }
            sessions.open(result.sessionId);
            setBootstrapError("");
          } catch (error) {
            if (!active) return;
            bootstrapStarted.current = false;
            setBootstrapError(error instanceof Error ? error.message : "训练会话初始化失败");
          }
        })();
        return () => {
          active = false;
        };
      }, [phase, sessions]);
      useEffect(() => {
        if (!parentOrigin) return;
        window.parent.postMessage(
          {
            v: 1,
            type: "fitness.agent.run-state",
            sessionId: current ?? "",
            source: "interactive",
            state: running ? "running" : "idle",
            at: new Date().toISOString()
          },
          parentOrigin
        );
      }, [current, running, parentOrigin]);

      const controls = createElement(
        "div",
        { className: "fitness-surface__actions", "aria-label": "训练 Agent 控制" },
        running
          ? createElement(
              "span",
              { className: "fitness-surface__running", role: "status" },
              "正在处理"
            )
          : null,
        createElement(
          "button",
          {
            type: "button",
            ref: historyButton,
            "aria-expanded": historyOpen,
            onClick: () => {
              setHistoryOpen(!historyOpen);
              if (!historyOpen) void refreshHistory();
            }
          },
          "历史对话"
        ),
        createElement(
          "button",
          {
            type: "button",
            disabled: running,
            onClick: () => uiWorkspace.startSession(),
            title: running ? "当前任务完成后可新建会话" : "开始一个新的训练对话"
          },
          "新会话"
        ),
        createElement(
          "button",
          { type: "button", onClick: collapse, "aria-label": "收起 Agent 对话" },
          "收起"
        )
      );
      return createElement(
        ControlsContext.Provider,
        { value: controls },
        createElement(
          "main",
          { className: "fitness-surface" },
          createElement("style", null, STYLE),
          !session || session.blank
            ? createElement("div", { className: "fitness-surface__empty-controls" }, controls)
            : null,
          createElement(
            "section",
            { className: "fitness-surface__conversation" },
            renderSlot("main", {}, { entryKey: "conversation" })
          ),
          renderSlot("shell.overlay", {}),
          createElement("span", { className: "fitness-surface__powered" }, "Powered by DSH"),
          bootstrapError
            ? createElement(
                "div",
                { className: "fitness-surface__bootstrap-error", role: "alert" },
                bootstrapError
              )
            : null,
          createElement(
            "div",
            { className: "fitness-surface__rightbar" },
            renderSlot("rightbar", {
              width: Math.min(440, viewportWidth),
              viewportWidth,
              canShow: true
            })
          )
        )
      );
    }

    const STYLE = `
      :root { color-scheme: dark !important; background: transparent !important; }
      html, body, #root, [class*="_boot_"] { background: transparent !important; }
      .fitness-surface { position: relative; height: 100dvh; display: flex; flex-direction: column; background: transparent !important; color: #e5f4ff; font-family: Inter, ui-sans-serif, system-ui, sans-serif; overflow: hidden; }
      .fitness-surface__rightbar { --dsw-alias-bg-base: var(--dsw-alias-bg-layer-2); position: absolute; inset: 0 0 0 auto; width: 0; z-index: 20; }
      .fitness-surface__conversation { flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0; overflow: hidden; background: transparent !important; }
      .fitness-surface__conversation > * { flex: 1; min-height: 0; }
      .fitness-surface__actions { display: flex; flex: 0 0 auto; align-items: center; gap: 6px; white-space: nowrap; }
      .fitness-surface__empty-controls { display: flex; justify-content: flex-end; padding: 12px 20px; }
      @media (max-width: 720px) {
        .fitness-surface__actions { gap: 3px; }
        .fitness-surface__actions button { padding: 0 7px !important; }
        .fitness-surface__running { display: none; }
      }
      .fitness-surface__actions button { height: 32px; padding: 0 12px; border: 1px solid rgba(125, 211, 252, .2); border-radius: 9px; background: rgba(7, 13, 20, .78); color: #a8c0d0; font: 600 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace; cursor: pointer; backdrop-filter: blur(14px); }
      .fitness-surface__actions button:hover:not(:disabled) { border-color: rgba(125, 211, 252, .46); background: rgba(13, 28, 41, .88); color: #e5f4ff; }
      .fitness-surface__actions button:disabled { cursor: wait; opacity: .46; }
      .fitness-surface__running { color: #7dd3fc; font: 500 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace; }
      .fitness-surface__powered { position: fixed; right: 18px; bottom: 12px; z-index: 5; color: rgba(148, 180, 199, .48); font: 500 9px/1 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .08em; pointer-events: none; }
      .fitness-surface__bootstrap-error { position: fixed; top: 16px; left: 50%; z-index: 10; max-width: min(560px, 80vw); padding: 10px 14px; border: 1px solid rgba(248, 113, 113, .28); border-radius: 10px; background: rgba(69, 10, 10, .72); color: #fecaca; font-size: 12px; transform: translateX(-50%); }
      @media (max-width: 720px) { .fitness-surface { height: 100dvh; } }
    `;

    const layout = new FitnessLayout();
    const inject = ["slots", "sessions", "theme", "locale"];
    function apply(ctx) {
      ctx.effect(() => {
        const removeLanguage = ctx.locale.addLanguage({
          id: "zh-fitness",
          label: "简体中文 · Fitness",
          fallback: "zh"
        });
        const removeCopy = ctx.locale.register("conversation", "zh-fitness", {
          "hero.headline": "今天想怎么练？",
          "hero.preview": "训练教练",
          "placeholder.hero": "聊聊训练目标、身体状态或今天的安排",
          "placeholder.default": "和教练聊聊，/ 调用指令，@ 引用文件或对话"
        });
        ctx.locale.setLocale("zh-fitness");
        return () => {
          removeCopy();
          removeLanguage();
        };
      }, "fitness conversation copy");
      ctx.slots.inject("conversation.hero.brand.mark", () =>
        ctx.slots.register({ name: "conversation.hero.brand.mark" }, () => null)
      );
      ctx.slots.inject("conversation.session.header.utilities", () =>
        ctx.slots.register(
          { name: "conversation.session.header.utilities", id: "fitness-controls", order: 100 },
          HeaderControls
        )
      );
      ctx.effect(() => {
        const tokens = {
          "--dsw-alias-bg-base": "transparent",
          "--dsw-alias-bg-module-platform": "transparent",
          "--dsw-alias-bg-layer-1": "rgba(8, 24, 39, .92)",
          "--dsw-alias-bg-layer-2": "#111e2d",
          "--dsw-alias-label-primary": "#e5f4ff",
          "--dsw-alias-label-secondary": "#a8c0d0",
          "--dsw-alias-brand-primary": "#38bdf8",
          "--dsw-alias-brand-text": "#7dd3fc"
        };
        const disposeTokens = ctx.theme.overrideTokens(
          "@ai-fitness-os/dsh-fitness-surface",
          Object.fromEntries(
            Object.entries(tokens).map(([key, value]) => [key, { light: value, dark: value }])
          )
        );
        const previousStyle = document.body.getAttribute("style");
        const previousDark = document.body.hasAttribute("data-ds-dark-theme");
        const present = (snapshot) => {
          document.body.setAttribute("data-ds-dark-theme", "");
          document.body.style.setProperty("--dsh-content-font-size", `${snapshot.fontSize}px`);
          for (const [key, value] of Object.entries(snapshot.active.tokens)) {
            document.body.style.setProperty(key, value);
          }
        };
        present(ctx.theme.getTheme());
        const disposeTheme = ctx.on("theme/change", present);
        return () => {
          disposeTheme();
          disposeTokens();
          if (!previousDark) document.body.removeAttribute("data-ds-dark-theme");
          if (previousStyle === null) document.body.removeAttribute("style");
          else document.body.setAttribute("style", previousStyle);
        };
      }, "fitness theme presenter");
      ctx.effect(() => {
        const disposeService = ctx.reflect.provide("layout", layout);
        const disposePanelInfo = ctx.slots.provideRoot({
          hooks: {
            panelInfo: {
              getSnapshot: layout.getSnapshot,
              subscribe: layout.subscribe
            }
          }
        });
        const disposeRegistration = ctx.slots.register(
          {
            name: "root",
            children: {
              main: { kind: "keyed", scope: "root" },
              rightbar: { kind: "single", scope: "root" },
              "shell.overlay": { kind: "list", scope: "root" }
            }
          },
          (props) =>
            createElement(FitnessSurface, {
              ...props,
              sessions: ctx.sessions,
              uiWorkspace: { startSession: () => ctx.get("uiWorkspace").startSession() }
            })
        );
        return () => {
          layout.dispose();
          disposePanelInfo();
          disposeRegistration();
          void disposeService();
        };
      }, "fitness surface root");
    }

    module.exports = { apply, inject };
    return module.exports;
  }
});
