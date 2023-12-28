// db.js
const mysql = require("mysql");

const connection = mysql.createConnection({
  host: "localhost",
  user: "admin_rp", // Replace with your MySQL username
  password: "B@judit0k02018", // Replace with your MySQL password
  database: "gbs685_absensi", // Replace with your database name
});

connection.connect((err) => {
  if (err) {
    console.error("Error connecting to database:", err);
    return;
  }
  console.log("Connected to MySQL database!");
});

module.exports = connection;
