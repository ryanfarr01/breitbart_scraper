const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('https://www.breitbart.com/'); //TODO <== wuuuuut?

  await page.setViewport({ width: 1400, height: 800 });
  await page.waitFor(10000);

  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('iframe[id^="google_ads_iframe"]')).map(iframe => {
      return iframe.contentWindow.document.body.innerHTML;
    })
  })

  console.log(links);


  await browser.close();
})();
