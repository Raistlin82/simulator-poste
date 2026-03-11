import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER_LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER_ERROR:', err.message));
  
  await page.goto('http://localhost:5173/'); // adjust port if needed
  
  // Wait for React to load
  await page.waitForTimeout(3000);
  
  // Try to click Analisi tab
  try {
    const tabs = await page.$$('button[role="tab"]');
    for (const tab of tabs) {
      const text = await tab.textContent();
      if (text && text.toLowerCase().includes('analisi')) {
        await tab.click();
        console.log('Clicked Analisi tab!');
        break;
      }
    }
  } catch (e) {
    console.log('Failed to click:', e);
  }
  
  await page.waitForTimeout(2000);
  
  await browser.close();
})();
