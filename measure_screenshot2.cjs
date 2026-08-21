const fs = require('fs');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('about:blank');
  const base64 = fs.readFileSync('C:/Users/nisha/.gemini/antigravity/brain/a53b8eb0-1f25-4dfb-89ea-6092bf28b5e1/.user_uploaded/media_1787321819703.png').toString('base64');
  const result = await page.evaluate(async (b64) => {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(0,0,c.width,c.height).data;
        
        let darkMinX = c.width, darkMaxX = 0;
        for(let i=0; i<d.length; i+=4) {
          const r = d[i], g = d[i+1], b = d[i+2], a = d[i+3];
          const x = (i/4) % c.width;
          const y = Math.floor((i/4) / c.width);
          // dark bike tire (near black) but not the background!
          // background is 0x0a0a0b.
          if (r > 15 && r < 40 && g > 15 && g < 40 && b > 15 && b < 45 && y > c.height/2) {
             if (x < darkMinX) darkMinX = x;
             if (x > darkMaxX) darkMaxX = x;
          }
        }
        resolve({ darkWidth: darkMaxX - darkMinX });
      };
      img.src = 'data:image/png;base64,' + b64;
    });
  }, base64);
  console.log("Screenshot metrics 2:", result);
  await browser.close();
})();
