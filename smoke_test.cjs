const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:4173');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'E:/OddsRider/screenshot.png' });
  const logs = await page.evaluate(() => {
    const o = window.__oddsrider;
    if (!o) return 'NO GLOBAL';
    return {
      x: o.x(), y: o.y(), angle: o.angle(), speed: o.speed(),
      grounded: o.grounded(), crashed: o.crashed(), nitro: o.nitro()
    };
  });
  console.log('Telemetry:', logs);
  await browser.close();
  console.log('Done.');
})().catch(e => {
  console.error('Test failed:', e);
  process.exit(1);
});
