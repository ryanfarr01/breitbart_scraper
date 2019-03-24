const puppeteer = require("puppeteer");
const fs = require('fs');

const CHROME_SETTINGS = {
  headless: true,
  args: [ "--disable-web-security" ]
};

const N_VISITS_PER_USER = 10;

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

(async () => {
  const writer = fs.createWriteStream("hosts.csv");

  await asyncForEach(["ryan", "ben"], async (user) => {
    console.log(`mocking ${user}`);

    const settings = Object.assign({}, CHROME_SETTINGS, {
      userDataDir: `../profiles/${user}`
    })

    const browser = await puppeteer.launch(settings);
    await asyncForEach(new Array(N_VISITS_PER_USER), async (_, idx) => {

      console.log(idx);

      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });

      console.log("opened page");
      await page.goto("https://www.breitbart.com/", { waituntil: "networkidle0" });
      await page.waitFor("iframe");

      console.log("sent request");
      const ads = await page.evaluate(() => {
        ads = [];
        iframes =  Array.from(document.getElementsByTagName("iframe"));
        while(iframes.length > 0) {
          currentFrame = iframes.shift();
          subframes = Array.from(currentFrame.contentWindow.document.getElementsByTagName("iframe"));
          iframes = iframes.concat(subframes);
          frameAds = Array.from(
            currentFrame.contentWindow.document.querySelectorAll("a[href^='https://googleads.g.doubleclick.net']")
          ).map(aTag => aTag.href);
          scriptTargets = Array.from(
            currentFrame.contentWindow.document.querySelectorAll("script[type^='application/json']")
          ).map(tag => JSON.parse(tag.innerText).targets)
          scriptTargets = scriptTargets.filter(el => el);
          scriptAds = scriptTargets.map(target => (target.redirectUrl || {}).finalUrl);
          scriptAds = scriptAds.filter(el => el);
          ads = ads.concat(frameAds, scriptAds);
        }
        return ads;
      })

      let hosts = [];

      await (async () => Promise.all(
        ads.map(async ad => {
          const page = await browser.newPage();
          await page.setRequestInterception(true);
          page.on('request', (request) => {
              if (['image', 'stylesheet', 'font', 'script'].indexOf(request.resourceType()) !== -1) {
                  request.abort();
              } else {
                  request.continue();
              }
          });

          await page.goto(ad, { timeout: 0 });

          const host = await page.evaluate(() => {
            window.stop();
            return window.location.host;
          });
          hosts.push(host);
          await page.close()
        })
      ))()

      hosts = [...new Set(hosts)];

      console.log("writing to document");

      writer.write(hosts.join("\n"));
      writer.write("\n");

      await page.close();

    });

    await browser.close();
  });

  writer.end();
})();
