import { chromium } from 'playwright';
import path from 'path';

(async () => {
    const browser = await chromium.launch({ headless: true });

    const widths = [375, 768, 1440];

    // Test Optimized version
    for (const width of widths) {
        const page = await browser.newPage({ viewport: { width, height: 900 } });

        await page.goto(`file://${path.resolve('portfolio-optimized/index.html')}`);
        await page.waitForTimeout(1000); // Wait for fonts and JS

        // Add bounding client rect tracking
        await page.evaluate(() => {
            window.rectCalls = 0;
            const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
            Element.prototype.getBoundingClientRect = function() {
                window.rectCalls++;
                return originalGetBoundingClientRect.apply(this, arguments);
            };
        });

        // Simulate pointer sweep
        await page.mouse.move(100, 100);
        await page.mouse.move(500, 100, { steps: 50 });

        const rectCalls = await page.evaluate(() => window.rectCalls);
        console.log(`Width ${width}px - Layout reads during pointer move: ${rectCalls}`);

        await page.screenshot({ path: `portfolio-optimized/scripts/screenshot_${width}.png`, fullPage: true });

        await page.close();
    }

    await browser.close();
})();
