const fs = require('fs');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('about:blank');
  const base64 = fs.readFileSync('public/assets2/bike (2).png').toString('base64');
  const result = await page.evaluate(async (b64) => {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(0,0,c.width,c.height).data;
        let minX = c.width, maxX = 0, minY = c.height, maxY = 0;
        for(let i=0; i<d.length; i+=4) {
          const a = d[i+3];
          if (a > 128) {
            const x = (i/4) % c.width;
            const y = Math.floor((i/4) / c.width);
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
        resolve({ w: img.width, h: img.height, minX, maxX, minY, maxY });
      };
      img.src = 'data:image/png;base64,' + b64;
    });
  }, base64);
  console.log("Bike bounds:", result);
  await browser.close();
})();
