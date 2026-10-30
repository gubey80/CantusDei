const assert = require("node:assert/strict");
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const songs = [
      { id: "first", title: "Como podre estar triste", versions: [{ id: "v1", key: "La" }] },
      { id: "chosen", title: "La cancion elegida", versions: [{ id: "v2", key: "Re" }] },
      { id: "another", title: "Otra cancion elegida", versions: [{ id: "v3", key: "Mi" }] },
    ];
    await page.addInitScript((data) => localStorage.setItem("cantusdei_song_summaries_v2", JSON.stringify(data)), songs);
    let releaseList;
    let releaseDetail;
    const pendingList = new Promise((resolve) => { releaseList = resolve; });
    const pendingDetail = new Promise((resolve) => { releaseDetail = resolve; });
    const detailRequests = [];
    let listReleased = false;
    await page.route("**/api/**", async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname.endsWith("/songs")) {
        await pendingList;
        listReleased = true;
        return route.fulfill({ json: songs });
      }
      const song = songs.find((entry) => pathname.endsWith(`/songs/${entry.id}`));
      if (song) {
        detailRequests.push(song.id);
        if (song.id === "chosen") await pendingDetail;
        return route.fulfill({ json: { ...song, versions: [{ ...song.versions[0], lyrics: `[${song.versions[0].key}]Letra de ${song.title}` }] } });
      }
      return route.fulfill({ json: [] });
    });
    await page.goto(process.env.CANTUSDEI_TEST_URL || "http://127.0.0.1:5194/");
    await page.getByRole("button", { name: /La cancion elegida/ }).click();
    await page.waitForFunction(() => document.querySelector(".v2-titlebar h2")?.textContent === "La cancion elegida");
    releaseList();
    await page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/songs"));
    await page.waitForTimeout(200);
    assert.equal(listReleased, true);
    assert.equal(await page.locator(".v2-titlebar h2").textContent(), "La cancion elegida");
    assert.equal(await page.getByText("Cargando letra...", { exact: true }).isVisible(), true);
    releaseDetail();
    await page.locator(".mobile-text-row").first().waitFor();
    assert.ok((await page.locator(".mobile-text-row").allTextContents()).join("").includes("La cancion elegida"));
    assert.equal(detailRequests.includes("first"), false);
    await page.getByRole("button", { name: "Volver al listado", exact: true }).click();
    await page.getByRole("button", { name: /Otra cancion elegida/ }).click();
    await page.waitForFunction(() => document.querySelector(".v2-titlebar h2")?.textContent === "Otra cancion elegida");
    await page.waitForFunction(() => document.querySelector(".v2-lyrics-card")?.textContent.includes("Otra cancion elegida"));
    assert.deepEqual(errors, []);
    console.log("OK: la carga inicial tardia conserva la cancion elegida; letra demorada y segunda seleccion correctas.");
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
