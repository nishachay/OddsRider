const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.error('BROWSER ERROR:', err));

  await page.goto('http://127.0.0.1:5173');
  await page.waitForTimeout(2000);

  const init = await page.evaluate(() => {
    const o = window.__oddsrider;
    return { x: o.x(), y: o.y(), speed: o.speed(), score: o.score(), simMs: o.simMs() };
  });
  console.log('INITIAL TELEMETRY:', init);

  // Fast forward bike to finish line
  console.log('Teleporting bike to finish line...');
  await page.evaluate(() => {
    // drive forward
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
  });
  await page.waitForTimeout(1000);

  // Simulate finish
  await page.evaluate(() => {
    // Teleport chassis near finish line to trigger finish
    const o = window.__oddsrider;
    console.log('Current x before teleport:', o.x());
  });

  // Call reset via window.__oddsrider.reset()
  console.log('Calling reset()...');
  const afterReset = await page.evaluate(() => {
    window.__oddsrider.reset();
    const o = window.__oddsrider;
    return { x: o.x(), y: o.y(), speed: o.speed(), score: o.score(), simMs: o.simMs() };
  });
  console.log('TELEMETRY IMMEDIATELY AFTER RESET:', afterReset);

  // Wait 1 second and check again
  await page.waitForTimeout(1000);
  const after1s = await page.evaluate(() => {
    const o = window.__oddsrider;
    return { x: o.x(), y: o.y(), speed: o.speed(), score: o.score(), simMs: o.simMs() };
  });
  console.log('TELEMETRY 1S AFTER RESET:', after1s);

  await browser.close();
})().catch(e => {
  console.error('Test error:', e);
  process.exit(1);
});
