const puppeteer = require("puppeteer");
const fs = require('fs');

const CHROME_SETTINGS = {
  headless: false,
  args: [ "--disable-web-security" ]
};

const N_VISITS_PER_USER = 100;

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

let session = 1;

(async () => {
  const writer = fs.createWriteStream("hosts.csv");
  writer.write('company,profile,session\n');

  await asyncForEach(["ryan", "ben"], async (user) => {
    console.log(`mocking ${user}`);

    const settings = Object.assign({}, CHROME_SETTINGS, {
      userDataDir: 'C:\\Users\\Ryan\\AppData\\Local\\Google\\Chrome\\User Data',
      ignoreDefaultArgs: ['--disable-extensions'],
      executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
    })

    const browser = await puppeteer.launch(settings);
    await asyncForEach(new Array(N_VISITS_PER_USER), async (_, idx) => {

      console.log(idx);

      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });

      console.log("opened page");
      try {
        await page.goto("https://townhall.com/", { waituntil: "networkidle0" });
        await page.waitFor("iframe");
      }
      catch(exception){}

      console.log("sent request");
      const ads = await page.evaluate(() => {
        ads = [];
        iframes =  Array.from(document.getElementsByTagName("iframe"));
        while(iframes.length > 0) {
          currentFrame = iframes.shift();
          subframes = Array.from(currentFrame.contentWindow.document.getElementsByTagName("iframe"));
          iframes = iframes.concat(subframes);
          frameAds = Array.from(
            currentFrame.contentWindow.document.querySelectorAll("a[href^='https://www.googleadservices.com']")
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

          try {
            const host = await page.evaluate(() => {
              window.stop();
              return window.location.host;
            });
            hosts.push(host);
          }
          catch(error) {}
          await page.close()
        })
      ))()

      hosts = [...new Set(hosts)];

      console.log("writing to document");

      hosts.forEach(h => {
        writer.write(h + ',ryan,' + session.toString() + '\n')
      });

      // writer.write(hosts.join("\n"));
      // writer.write("\n");

      await page.close();
      session += 1;
    });

    await browser.close();
  });

  writer.end();
})();
