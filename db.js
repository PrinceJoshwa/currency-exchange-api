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
const sqlite3 = require("sqlite3").verbose();

class DB {
  constructor(filename = ":memory:") {
    this.db = new sqlite3.Database(filename, (err) => {
      if (err) console.error("Error opening database:", err.message);
      else {
        this.db.run(`
          CREATE TABLE IF NOT EXISTS quotes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source TEXT,
            buy_price REAL,
            sell_price REAL,
            fetched_at TEXT,
            raw TEXT
          )
        `);
      }
    });
  }

  insertQuote(obj) {
    const sql = `INSERT INTO quotes (source, buy_price, sell_price, fetched_at, raw)
                 VALUES (?, ?, ?, ?, ?)`;
    this.db.run(sql, [obj.source, obj.buy_price, obj.sell_price, obj.fetched_at, obj.raw], (err) => {
      if (err) console.error("Insert error:", err.message);
    });
  }

  recent(n = 10, callback) {
    const sql = `SELECT * FROM quotes ORDER BY fetched_at DESC LIMIT ?`;
    this.db.all(sql, [n], (err, rows) => {
      if (err) {
        console.error("Query error:", err.message);
        callback([]);
      } else {
        callback(rows);
      }
    });
  }
}

module.exports = DB;
