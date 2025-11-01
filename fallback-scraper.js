// fallback-scraper.js
// Simple HTTP-based scraper as fallback when Puppeteer fails

const https = require('https');
const http = require('http');

class FallbackScraper {
  constructor(region = 'AR') {
    this.region = region;
  }

  async fetchWithHttp(url) {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https:') ? https : http;
      const req = client.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          // Simple regex to find currency values
          const numbers = data.match(/[\d]{2,4}[.,]\d{2,4}/g) || [];
          const prices = numbers
            .map(n => parseFloat(n.replace(',', '.')))
            .filter(n => n > 50 && n < 2000); // reasonable USD/ARS range
          
          if (prices.length >= 2) {
            resolve({
              ok: true,
              source: url,
              data: {
                buy_price: prices[0],
                sell_price: prices[1]
              }
            });
          } else {
            resolve({
              ok: false,
              source: url,
              error: 'Could not parse prices from HTML'
            });
          }
        });
      });
      
      req.on('error', err => {
        resolve({
          ok: false,
          source: url,
          error: err.message
        });
      });
      
      req.on('timeout', () => {
        req.destroy();
        resolve({
          ok: false,
          source: url,
          error: 'Request timeout'
        });
      });
    });
  }

  async fetchMockData() {
    // Fallback mock data for when all scraping fails
    const baseRate = this.region === 'AR' ? 1000 : 5.5;
    const variation = Math.random() * 0.1 - 0.05; // ±5% variation
    
    return [{
      ok: true,
      source: 'fallback-mock',
      data: {
        buy_price: baseRate * (1 + variation),
        sell_price: baseRate * (1 + variation + 0.02)
      }
    }];
  }
}

module.exports = FallbackScraper;