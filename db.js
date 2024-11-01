// db.js
const mysql = require('mysql');

const connection = mysql.createPool({
  host: 'localhost',
  user: 'admin_absen',
  password: 'B@judit0k02018',
  database: 'gbs685_absensi',
  connectTimeout: 20000,
});

connection.getConnection((err, conn) => {
  if (err) {
    console.error('Error connecting to database:', err);
    return;
  }
  console.log('Connected to MySQL database!');

  // If you need to perform any initial queries, you can do it here using 'connection'

  // Release the connection back to the pool when done
  conn.release();
});

// Export the pool instead of a single connection
module.exports = connection;
