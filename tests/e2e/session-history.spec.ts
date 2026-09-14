import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";

// Real Fitness Surface module, with the official sessions-service face replaced by a fixture.
// This exercises both sides of postMessage without model requests or persisted test conversations.
const surface = readFileSync("dsh-fitness/surface/lib/client.js", "utf8");
const react = readFileSync("node_modules/react/umd/react.development.js", "utf8");
const reactDom = readFileSync("node_modules/react-dom/umd/react-dom.development.js", "utf8");
const conversationSource = readFileSync(
  "node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js",
  "utf8"
);
const conversationCss = [...conversationSource.matchAll(/const css(?:\$\d+)? = ("[^\n]+");/g)]
  .map((match) => JSON.parse(match[1]) as string)
  .find((css) => css.includes("_headerUtilities"))!;
const headerPrefix = conversationCss.match(/\.([\w-]+)_headerUtilities/)![1];
const titles = [
  "上肢力量训练安排",
  "最近一次锻炼是什么时候了",
  "下肢训练后的恢复建议",
  "肩部活动度与热身",
  "本周训练总结",
  "调整今天的训练计划",
  "一次比较长的对话标题：如何在工作繁忙时保持规律训练并合理分配恢复时间",
  "周末有氧与核心训练",
  "深蹲动作复盘",
  "背部训练的动作选择"
];

function fixture() {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${conversationCss}</style></head><body style="margin:0"><div id="root"></div>
  <script>${react}</script><script>${reactDom}</script>
  <script>
  const rows = ${JSON.stringify(titles)}.map((title,i)=>({id:'session-'+i,title,displayTitle:title,updatedAt:Date.UTC(2026,8,13-i,10,30),running:false,blank:false}));
  rows.push({id:'blank',displayTitle:'空白会话',updatedAt:Date.now(),blank:true,running:false});
  let snapshot={ids:rows.map(row=>row.id),byId:Object.fromEntries(rows.map(row=>[row.id,row])),current:'session-3',phase:'ready'};
  const listeners=new Set();
  const sessions={list:{getSnapshot:()=>snapshot},refresh:async()=>{},open(id){snapshot={...snapshot,current:id};for(const notify of listeners)notify();}};
  const useSessions=(select)=>select(React.useSyncExternalStore(fn=>{listeners.add(fn);return()=>listeners.delete(fn)},()=>snapshot));
  let HeaderControls;
  const ctx={locale:{addLanguage(){return()=>{}},register(){return()=>{}},setLocale(){}},get(name){return this[name]},sessions,uiWorkspace:{startSession(){}},effect(fn){fn()},on(){return()=>{}},theme:{overrideTokens(){return()=>{}},getTheme(){return{fontSize:14,active:{tokens:{}}}}},reflect:{provide(){return()=>{}}},slots:{provideRoot(){return()=>{}},inject(name,fn){fn()},register(def,component){
    if(def.name==='conversation.session.header.utilities'){HeaderControls=component;return()=>{}}; if(def.name!=='root')return()=>{};
    ReactDOM.createRoot(document.getElementById('root')).render(component({useSessions,SessionProvider:React.Fragment,renderSlot(name){return name==='main'?React.createElement('div',{className:'${headerPrefix}_root'},React.createElement('header',{className:'${headerPrefix}_header'},React.createElement('div',{className:'${headerPrefix}_titleRow'},React.createElement('div',{className:'${headerPrefix}_titleCluster'},React.createElement('nav',{className:'${headerPrefix}_crumbs'},React.createElement('button',{className:'${headerPrefix}_crumb ${headerPrefix}_crumbCurrent'},'训练对话标题'))),React.createElement('div',{className:'${headerPrefix}_headerUtilities'},React.createElement(HeaderControls)))),React.createElement('div',null,'会话内容')):null}}));return()=>{}}}};
  window.__ModuleLoader__={load(def){def.factory(()=>React).apply(ctx)}};
  </script><script>${surface}</script></body></html>`;
}

test("history wheel covers the context panel and switches DSH sessions", async ({
  page
}, testInfo) => {
  test.setTimeout(120_000);
  await page.route("**/api/model/settings", (route) =>
    route.fulfill({
      json: { ok: true, settings: { provider: "DeepSeek", configured: true, writable: true } }
    })
  );
  await page.route("**/api/dsh-web", (route) =>
    route.fulfill({
      json: { ok: true, status: "ready", url: "http://127.0.0.1:3080/history-fixture" }
    })
  );
  await page.route("http://127.0.0.1:3080/history-fixture", (route) =>
    route.fulfill({ contentType: "text/html", body: fixture() })
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.getByRole("button", { name: /和训练 Agent 对话/ }).click();
  const frame = page.frameLocator("iframe");
  await frame.getByRole("button", { name: "历史对话" }).click();
  await expect(frame.locator(".fitness-surface > .fitness-surface__actions")).toHaveCount(0);
  await expect(frame.locator(`.${headerPrefix}_titleRow .fitness-surface__actions`)).toHaveCount(1);
  const history = page.getByRole("dialog", { name: "历史对话" });
  await expect(history).toBeVisible();
  await expect(history.getByRole("listitem")).toHaveCount(10);
  await expect(history.getByRole("textbox")).toHaveCount(0);
  await expect(history.getByRole("button", { name: "关闭历史对话" })).toBeFocused();
  await expect(history.locator('[aria-current="true"]')).toContainText("肩部活动度与热身");
  const insights = await page.getByLabel("Training insights").boundingBox();
  await expect.poll(async () => (await history.boundingBox())?.x).toBe(insights?.x);
  expect(
    await page.getByLabel("Training insights").evaluate((el) => (el as HTMLElement).inert)
  ).toBe(true);
  async function checkOrbit() {
    for (const offset of [176, 213, 267, 310]) {
      await history.locator(".session-history__wheel").evaluate((element, top) => {
        element.scrollTop = top;
      }, offset);
      await expect
        .poll(async () =>
          history.evaluate((element) => {
            const orbit = element.querySelector(".session-history__orbit")!.getBoundingClientRect();
            const dots = [...element.querySelectorAll(".session-history__record > i")].map((dot) =>
              dot.getBoundingClientRect()
            );
            return Math.max(
              ...dots
                .filter((dot) => dot.y > orbit.y && dot.bottom < orbit.bottom)
                .map((dot) => {
                  const y = dot.y + dot.height / 2 - orbit.y;
                  const expectedX = 16 + 72 * ((2 * y) / orbit.height - 1) ** 2;
                  return Math.abs(dot.x + dot.width / 2 - orbit.x - expectedX);
                })
            );
          })
        )
        .toBeLessThan(0.8);
    }
  }
  await checkOrbit();
  await page.screenshot({ path: testInfo.outputPath("history-desktop.png") });
  await history.getByRole("button", { name: /下肢训练后的恢复建议/ }).click();
  await expect(history).not.toBeVisible();
  await expect(frame.getByRole("button", { name: "历史对话" })).toBeFocused();
  await frame.getByRole("button", { name: "历史对话" }).click();
  await expect(history.locator('[aria-current="true"]')).toContainText("下肢训练后的恢复建议");
  await page.setViewportSize({ width: 390, height: 844 });
  await checkOrbit();
  await page.screenshot({ path: testInfo.outputPath("history-mobile.png") });
  expect(await history.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await history.locator('[aria-current="true"]').focus();
  await page.keyboard.press("ArrowDown");
  await expect(history.getByRole("button", { name: /肩部活动度与热身/ })).toBeFocused();
  await page.keyboard.press("End");
  await expect(history.getByRole("button", { name: /背部训练的动作选择/ })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(history).not.toBeVisible();
  const titleRow = await frame.locator(`.${headerPrefix}_titleRow`).boundingBox();
  const actions = await frame.locator(".fitness-surface__actions").boundingBox();
  expect(actions!.y).toBeGreaterThanOrEqual(titleRow!.y);
  expect(actions!.y + actions!.height).toBeLessThanOrEqual(titleRow!.y + titleRow!.height + 1);
});
