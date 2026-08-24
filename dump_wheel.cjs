const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('about:blank');
  
  const base64 = fs.readFileSync('public/assets/game/wheel.png').toString('base64');
  
  const text = await page.evaluate(async (b64) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(0,0,c.width,c.height).data;
        let out = 'SIZE: ' + c.width + 'x' + c.height + '\n';
        for(let y=0; y<c.height; y+=3) {
          for(let x=0; x<c.width; x+=2) {
            const a = d[(y*c.width+x)*4+3];
            out += a > 128 ? '#' : '.';
          }
          out += '\n';
        }
        resolve(out);
      };
      img.src = 'data:image/png;base64,' + b64;
    });
  }, base64);
  
  fs.writeFileSync('wheel_ascii.txt', text);
  console.log('ASCII dumped to wheel_ascii.txt');
  await browser.close();
})();
