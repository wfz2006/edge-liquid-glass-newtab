// Playwright browser_run_code_unsafe entry point. Start the local HTTP server
// and navigate to it before running this file. No production storage is changed.
async (page) => {
  await page.bringToFront();
  const base = page.url().split("/").slice(0, 3).join("/");
  const fixture = base + "/tests/fixtures/glass-sampling.html";
  const checks = [];
  for (const profile of ["clear", "balanced", "readable"]) {
    for (const lite of [false, true]) {
    await page.goto(fixture);
    await page.evaluate(profile => {
      document.documentElement.setAttribute("data-glass-profile", profile);
      LiquidGlass.init();
      Object.assign(document.getElementById("probe").style, {
        border: "none", background: "transparent"
      });
      Object.assign(document.getElementById("neighbor").style, {
        left: "356px", top: "348px", width: "8px", height: "8px", background: "white"
      });
    }, profile);
    if (lite) await page.evaluate(() => LiquidGlass.lite([document.getElementById("probe")], true));

    // The optical center must stay anchored, although the lens enlarges its marker.
    // Percent-sized feImage shifts it by about 10px instead of magnifying in place.
    const center = { x: 324, y: 324, width: 72, height: 56 };
    const filtered = await page.screenshot({ clip: center });
    await page.evaluate(() => {
      document.getElementById("probe").style.backdropFilter = "saturate(140%) brightness(1.02)";
    });
    const reference = await page.screenshot({ clip: center });
    const centers = await page.evaluate(async images => {
      const result = [];
      for (const data of images) {
        const bitmap = await createImageBitmap(await (await fetch("data:image/png;base64," + data)).blob());
        const canvas = document.createElement("canvas"); canvas.width = bitmap.width; canvas.height = bitmap.height;
        const ctx = canvas.getContext("2d"); ctx.drawImage(bitmap, 0, 0); bitmap.close();
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let x = 0, y = 0, count = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i] > 220 && pixels[i + 1] > 220 && pixels[i + 2] > 220) {
            x += (i / 4) % canvas.width; y += Math.floor(i / 4 / canvas.width); count++;
          }
        }
        result.push({ x: x / count, y: y / count, count });
      }
      return result;
    }, [filtered.toString("base64"), reference.toString("base64")]);
    if (!centers[0].count || Math.hypot(centers[0].x - centers[1].x, centers[0].y - centers[1].y) > .75) {
      throw new Error(profile + ": optical center drifted");
    }
    await page.evaluate(() => {
      const el = document.getElementById("probe");
      el.style.backdropFilter = "url(#" + el.__lgId + ") saturate(140%) brightness(1.02)";
      Object.assign(document.getElementById("neighbor").style, { width: "120px", height: "104px" });
    });

    const clip = await page.locator("#probe").boundingBox();
    const cases = [
      ["right", 432, 300], ["left", 168, 300],
      ["above", 300, 184], ["below", 300, 416],
      ["near-right", 424, 300], ["near-left", 176, 300],
      ["near-above", 300, 192], ["near-below", 300, 408],
      ["overlap", 360, 320]
    ];
    for (const [name, x, y] of cases) {
      await page.locator("#neighbor").evaluate((el, pos) => {
        Object.assign(el.style, { left: pos.x + "px", top: pos.y + "px", background: "black" });
      }, { x, y });
      const black = await page.screenshot({ clip });
      await page.locator("#neighbor").evaluate(el => { el.style.background = "white"; });
      const white = await page.screenshot({ clip });
      const unchanged = black.equals(white);
      if (unchanged !== (name !== "overlap")) {
        throw new Error(profile + "/" + name + ": incorrect backdrop sampling boundary");
      }
    }
    // Transparency alone also changes pixels when a neighbor changes color.
    // Compare displacement on/off over an edge pattern to prove real refraction.
    await page.evaluate(() => {
      Object.assign(document.getElementById("neighbor").style, {
        left: "300px", top: "300px",
        background: "repeating-linear-gradient(90deg,black 0 4px,white 4px 8px)"
      });
    });
    const refracted = await page.screenshot({ clip });
    const interiorClip = { x: 326, y: 326, width: 68, height: 52 };
    const interiorRefracted = await page.screenshot({ clip: interiorClip });
    await page.evaluate(() => {
      const el = document.getElementById("probe");
      document.querySelectorAll("#" + el.__lgId + " feDisplacementMap").forEach(dm => dm.setAttribute("scale", "0"));
    });
    const flat = await page.screenshot({ clip });
    const interiorFlat = await page.screenshot({ clip: interiorClip });
    if (refracted.equals(flat)) throw new Error(profile + ": edge refraction disappeared");
    if (interiorRefracted.equals(interiorFlat)) throw new Error(profile + ": interior has no refraction");
    checks.push({ profile, lite, center: "anchored", separatedNeighbors: 8, overlap: "visible", interiorDisplacement: "verified" });
    }
  }
  return checks;
}
