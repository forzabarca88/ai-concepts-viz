import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  
  await page.goto('http://localhost:4321/core-concepts/tokenization/');
  await page.waitForTimeout(2000);
  
  // Full page screenshot
  await page.screenshot({ 
    path: '/home/forza/ai_gen/ai-concepts-viz/screenshots/tokenization-full.png',
    fullPage: true 
  });
  
  // Click preset button and screenshot
  await page.click('.preset-btn[data-text="Hello world"]');
  await page.waitForTimeout(500);
  await page.screenshot({ 
    path: '/home/forza/ai_gen/ai-concepts-viz/screenshots/tokenization-hello-world.png' 
  });
  
  // Click another preset
  await page.click('.preset-btn[data-text="The quick brown fox"]');
  await page.waitForTimeout(500);
  await page.screenshot({ 
    path: '/home/forza/ai_gen/ai-concepts-viz/screenshots/tokenization-quick-fox.png' 
  });

  // Click third preset
  await page.click('.preset-btn[data-text="I love AI!"]');
  await page.waitForTimeout(500);
  await page.screenshot({ 
    path: '/home/forza/ai_gen/ai-concepts-viz/screenshots/tokenization-love-ai.png' 
  });
  
  console.log('Screenshots saved.');
  await browser.close();
})();
