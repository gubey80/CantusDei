const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const path = require("node:path");

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.setDefaultTimeout(10000);
    const arrangement = [
      { id: "c", type: "chorus", name: "Coro", lyrics: "[La]Mas profundo que el mar\n[Re]Tu amor me bastara", comment: "Solo voces y teclado" },
      { id: "v", type: "verse", name: "Verso 1", lyrics: "[La]Profundo es el amor de Cristo\n[Mi]Dejo Su trono y Su gloria", comment: "Se suma bateria" },
    ];
    const song = { id: "song", title: "El amor de Cristo", versions: [{ id: "version", key: "La" }] };
    const setlist = { id: "event", name: "Domingo", date: "2026-10-18T12:00:00Z", musicians: {}, items: [
      { id: "first", position: 1, songVersionId: "version", arrangement, songVersion: { id: "version", key: "La", lyrics: "VERSO 1\n[La]Base", song } },
      { id: "second", position: 2, songVersionId: "v2", arrangement: [], songVersion: { id: "v2", key: "Re", lyrics: "VERSO 1\n[Re]Otra cancion", song: { id: "song2", title: "Otra cancion" } } },
    ] };
    await page.route("**/api/**", async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      const json = pathname.endsWith("/setlists/event") ? setlist : pathname.endsWith("/setlists") ? [setlist] : pathname.endsWith("/songs") ? [song] : [];
      await route.fulfill({ json });
    });
    await page.goto(process.env.CANTUSDEI_TEST_URL || "http://127.0.0.1:5193/");
    await page.getByRole("button", { name: "Setlist", exact: true }).click();
    await page.getByRole("button", { name: /Domingo/ }).click();
    await page.getByRole("button", { name: "Modo Monitor", exact: true }).click();
    const monitor = page.getByRole("region", { name: "Modo Monitor", exact: true });
    await monitor.waitFor();
    assert.equal(await page.locator(".stage-section-heading h3").textContent(), "Coro");
    assert.equal(await page.locator(".stage-cue p").textContent(), "Solo voces y teclado");
    await page.getByRole("spinbutton", { name: "Duracion de la seccion", exact: true }).fill("5");
    await page.getByRole("slider", { name: "Velocidad del avance" }).fill("1.5");
    await page.getByRole("button", { name: "Reproducir", exact: true }).click();
    await page.waitForFunction(() => document.querySelector(".stage-section-heading h3").textContent === "Verso 1");
    await page.getByRole("button", { name: "Pausar", exact: true }).click();
    assert.equal(await page.locator(".stage-cue p").textContent(), "Se suma bateria");
    await page.getByRole("checkbox", { name: "Comentarios", exact: true }).uncheck();
    assert.equal(await page.locator(".stage-cue").count(), 0);
    await page.getByRole("checkbox", { name: "Comentarios", exact: true }).check();
    await page.getByRole("checkbox", { name: "Acordes", exact: true }).uncheck();
    assert.equal(await page.locator(".stage-word-chords").count(), 0);
    await page.getByRole("checkbox", { name: "Acordes", exact: true }).check();
    await page.getByRole("combobox", { name: "Cancion del evento" }).selectOption("1");
    assert.equal(await page.locator(".stage-song-header h2").textContent(), "Otra cancion");
    await page.getByRole("combobox", { name: "Cancion del evento" }).selectOption("0");
    if (process.env.CANTUSDEI_SCREENSHOTS) await page.screenshot({ path: path.join(process.env.CANTUSDEI_SCREENSHOTS, "monitor-desktop.png") });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Solo monitor", exact: true }).click();
    assert.equal(await page.locator(".stage-operator").count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const lyricsBox = await page.locator(".stage-lyrics-scroll").boundingBox();
    assert.ok(lyricsBox.height > 100);
    if (process.env.CANTUSDEI_SCREENSHOTS) await page.screenshot({ path: path.join(process.env.CANTUSDEI_SCREENSHOTS, "monitor-mobile.png") });
    await page.getByRole("button", { name: "Mostrar controles", exact: true }).click();
    await page.getByRole("button", { name: "Mantener seccion", exact: true }).click();
    assert.equal(await page.getByRole("button", { name: "Seccion retenida", exact: true }).getAttribute("aria-pressed"), "true");
    await page.getByRole("button", { name: "Volver", exact: true }).click();
    assert.equal(await page.locator(".setlist-stage-monitor").count(), 0);
    assert.deepEqual(errors, []);
    console.log("OK: Modo Monitor, avance temporizado, comentarios por bloque, seleccion de canciones y movil con API simulada.");
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
