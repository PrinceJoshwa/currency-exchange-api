// // db.js
// const Database = require('better-sqlite3');

// class DB {
//   constructor(filename = ':memory:') {
//     this.db = new Database(filename);
//     this.db.exec(`
//       CREATE TABLE IF NOT EXISTS quotes (
//         id INTEGER PRIMARY KEY AUTOINCREMENT,
//         source TEXT,
//         buy_price REAL,
//         sell_price REAL,
//         fetched_at TEXT,
//         raw TEXT
//       );
//     `);
//     this.insertStmt = this.db.prepare(`INSERT INTO quotes (source, buy_price, sell_price, fetched_at, raw) VALUES (@source, @buy_price, @sell_price, @fetched_at, @raw)`);
//     this.recentStmt = this.db.prepare(`SELECT * FROM quotes ORDER BY fetched_at DESC LIMIT ?`);
//   }

//   insertQuote(obj) {
//     this.insertStmt.run({
//       source: obj.source,
//       buy_price: obj.buy_price,
//       sell_price: obj.sell_price,
//       fetched_at: obj.fetched_at,
//       raw: obj.raw
//     });
//   }

//   recent(n = 10) {
//     return this.recentStmt.all(n);
//   }
// }

// module.exports = DB;

// db.js
// In-memory storage for serverless environments like Vercel
// SQLite files don't persist in serverless functions

class DB {
  constructor(filename = "quotes.db") {
    // Use in-memory storage for production compatibility
    this.quotes = [];
    console.log("✅ Using in-memory storage for quotes");
  }

  insertQuote(obj) {
    try {
      // Keep only last 100 quotes to prevent memory issues
      if (this.quotes.length >= 100) {
        this.quotes = this.quotes.slice(-50); // Keep last 50
      }
      
      this.quotes.push({
        id: Date.now() + Math.random(), // Simple ID generation
        source: obj.source,
        buy_price: obj.buy_price,
        sell_price: obj.sell_price,
        fetched_at: obj.fetched_at,
        raw: obj.raw
      });
      
      console.log(`✅ Quote inserted from ${obj.source}`);
    } catch (err) {
      console.error("❌ Insert failed:", err.message);
    }
  }

  recent(n = 10) {
    return new Promise((resolve) => {
      // Return most recent quotes
      const recent = this.quotes
        .sort((a, b) => new Date(b.fetched_at) - new Date(a.fetched_at))
        .slice(0, n);
      resolve(recent);
    });
  }
}

module.exports = DB;
