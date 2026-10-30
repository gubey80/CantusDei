const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const path = require("node:path");
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const lyrics = "VERSO 1\n[La-]Una frase extensa para probar que la letra se puede leer completa en el telefono, con [Sol]todos los acordes sobre sus palabras y sin tener que desplazar hacia los costados.\n[Fa]Una frase corta.\n\nCORO\n[Re/Fa#]Esta es otra linea con muchos caracteres que continua y continua para comprobar el salto de renglon y sus [Mi]acordes finales.\n[La]" + "Palabra".repeat(22);
    const version = { id: "v", name: "Original", key: "La", lyrics, capo: 0 };
    const song = { id: "s", title: "Prueba de lectura movil", artist: "", songbook: { code: "mayor", name: "Cancionero Mayor" }, versions: [version] };
    await page.route("**/api/**", async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      await route.fulfill({ json: pathname.endsWith("/songs/s") ? song : pathname.endsWith("/songs") ? [song] : [] });
    });
    await page.goto(process.env.CANTUSDEI_TEST_URL || "http://127.0.0.1:5194/");
    await page.locator(".v2-song-open").first().click();
    await page.locator(".v2-lyrics-card .mobile-text-row").first().waitFor();
    async function assertFits() {
      await page.waitForTimeout(150);
      const result = await page.locator(".v2-lyrics-card").evaluate((card) => {
        const rect = card.getBoundingClientRect();
        return {
          pageOverflow: document.documentElement.scrollWidth > innerWidth,
          overflow: card.scrollWidth > card.clientWidth + 2,
          clipped: [...card.querySelectorAll(".mobile-text-row, .mobile-chord-row")].some((row) => row.getBoundingClientRect().right > rect.right + 1 || row.scrollWidth > row.clientWidth + 2),
          fontSize: getComputedStyle(card.querySelector(".mobile-text-row")).fontSize,
        };
      });
      assert.equal(result.pageOverflow, false);
      assert.equal(result.overflow, false);
      assert.equal(result.clipped, false);
      assert.equal(result.fontSize, "16px");
    }
    for (const width of [320, 360, 390, 430, 760]) {
      await page.setViewportSize({ width, height: 844 });
      await assertFits();
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await assertFits();
    const text = await page.locator(".mobile-text-row").allTextContents();
    assert.ok(text.join("").includes("todos los acordes sobre sus palabras"));
    const count = await page.locator(".mobile-chord-row").count();
    assert.ok(count >= 5);
    await page.getByRole("button", { name: "Ocultar acordes", exact: true }).click();
    assert.equal(await page.locator(".mobile-chord-row").count(), 0);
    await assertFits();
    await page.getByRole("button", { name: "Mostrar acordes", exact: true }).click();
    await page.locator(".v2-tone-trigger").click();
    await page.getByRole("button", { name: "+1/2 tono", exact: true }).click();
    await assertFits();
    await page.locator(".v2-tone-trigger").click();
    if (process.env.CANTUSDEI_SCREENSHOTS) await page.locator(".v2-lyrics-card").screenshot({ path: path.join(process.env.CANTUSDEI_SCREENSHOTS, "mobile-lyrics-fixed.png") });
    await page.setViewportSize({ width: 1280, height: 900 });
    assert.equal(await page.locator(".desktop-lyric-line").first().isVisible(), true);
    assert.equal(await page.locator(".mobile-lyric-line").first().isVisible(), false);
    assert.deepEqual(errors, []);
    console.log("OK: lectura completa de 320 a 760 px, acordes, transposicion y vista de escritorio con API simulada.");
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
