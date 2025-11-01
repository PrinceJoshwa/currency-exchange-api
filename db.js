// db.js
const Database = require('better-sqlite3');

class DB {
  constructor(filename = ':memory:') {
    this.db = new Database(filename);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS quotes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT,
        buy_price REAL,
        sell_price REAL,
        fetched_at TEXT,
        raw TEXT
      );
    `);
    this.insertStmt = this.db.prepare(`INSERT INTO quotes (source, buy_price, sell_price, fetched_at, raw) VALUES (@source, @buy_price, @sell_price, @fetched_at, @raw)`);
    this.recentStmt = this.db.prepare(`SELECT * FROM quotes ORDER BY fetched_at DESC LIMIT ?`);
  }

  insertQuote(obj) {
    this.insertStmt.run({
      source: obj.source,
      buy_price: obj.buy_price,
      sell_price: obj.sell_price,
      fetched_at: obj.fetched_at,
      raw: obj.raw
    });
  }

  recent(n = 10) {
    return this.recentStmt.all(n);
  }
}

module.exports = DB;
