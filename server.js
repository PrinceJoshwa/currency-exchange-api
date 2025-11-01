// server.js
require('dotenv').config(); // ✅ Load .env variables first

const express = require('express');
const bodyParser = require('body-parser');
const Scraper = require('./scraper');
const DB = require('./db');

const app = express();
app.use(bodyParser.json());

// Use REGION from .env or default to 'AR'
const REGION = (process.env.REGION || 'AR').toUpperCase(); // AR or BR
const PORT = process.env.PORT || 3000;

const scraper = new Scraper(REGION);
const db = new DB('quotes.db');

// simple in-memory cache metadata
let lastFetchedAt = 0;
let lastQuotes = [];

async function ensureFreshQuotes(maxAgeSeconds = 60) {
  const now = Date.now();
  if (now - lastFetchedAt <= maxAgeSeconds * 1000 && lastQuotes.length > 0) {
    return lastQuotes;
  }
  
  try {
    // fetch fresh from sources with timeout
    const results = await Promise.race([
      scraper.fetchAllSources(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Scraping timeout')), 25000)
      )
    ]);
    
    const successful = results.filter(r => r.ok);
    const saved = successful.map(r => {
      const obj = {
        buy_price: r.data.buy_price,
        sell_price: r.data.sell_price,
        source: r.source,
        fetched_at: new Date().toISOString(),
        raw: JSON.stringify(r.raw || null)
      };
      db.insertQuote(obj);
      return obj;
    });
    
    lastQuotes = saved;
    lastFetchedAt = Date.now();
    return results; // return raw results so we can show errors too
  } catch (error) {
    console.error('Error fetching quotes:', error);
    // Return cached data if available, otherwise empty array
    return lastQuotes.length > 0 ? lastQuotes : [];
  }
}

app.get('/quotes', async (req, res) => {
  try {
    const results = await ensureFreshQuotes(60);
    res.json(results);
  } catch (err) {
    console.error('Error in /quotes:', err);
    res.status(500).json({ error: 'Failed to fetch quotes', details: err.message });
  }
});

app.get('/average', async (req, res) => {
  try {
    const results = await ensureFreshQuotes(60);
    const succeeded = results.filter(r => r.ok).map(r => r.data);
    if (succeeded.length === 0) {
      return res.status(500).json({ error: 'No successful quotes available' });
    }
    const avgBuy = succeeded.reduce((s, q) => s + q.buy_price, 0) / succeeded.length;
    const avgSell = succeeded.reduce((s, q) => s + q.sell_price, 0) / succeeded.length;
    res.json({
      average_buy_price: Number(avgBuy.toFixed(6)),
      average_sell_price: Number(avgSell.toFixed(6)),
      count: succeeded.length
    });
  } catch (err) {
    console.error('Error in /average:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/slippage', async (req, res) => {
  try {
    const results = await ensureFreshQuotes(60);
    const succeeded = results.filter(r => r.ok);
    const dataOnly = succeeded.map(r => ({
      source: r.source,
      buy_price: r.data.buy_price,
      sell_price: r.data.sell_price
    }));
    if (dataOnly.length === 0) return res.status(500).json({ error: 'No successful quotes' });

    const avgBuy = dataOnly.reduce((s, q) => s + q.buy_price, 0) / dataOnly.length;
    const avgSell = dataOnly.reduce((s, q) => s + q.sell_price, 0) / dataOnly.length;

    const slippage = dataOnly.map(q => ({
      source: q.source,
      buy_price_slippage: Number(((q.buy_price - avgBuy) / avgBuy).toFixed(6)),
      sell_price_slippage: Number(((q.sell_price - avgSell) / avgSell).toFixed(6))
    }));

    res.json({ average_buy_price: avgBuy, average_sell_price: avgSell, slippage });
  } catch (err) {
    console.error('Error in /slippage:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => {
  res.json({
    message: 'Currency quotes API',
    region: REGION,
    endpoints: ['/quotes', '/average', '/slippage', '/health'],
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    region: REGION,
    lastFetch: lastFetchedAt ? new Date(lastFetchedAt).toISOString() : 'never',
    cachedQuotes: lastQuotes.length,
    uptime: process.uptime()
  });
});

app.listen(PORT, () => {
  console.log(`✅ Server listening on port ${PORT} (REGION=${REGION})`);
});
