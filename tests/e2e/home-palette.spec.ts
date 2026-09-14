import { expect, test } from "@playwright/test";

test("renders high-load overview in cyan and magenta with an integrated timeline heading", async ({
  page
}, testInfo) => {
  await page.route("**/api/dashboard", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    // Controlled visual fixture: exercise/selection mode must not mask load colors.
    for (const muscle of data.projection.bodyProjection) {
      muscle.status = muscle.muscleId.startsWith("pec_major")
        ? "purple"
        : muscle.muscleId.startsWith("deltoid")
          ? "orange"
          : muscle.muscleId.startsWith("vastus") || muscle.muscleId === "rectus_femoris"
            ? "red"
            : "gray";
      muscle.intensity = muscle.status === "gray" ? 0 : 80;
    }
    await route.fulfill({ json: data });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByLabel("3D model status")).toContainText("Model ready");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.getByRole("button", { name: "重置视角" }).click();
  await expect
    .poll(async () =>
      page.locator("canvas").evaluate((canvas) => {
        const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
        if (!gl) throw new Error("WebGL required");
        const pixels = new Uint8Array(canvas.width * canvas.height * 4);
        gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        let magenta = 0;
        let cyan = 0;
        let yellow = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          const [r, g, b] = pixels.slice(i, i + 3);
          if (r > 70 && r > g * 1.3 && b > g * 1.2) magenta++;
          if (g > 70 && g > r * 1.3 && b > r * 1.3) cyan++;
          if (r > 70 && r > b * 1.3 && g > b * 1.2) yellow++;
        }
        return magenta > 100 && cyan > 100 && yellow < 100;
      })
    )
    .toBe(true);
  await page.getByRole("button", { name: "展开训练时间线" }).click();
  const heading = page.locator(".timeline-heading");
  await expect(heading.getByRole("button", { name: "收起训练时间线" })).toBeVisible();
  await expect(page.locator(".timeline > .rail-toggle")).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath("overview-expanded.png"),
    animations: "disabled"
  });
  await page.getByRole("button", { name: "收起训练时间线" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: testInfo.outputPath("overview-mobile.png"),
    animations: "disabled"
  });
});
