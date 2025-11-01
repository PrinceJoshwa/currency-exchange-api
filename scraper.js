// scraper.js
// Uses Puppeteer to scrape configured sources. Add or adjust selectors per site.

const puppeteer = require('puppeteer');
const FallbackScraper = require('./fallback-scraper');

const SOURCE_DEFINITIONS = {
  AR: [
    { url: 'https://www.ambito.com/contenidos/dolar.html', name: 'ambito' },
    { url: 'https://www.dolarhoy.com', name: 'dolarhoy' },
    { url: 'https://www.cronista.com/MercadosOnline/moneda.html?id=ARSB', name: 'cronista' }
  ],
  BR: [
    { url: 'https://wise.com/es/currency-converter/brl-to-usd-rate', name: 'wise' },
    { url: 'https://nubank.com.br/taxas-conversao/', name: 'nubank' },
    { url: 'https://www.nomadglobal.com', name: 'nomad' }
  ]
};

class Scraper {
  constructor(region = 'AR') {
    this.region = region;
    this.sources = SOURCE_DEFINITIONS[region] || [];
  }

  async fetchOne(page, source) {
    const url = source.url;
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      // NOTE: sites change frequently. Replace the selector logic below with
      // the selectors you find by inspecting the actual site.
      // I'll attempt generic patterns, but you should refine them in real runs.

      // heuristics: try to find numeric values in page text near "compra" or "venta" or "$"
      const result = await page.evaluate(() => {
        const text = document.body.innerText || '';
        return text.slice(0, 3000); // return a snippet for debugging
      });

      // naive parser: find all numbers with decimals in the page and pick top 2 (this is fragile)
      const numbers = (result.match(/[\d]{1,3}(?:[.,]\d{2,4})?/g) || [])
        .map(s => s.replace(/\./g, '').replace(',', '.')) // unify thousands/comma
        .map(Number)
        .filter(n => !isNaN(n));

      // Pick heuristically:
      let buy_price = null, sell_price = null;
      if (numbers.length >= 2) {
        buy_price = numbers[0];
        sell_price = numbers[1];
      } else if (numbers.length === 1) {
        buy_price = sell_price = numbers[0];
      } else {
        // fallback: try meta tag rate if present
        const metas = Array.from(document.querySelectorAll('meta')).map(m => m.getAttribute('content') || '');
        const metaNums = metas.join(' ').match(/[\d]{1,3}(?:[.,]\d{2,4})?/g) || [];
        if (metaNums.length) {
          buy_price = sell_price = Number(metaNums[0].replace(/\./g, '').replace(',', '.'));
        }
      }

      if (buy_price == null || sell_price == null) {
        // let caller know we couldn't extract
        return { ok: false, source: url, error: 'Could not parse numeric rates', raw: result };
      }

      return {
        ok: true,
        source: url,
        data: { buy_price, sell_price },
        raw: result
      };
    } catch (err) {
      return { ok: false, source: url, error: err.message };
    }
  }

  async fetchAllSources() {
    try {
      // Production-friendly Puppeteer config for Vercel
      const browser = await puppeteer.launch({
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ],
        headless: 'new'
      });

      try {
        const page = await browser.newPage();
        // set user agent to reduce bot-blocking
        await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36');
        // fetch all sequentially or parallel by opening multiple pages
        const tasks = this.sources.map(async src => {
          const p = await browser.newPage();
          try {
            const res = await this.fetchOne(p, src);
            await p.close();
            return res;
          } catch (err) {
            await p.close();
            return { ok: false, source: src.url, error: err.message };
          }
        });
        const results = await Promise.all(tasks);
        await page.close().catch(() => { });
        return results;
      } finally {
        await browser.close();
      }
    } catch (puppeteerError) {
      console.warn('Puppeteer failed, using fallback scraper:', puppeteerError.message);
      // Use fallback scraper when Puppeteer fails
      const fallback = new FallbackScraper(this.region);
      return await fallback.fetchMockData();
    }
  }
}

module.exports = Scraper;
