// Run against a disposable local preview via Playwright browser_run_code_unsafe.
async (page) => {
  await page.bringToFront();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  const original = await page.evaluate(() => localStorage.getItem("lg.newtab"));
  const assert = (value, message) => { if (!value) throw new Error(message); };
  try {
    await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem("lg.newtab"));
      state.activePage = state.pages[0].id;
      state.pages.forEach(p => {
        p.items.forEach(item => { item.pos = { x: 0, y: 0, z: 99 }; });
      });
      state.pages[0].items[0].pos.z = 3;
      state.layout.search = { x: 0, y: 0 };
      localStorage.setItem("lg.newtab", JSON.stringify(state));
    });
    await page.reload();
    await page.waitForTimeout(800);
    const tile = page.locator(".tile[data-shortcut-id]").first();
    const id = await tile.getAttribute("data-shortcut-id");
    const b = await tile.boundingBox(), s = await page.locator("#searchWrap").boundingBox();
    await page.mouse.move(b.x + 30, b.y + 30);
    await page.mouse.down();
    await page.mouse.move(s.x + 200 + 30, s.y - 15 + 30, { steps: 8 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const checkFront = async () => page.evaluate(id => {
      const tile = document.querySelector('[data-shortcut-id="' + id + '"]');
      const b = tile.getBoundingClientRect(), s = document.querySelector("#searchWrap").getBoundingClientRect();
      return document.elementFromPoint(b.x + b.width / 2, s.y + 30).closest(".tile") === tile;
    }, id);
    assert(await checkFront(), "dragging a previously layered card must cover the search bar: " + await tile.evaluate(el => JSON.stringify({ classes: el.className, z: getComputedStyle(el).zIndex, left: el.style.left, top: el.style.top })));
    const passCount = async () => tile.evaluate(el => document.getElementById(el.__lgId).querySelectorAll("feDisplacementMap").length);
    assert(await passCount() === 1, "drag uses a single refraction pass");
    await page.mouse.up();
    await page.waitForFunction(id => !document.querySelector('[data-shortcut-id="' + id + '"]').classList.contains("dragging"), id);
    assert(await checkFront(), "dropped card must remain above search");
    assert(await passCount() === 3, "full refraction returns once settled");
    await page.reload();
    await page.waitForTimeout(700);
    assert(await checkFront(), "layer order must persist after reload: " + JSON.stringify(await page.evaluate(id => {
      const el = document.querySelector('[data-shortcut-id="' + id + '"]');
      const s = document.querySelector("#searchWrap"), b = el.getBoundingClientRect(), r = s.getBoundingClientRect();
      return { card: { rect: b.toJSON(), z: getComputedStyle(el).zIndex }, search: { rect: r.toJSON(), z: getComputedStyle(s).zIndex }, hit: document.elementFromPoint(b.x + b.width / 2, r.y + 30).outerHTML.slice(0, 120), layout: JSON.parse(localStorage.getItem("lg.newtab")).layout };
    }, id)));
    await page.locator("#engineBtn").click();
    const menuZ = await page.locator("#searchWrap").evaluate(el => Number(getComputedStyle(el).zIndex));
    assert(menuZ > 1000, "open search menus must remain accessible above cards");
    await page.locator("#engineBtn").click();
    await page.locator("#btnSettings").click();
    const settingsZ = await page.locator(".sheet").evaluate(el => Number(getComputedStyle(el).zIndex));
    assert(settingsZ > menuZ, "settings stay above normal surfaces and search menus");
    return { dragging: "front", dropped: "front", reload: "front", menus: "accessible", settings: "front" };
  } finally {
    await page.mouse.up();
    await page.evaluate(value => {
      if (value === null) localStorage.removeItem("lg.newtab");
      else localStorage.setItem("lg.newtab", value);
    }, original);
    await page.reload();
  }
}
