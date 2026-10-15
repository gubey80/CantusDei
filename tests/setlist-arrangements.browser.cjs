const assert = require("node:assert/strict");
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const song = { id: "song", title: "Cancion de prueba", artist: "", versions: [] };
  const version = { id: "version", key: "La", name: "Original", lyrics: "VERSO 1\n[La]Primera parte\n\nCORO\n[Re]Segunda parte", song };
  const setlist = { id: "setlist", name: "Evento de prueba", date: "2026-10-18T12:00:00.000Z", musicians: {}, items: [{ id: "item", position: 1, songVersionId: "version", songVersion: version, arrangement: [] }] };
  song.versions = [{ ...version, song: undefined }];
  let saved = null;
  await page.addInitScript(() => localStorage.setItem("cantusdei_user", JSON.stringify({ role: "ADMIN", name: "Prueba" })));
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let response = [];
    if (path.endsWith("/arrangement")) {
      saved = route.request().postDataJSON().arrangement;
      setlist.items[0].arrangement = saved;
      response = { arrangement: saved };
    } else if (path.endsWith("/setlists/setlist")) response = setlist;
    else if (path.endsWith("/setlists")) response = [setlist];
    else if (path.endsWith("/songs/song")) response = song;
    else if (path.endsWith("/songs")) response = [song];
    await route.fulfill({ json: response });
  });
  await page.goto(process.env.CANTUSDEI_TEST_URL || "http://127.0.0.1:5193/");
  await page.getByRole("button", { name: "Setlist", exact: true }).click();
  await page.getByRole("button", { name: /Evento de prueba/ }).click();
  await page.getByRole("button", { name: "Armado de ejecucion" }).click();
  await page.getByRole("button", { name: "Agregar CORO", exact: true }).click();
  await page.getByRole("button", { name: "Subir CORO", exact: true }).last().click();
  await page.getByRole("button", { name: "Subir CORO", exact: true }).first().click();
  await page.getByRole("button", { name: "Guardar en setlist" }).click();
  await page.getByRole("status").filter({ hasText: "Ejecucion guardada" }).waitFor();
  assert.deepEqual(saved.map((block) => block.name), ["CORO", "VERSO 1", "CORO"]);
  assert.equal(version.lyrics.startsWith("VERSO 1"), true);
  await page.getByRole("button", { name: "Volver a la setlist" }).click();
  await page.getByRole("button", { name: "Armado de ejecucion" }).click();
  assert.equal(await page.locator(".arrangement-order li.arrangement-block").count(), 3);
  await page.locator(".arrangement-source .arrangement-block").first().dragTo(page.locator(".arrangement-order li.arrangement-block").first());
  assert.equal(await page.locator(".arrangement-order li.arrangement-block").count(), 4);
  assert.equal(await page.locator(".arrangement-order li.arrangement-block strong").first().textContent(), "VERSO 1");
  await page.locator(".arrangement-order li.arrangement-block").last().dragTo(page.locator(".arrangement-order li.arrangement-block").first());
  assert.equal(await page.locator(".arrangement-order li.arrangement-block strong").first().textContent(), "CORO");
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert.equal(overflow, false, "La pantalla movil no debe desbordarse");
  await page.getByRole("button", { name: "Repetir CORO", exact: true }).first().click();
  assert.equal(await page.locator(".arrangement-order li.arrangement-block").count(), 5);
  assert.deepEqual(errors, []);
  console.log("OK: agregado, reordenamiento, guardado y reapertura con API simulada; movil sin desbordes ni errores de React.");
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
