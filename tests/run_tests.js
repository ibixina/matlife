const puppeteer = require('puppeteer');

(async () => {
    const runTestPage = async (url) => {
        console.log(`\n\n=== Running tests for ${url} ===`);
        const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
        const page = await browser.newPage();

        let testFinished = false;
        let failedCount = 0;

        page.on('console', msg => {
            const text = msg.text();
            console.log(text);
            if (text.includes('Test execution complete.')) {
                testFinished = true;
            }
            const failedMatch = text.match(/Failed:\s*(\d+)/i);
            if (failedMatch) {
                failedCount = parseInt(failedMatch[1], 10) || 0;
            }
            if (text.includes('✗') && !text.includes('Failed: 0')) {
                failedCount = Math.max(failedCount, 1);
            }
        });

        page.on('pageerror', err => {
            console.error('Page error: ' + err.toString());
        });

        await page.goto(url, { waitUntil: 'networkidle0' });

        for (let i = 0; i < 50; i++) {
            if (testFinished) break;
            await new Promise(r => setTimeout(r, 100));
        }

        await browser.close();
        return failedCount;
    };

    const failures = [];
    failures.push(await runTestPage('http://localhost:8000/tests/test-runner.html'));
    failures.push(await runTestPage('http://localhost:8000/tests/test-runner-comprehensive.html'));

    const totalFailed = failures.reduce((sum, count) => sum + count, 0);
    if (totalFailed > 0) {
        process.exitCode = 1;
    }
})();
