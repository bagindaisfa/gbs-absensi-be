var express = require("express");
const cors = require("cors");
const multer = require("multer");
const db = require("./db");
var app = express();
var port = process.env.PORT || 3001;
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Routes

app.get("/", function (req, res) {
  res.send("Hello World! Ini adalah Website Express.js pertama saya");
});

app.get("/absensi", (req, res) => {
  let { start_date, end_date } = req.query;
  const query = `SELECT
                  absensi.id,
                  master_lokasi.nama_lokasi AS lokasi,
                  absensi.foto,
                  absensi.lampiran,
                  master_karyawan.nama,
                  absensi.alasan,
                  CASE
                    WHEN absensi.id_shift = 0 AND absensi.status = 'Hadir'
                        THEN CONCAT('Backup Shift ', (SELECT shift FROM master_shift WHERE TIME(absensi.timestamp) >= jam_masuk AND id_lokasi = absensi.id_lokasi ORDER BY jam_masuk DESC LIMIT 1))
                    WHEN absensi.id_shift = 0 AND absensi.status = 'Pulang'
                        THEN CONCAT('Backup Shift ', (SELECT shift FROM master_shift WHERE TIME(absensi.timestamp) >= jam_keluar AND TIME(absensi.timestamp) <= jam_keluar AND id_lokasi = absensi.id_lokasi ORDER BY jam_masuk DESC LIMIT 1))
                    WHEN absensi.id_shift != 0 AND (absensi.status = 'Izin' OR absensi.status = 'Sakit')
                    	THEN CONCAT(absensi.status, ' Shift ', master_shift.shift)
                    WHEN absensi.id_shift = 0 AND (absensi.status = 'Izin' OR absensi.status = 'Sakit')
                    	THEN CONCAT(absensi.status, ' non-Shift')
                    ELSE master_shift.shift
                  END AS shift,
                  absensi.lat,
                  absensi.long,
                  CASE DAYNAME(dates.tanggal)
                      WHEN 'Sunday' THEN 'Minggu'
                      WHEN 'Monday' THEN 'Senin'
                      WHEN 'Tuesday' THEN 'Selasa'
                      WHEN 'Wednesday' THEN 'Rabu'
                      WHEN 'Thursday' THEN 'Kamis'
                      WHEN 'Friday' THEN 'Jumat'
                      WHEN 'Saturday' THEN 'Sabtu'
                      ELSE DAYNAME(dates.tanggal)
                  END AS day_name,
                  dates.tanggal AS tanggal_range,
                  IFNULL(absensi.timestamp, '-') AS timestamp,
                  CASE
                  	WHEN absensi.status IS NULL AND (SELECT master_shift.shift FROM shift_karyawan LEFT JOIN master_shift ON shift_karyawan.id_shift=master_shift.id WHERE shift_karyawan.id_lokasi=master_lokasi.id AND shift_karyawan.id_karyawan=master_karyawan.id AND dates.tanggal BETWEEN shift_karyawan.start_date AND shift_karyawan.end_date) = 0
                    	THEN 'Libur'
                  WHEN absensi.status IS NULL AND (SELECT master_shift.shift FROM shift_karyawan LEFT JOIN master_shift ON shift_karyawan.id_shift=master_shift.id WHERE shift_karyawan.id_lokasi=master_lokasi.id AND shift_karyawan.id_karyawan=master_karyawan.id AND dates.tanggal BETWEEN shift_karyawan.start_date AND shift_karyawan.end_date) <> 0
                  	THEN 'Tidak Hadir'
                  WHEN absensi.status IS NULL AND (SELECT master_shift.shift FROM shift_karyawan LEFT JOIN master_shift ON shift_karyawan.id_shift=master_shift.id WHERE shift_karyawan.id_lokasi=master_lokasi.id AND shift_karyawan.id_karyawan=master_karyawan.id AND dates.tanggal BETWEEN shift_karyawan.start_date AND shift_karyawan.end_date) IS NULL
                  	THEN 'Tidak Hadir'
                  ELSE absensi.status
                  END AS status,
                  CASE
                      WHEN absensi.status = 'Hadir' AND TIME(absensi.timestamp) <= ADDTIME(master_shift.jam_masuk, SEC_TO_TIME(master_lokasi.toleransi * 60)) 
                          THEN 'Tepat Waktu'
                      WHEN absensi.status = 'Hadir' AND TIME(absensi.timestamp) > ADDTIME(master_shift.jam_masuk, SEC_TO_TIME(master_lokasi.toleransi * 60)) 
                          THEN 'Terlambat'
                      WHEN absensi.status = 'Pulang' AND TIME(absensi.timestamp) >= TIMEDIFF(master_shift.jam_keluar, SEC_TO_TIME(master_lokasi.toleransi * 60)) AND TIME(absensi.timestamp) <= ADDTIME(master_shift.jam_keluar, SEC_TO_TIME(master_lokasi.toleransi * 60))
                          THEN 'Tepat Waktu' 
                      WHEN absensi.status = 'Pulang' AND TIME(absensi.timestamp) > ADDTIME(master_shift.jam_keluar, SEC_TO_TIME(master_lokasi.toleransi * 60))
                          THEN 'Lembur'
                      WHEN absensi.status = 'Pulang' AND TIME(absensi.timestamp) < TIMEDIFF(master_shift.jam_keluar, SEC_TO_TIME(master_lokasi.toleransi * 60))
                          THEN 'Pulang Lebih Awal'
                      WHEN absensi.status = 'Hadir' AND absensi.id_shift = 0
                        THEN 'Backup'
                      WHEN absensi.status = 'Pulang' AND absensi.id_shift = 0
                        THEN 'Backup'
                      WHEN absensi.status LIKE '%Izin%' OR absensi.status LIKE '%Sakit%'
                          THEN absensi.status
                      WHEN master_shift.shift = 0
                          THEN 'Libur'
                      WHEN absensi.status IS NULL AND (SELECT master_shift.shift FROM shift_karyawan LEFT JOIN master_shift ON shift_karyawan.id_shift=master_shift.id WHERE shift_karyawan.id_lokasi=master_lokasi.id AND shift_karyawan.id_karyawan=master_karyawan.id AND dates.tanggal BETWEEN shift_karyawan.start_date AND shift_karyawan.end_date) = 0
                    	THEN 'Libur'
                      ELSE 'Tanpa Keterangan'
                  END AS keterangan
                FROM
                  (
                      SELECT DATE_ADD('${start_date}', INTERVAL n DAY) AS tanggal
                      FROM (
                          SELECT (a.N + b.N * 10) AS n
                          FROM
                              (SELECT 0 AS N UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) a,
                              (SELECT 0 AS N UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4) b
                      ) numbers
                      WHERE DATE_ADD('${start_date}', INTERVAL n DAY) <= '${end_date}'
                  ) AS dates
                CROSS JOIN master_karyawan
                LEFT JOIN master_lokasi ON master_karyawan.id_lokasi = master_lokasi.id
                LEFT JOIN shift_karyawan ON master_karyawan.id = shift_karyawan.id_karyawan AND dates.tanggal BETWEEN shift_karyawan.start_date AND shift_karyawan.end_date
                LEFT JOIN absensi ON shift_karyawan.id_karyawan = absensi.id_karyawan AND DATE(absensi.timestamp) = dates.tanggal OR (master_karyawan.id = absensi.id_karyawan AND absensi.id_shift = 0 AND DATE(absensi.timestamp) = dates.tanggal)
                LEFT JOIN master_shift ON master_lokasi.id = master_shift.id_lokasi AND absensi.id_shift = master_shift.id
                ORDER BY dates.tanggal ASC;`;

  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching absensi:", err);
      res.status(500).json({ error: "Internal server error" });
      return;
    }
    res.json({ absensi: results });
  });
});

app.get("/absensibylokasi", (req, res) => {
  let { start_date, end_date, id_lokasi } = req.query;
  const query = `SELECT
                  absensi.id,
                  master_lokasi.nama_lokasi AS lokasi,
                  absensi.foto,
                  absensi.lampiran,
                  master_karyawan.nama,
                  absensi.alasan,
                  CASE
                    WHEN absensi.id_shift = 0 AND absensi.status = 'Hadir'
                        THEN CONCAT('Backup Shift ', (SELECT shift FROM master_shift WHERE TIME(absensi.timestamp) >= jam_masuk AND id_lokasi = absensi.id_lokasi ORDER BY jam_masuk DESC LIMIT 1))
                    WHEN absensi.id_shift = 0 AND absensi.status = 'Pulang'
                        THEN CONCAT('Backup Shift ', (SELECT shift FROM master_shift WHERE TIME(absensi.timestamp) >= jam_keluar AND TIME(absensi.timestamp) <= jam_keluar AND id_lokasi = absensi.id_lokasi ORDER BY jam_masuk DESC LIMIT 1))
                    WHEN absensi.id_shift != 0 AND (absensi.status = 'Izin' OR absensi.status = 'Sakit')
                    	THEN CONCAT(absensi.status, ' Shift ', master_shift.shift)
                    WHEN absensi.id_shift = 0 AND (absensi.status = 'Izin' OR absensi.status = 'Sakit')
                    	THEN CONCAT(absensi.status, ' non-Shift')
                    ELSE master_shift.shift
                  END AS shift,
                  absensi.lat,
                  absensi.long,
                  CASE DAYNAME(dates.tanggal)
                      WHEN 'Sunday' THEN 'Minggu'
                      WHEN 'Monday' THEN 'Senin'
                      WHEN 'Tuesday' THEN 'Selasa'
                      WHEN 'Wednesday' THEN 'Rabu'
                      WHEN 'Thursday' THEN 'Kamis'
                      WHEN 'Friday' THEN 'Jumat'
                      WHEN 'Saturday' THEN 'Sabtu'
                      ELSE DAYNAME(dates.tanggal)
                  END AS day_name,
                  dates.tanggal AS tanggal_range,
                  IFNULL(absensi.timestamp, '-') AS timestamp,
                  CASE
                  	WHEN absensi.status IS NULL AND (SELECT master_shift.shift FROM shift_karyawan LEFT JOIN master_shift ON shift_karyawan.id_shift=master_shift.id WHERE shift_karyawan.id_lokasi=master_lokasi.id AND shift_karyawan.id_karyawan=master_karyawan.id AND dates.tanggal BETWEEN shift_karyawan.start_date AND shift_karyawan.end_date) = 0
                    	THEN 'Libur'
                  WHEN absensi.status IS NULL AND (SELECT master_shift.shift FROM shift_karyawan LEFT JOIN master_shift ON shift_karyawan.id_shift=master_shift.id WHERE shift_karyawan.id_lokasi=master_lokasi.id AND shift_karyawan.id_karyawan=master_karyawan.id AND dates.tanggal BETWEEN shift_karyawan.start_date AND shift_karyawan.end_date) <> 0
                  	THEN 'Tidak Hadir'
                  WHEN absensi.status IS NULL AND (SELECT master_shift.shift FROM shift_karyawan LEFT JOIN master_shift ON shift_karyawan.id_shift=master_shift.id WHERE shift_karyawan.id_lokasi=master_lokasi.id AND shift_karyawan.id_karyawan=master_karyawan.id AND dates.tanggal BETWEEN shift_karyawan.start_date AND shift_karyawan.end_date) IS NULL
                  	THEN 'Tidak Hadir'
                  ELSE absensi.status
                  END AS status,
                  CASE
                      WHEN absensi.status = 'Hadir' AND TIME(absensi.timestamp) <= ADDTIME(master_shift.jam_masuk, SEC_TO_TIME(master_lokasi.toleransi * 60)) 
                          THEN 'Tepat Waktu'
                      WHEN absensi.status = 'Hadir' AND TIME(absensi.timestamp) > ADDTIME(master_shift.jam_masuk, SEC_TO_TIME(master_lokasi.toleransi * 60)) 
                          THEN 'Terlambat'
                      WHEN absensi.status = 'Pulang' AND TIME(absensi.timestamp) >= TIMEDIFF(master_shift.jam_keluar, SEC_TO_TIME(master_lokasi.toleransi * 60)) AND TIME(absensi.timestamp) <= ADDTIME(master_shift.jam_keluar, SEC_TO_TIME(master_lokasi.toleransi * 60))
                          THEN 'Tepat Waktu' 
                      WHEN absensi.status = 'Pulang' AND TIME(absensi.timestamp) > ADDTIME(master_shift.jam_keluar, SEC_TO_TIME(master_lokasi.toleransi * 60))
                          THEN 'Lembur'
                      WHEN absensi.status = 'Pulang' AND TIME(absensi.timestamp) < TIMEDIFF(master_shift.jam_keluar, SEC_TO_TIME(master_lokasi.toleransi * 60))
                          THEN 'Pulang Lebih Awal'
                      WHEN absensi.status = 'Hadir' AND absensi.id_shift = 0
                        THEN 'Backup'
                      WHEN absensi.status = 'Pulang' AND absensi.id_shift = 0
                        THEN 'Backup'
                      WHEN absensi.status LIKE '%Izin%' OR absensi.status LIKE '%Sakit%'
                          THEN absensi.status
                      WHEN master_shift.shift = 0
                          THEN 'Libur'
                      WHEN absensi.status IS NULL AND (SELECT master_shift.shift FROM shift_karyawan LEFT JOIN master_shift ON shift_karyawan.id_shift=master_shift.id WHERE shift_karyawan.id_lokasi=master_lokasi.id AND shift_karyawan.id_karyawan=master_karyawan.id AND dates.tanggal BETWEEN shift_karyawan.start_date AND shift_karyawan.end_date) = 0
                    	THEN 'Libur'
                      ELSE 'Tanpa Keterangan'
                  END AS keterangan
                FROM
                  (
                      SELECT DATE_ADD('${start_date}', INTERVAL n DAY) AS tanggal
                      FROM (
                          SELECT (a.N + b.N * 10) AS n
                          FROM
                              (SELECT 0 AS N UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) a,
                              (SELECT 0 AS N UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4) b
                      ) numbers
                      WHERE DATE_ADD('${start_date}', INTERVAL n DAY) <= '${end_date}'
                  ) AS dates
                CROSS JOIN master_karyawan
                LEFT JOIN master_lokasi ON master_karyawan.id_lokasi = master_lokasi.id
                LEFT JOIN shift_karyawan ON master_karyawan.id = shift_karyawan.id_karyawan AND dates.tanggal BETWEEN shift_karyawan.start_date AND shift_karyawan.end_date
                LEFT JOIN absensi ON shift_karyawan.id_karyawan = absensi.id_karyawan AND DATE(absensi.timestamp) = dates.tanggal OR (master_karyawan.id = absensi.id_karyawan AND absensi.id_shift = 0 AND DATE(absensi.timestamp) = dates.tanggal)
                LEFT JOIN master_shift ON master_lokasi.id = master_shift.id_lokasi AND absensi.id_shift = master_shift.id
                WHERE master_lokasi.id = ${id_lokasi}
                ORDER BY dates.tanggal, master_karyawan.nama ASC;`;

  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching absensi:", err);
      res.status(500).json({ error: "Internal server error" });
      return;
    }
    res.json({ absensi: results });
  });
});

app.post("/absensi", upload.single("foto"), async (req, res) => {
  try {
    const {
      id_karyawan,
      status,
      latitude,
      longitude,
      id_shift,
      id_lokasi,
      alasan,
      hari_izin,
    } = req.body;

    let validate = true;
    const now = await getCurrentDateTime();
    const dateNow = await getCurrentDate();
    const { lat, long } = await getLocation(id_lokasi);

    // Calculate distance between the two coordinates
    const distance = getDistanceBetweenPoints(lat, long, latitude, longitude);
    const jarak = number_format(distance.kilometers, 2);

    if (status === "Pulang") {
      if (id_shift === 0) {
        const idShift = await getShift(id_lokasi, id_karyawan, dateNow);
        validate = await getValidateTimeStamp(idShift);
        console.log("idShift:", idShift);
      } else {
        validate = await getValidateTimeStamp(id_shift);
      }
    }

    // Check if the distance is within 100 meters
    if (jarak <= 0.05) {
      let photo = null;
      if (req.file) {
        photo = req.file.buffer; // The file buffer containing the photo
      }

      const sqlQuery =
        "INSERT INTO absensi (timestamp,id_karyawan,id_lokasi,id_shift,status,lampiran,foto,lat,`long`,alasan) VALUES (?,?,?,?,?,?,?,?,?,?)";

      db.query(
        sqlQuery,
        [
          now,
          id_karyawan,
          id_lokasi,
          id_shift,
          status,
          status.includes("Izin") ? photo : null,
          status.includes("Izin") ? null : photo,
          latitude,
          longitude,
          alasan,
        ],
        (err, results) => {
          if (err) {
            console.error("Error insert absensi:", err);
            res.status(500).json({ error: "Internal server error" });
            return;
          }
          res.json({ absensi: results });
        }
      );
    } else if (jarak >= 0.05 && (status === "Izin" || status === "Sakit")) {
      const days = JSON.parse(hari_izin);
      if (days.length > 0) {
        try {
          for (let i = 0; i < days.length; i++) {
            const hariIzin = await getIzintDateTime(days[i]);
            const id_shift = await getShift(id_lokasi, id_karyawan, days[i]);
            let photo = null;
            if (req.file) {
              photo = req.file.buffer; // The file buffer containing the photo
            }

            const sqlQuery = `
              INSERT INTO absensi (timestamp, id_karyawan, id_lokasi, id_shift, status, lampiran, foto, alasan) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;

            // Wrap the database query in a promise for easier handling
            const executeQuery = () => {
              return new Promise((resolve, reject) => {
                db.query(
                  sqlQuery,
                  [
                    hariIzin,
                    id_karyawan,
                    id_lokasi,
                    id_shift ? id_shift : 0,
                    status,
                    photo,
                    null,
                    alasan,
                  ],
                  (err, results) => {
                    if (err) {
                      console.error("Error insert absensi:", err);
                      reject(err);
                    } else {
                      resolve(results);
                    }
                  }
                );
              });
            };

            // Execute the database query
            await executeQuery();
          }

          res.json({ message: "Absensi inserted successfully" });
        } catch (error) {
          console.error("Error:", error);
          res.status(500).json({ error: "Internal server error" });
        }
      } else {
        res.json({ message: "No dates provided for absensi" });
      }
    } else {
      console.error("Jarak tidak tepat:", latitude + ", " + longitude);
      res.status(500).json({
        error: `Kamu sejauh ${jarak} kilometers dari lokasi yang valid.`,
      });
    }
  } catch (err) {
    res.status(500).json({ error: err });
  }
});

app.get("/karyawan", (req, res) => {
  db.query("SELECT * FROM master_karyawan", (err, results) => {
    if (err) {
      console.error("Error fetching karyawan:", err);
      res.status(500).json({ error: "Internal server error" });
      return;
    }
    res.json({ karyawan: results });
  });
});

app.get("/karyawanList", (req, res) => {
  db.query(
    "SELECT master_karyawan.*,master_lokasi.nama_lokasi FROM master_karyawan LEFT JOIN master_lokasi ON master_karyawan.id_lokasi = master_lokasi.id;",
    (err, results) => {
      if (err) {
        console.error("Error fetching karyawan:", err);
        res.status(500).json({ error: "Internal server error" });
        return;
      }
      res.json({ karyawan: results });
    }
  );
});

app.post("/karyawan", async (req, res) => {
  const { nama, id_lokasi, shift } = req.query;
  const shift_data = JSON.parse(shift);
  const sqlQuery = "INSERT INTO master_karyawan (nama, id_lokasi) VALUES(?,?)";
  const sqlQueryShift =
    "INSERT INTO `shift_karyawan`( `id_shift`, `id_lokasi`, `id_karyawan`, `start_date`, `end_date`) VALUES (?,?,?,?,?)";

  db.query(sqlQuery, [nama, id_lokasi], (err, results) => {
    if (err) {
      console.error("Error insert karyawan:", err);
      res.status(500).json({ error: "Internal server error" });
      return;
    } else {
      for (let i = 0; i < shift_data.length; i++) {
        db.query(
          sqlQueryShift,
          [
            shift_data[i].id,
            id_lokasi,
            results.insertId,
            shift_data[i].dateRange[0],
            shift_data[i].dateRange[1],
          ],
          (err, results) => {
            if (err) {
              console.error("Error insert shift:", err);
            } else {
              console.log("Success insert shift:", results);
            }
          }
        );
      }
    }
    res.json({ karyawan: results });
  });
});

app.put("/karyawan", async (req, res) => {
  const { id, nama, id_lokasi, shift } = req.query;
  const shift_data = JSON.parse(shift);
  const sqlQuery = "UPDATE master_karyawan SET nama=?, id_lokasi=? WHERE id=?";
  const sqlQueryShift =
    "UPDATE `shift_karyawan` SET `id_shift`=?, `id_lokasi`=?, `id_karyawan`=?, `start_date`=?, `end_date`=? WHERE `id`=?";
  const sqlQueryDeleteShift = "DELETE FROM `shift_karyawan` WHERE `id`=?";
  const sqlQueryInsertShift =
    "INSERT INTO `shift_karyawan`( `id_shift`, `id_lokasi`, `id_karyawan`, `start_date`, `end_date`) VALUES (?,?,?,?,?)";
  db.query(sqlQuery, [nama, id_lokasi, id], (err, results) => {
    if (err) {
      console.error("Error update karyawan:", err);
      res.status(500).json({ error: "Internal server error" });
      return;
    } else {
      for (let i = 0; i < shift_data.length; i++) {
        if (shift_data[i].status && shift_data[i].status === "deleted") {
          db.query(
            sqlQueryDeleteShift,
            [shift_data[i].id_shift_karyawan],
            (err, results) => {
              if (err) {
                console.error("Error delete shift:", err);
              } else {
                console.log("Success delete shift:", results);
              }
            }
          );
        } else if (shift_data[i].status && shift_data[i].status === "new") {
          db.query(
            sqlQueryInsertShift,
            [
              shift_data[i].id,
              id_lokasi,
              id,
              shift_data[i].dateRange[0],
              shift_data[i].dateRange[1],
            ],
            (err, results) => {
              if (err) {
                console.error("Error insert shift:", err);
              } else {
                console.log("Success insert shift:", results);
              }
            }
          );
        } else {
          db.query(
            sqlQueryShift,
            [
              shift_data[i].id,
              id_lokasi,
              id,
              shift_data[i].dateRange[0],
              shift_data[i].dateRange[1],
              shift_data[i].id_shift_karyawan,
            ],
            (err, results) => {
              if (err) {
                console.error("Error update shift:", err);
              } else {
                console.log("Success insert shift:", results);
              }
            }
          );
        }
      }
    }
    res.json({ karyawan: results });
  });
});

app.get("/shiftkaryawan", (req, res) => {
  let { id_karyawan, id_lokasi } = req.query;
  db.query(
    `SELECT * FROM shift_karyawan WHERE id_lokasi=${id_lokasi} AND id_karyawan=${id_karyawan};`,
    (err, results) => {
      if (err) {
        console.error("Error fetching shiftkaryawan:", err);
        res.status(500).json({ error: "Internal server error" });
        return;
      }
      res.json({ shiftkaryawan: results });
    }
  );
});

app.get("/downloadjadwal", (req, res) => {
  let { month, id_lokasi } = req.query;
  db.query(
    `SELECT 
          shift_karyawan.id_karyawan,
          master_karyawan.nama,
          CASE
            WHEN master_shift.shift = 0
              THEN 'OFF'
            ELSE master_shift.shift 
          END AS shift,
          master_shift.jam_masuk,
          master_shift.jam_keluar,
          shift_karyawan.start_date,
          shift_karyawan.end_date
      FROM shift_karyawan
      LEFT JOIN master_karyawan ON shift_karyawan.id_karyawan = master_karyawan.id AND shift_karyawan.id_lokasi = master_karyawan.id_lokasi
      LEFT JOIN master_shift ON shift_karyawan.id_shift = master_shift.id AND shift_karyawan.id_lokasi = master_shift.id_lokasi
      WHERE shift_karyawan.id_lokasi = ${id_lokasi}
      AND (
          YEAR(STR_TO_DATE('${month}', '%Y-%m')) = YEAR(shift_karyawan.start_date)
          AND MONTH(STR_TO_DATE('${month}', '%Y-%m')) = MONTH(shift_karyawan.start_date)
      ) OR (
          YEAR(STR_TO_DATE('${month}', '%Y-%m')) = YEAR(shift_karyawan.end_date)
          AND MONTH(STR_TO_DATE('${month}', '%Y-%m')) = MONTH(shift_karyawan.end_date)
      );`,
    (err, results) => {
      if (err) {
        console.error("Error fetching jadwal:", err);
        res.status(500).json({ error: "Internal server error" });
        return;
      }
      res.json({ jadwal: results });
    }
  );
});

app.get("/users", (req, res) => {
  db.query("SELECT * FROM users", (err, results) => {
    if (err) {
      console.error("Error fetching users:", err);
      res.status(500).json({ error: "Internal server error" });
      return;
    }
    res.json({ users: results });
  });
});

app.post("/users", async (req, res) => {
  const { username, password, id_karyawan } = req.query;
  const sqlQuery = `INSERT INTO users (username,password,id_karyawan) VALUES (?,?,?)`;
  db.query(sqlQuery, [username, password, id_karyawan], (err, results) => {
    if (err) {
      console.error("Error insert users:", err);
      res.status(500).json({ error: "Internal server error" });
      return;
    }
    res.json({ users: results });
  });
});

app.put("/users", async (req, res) => {
  const { id, username, password, id_karyawan } = req.query;
  const sqlQuery = `UPDATE users SET username=?, password=?, id_karyawan=? WHERE id=?`;
  db.query(sqlQuery, [username, password, id_karyawan, id], (err, results) => {
    if (err) {
      console.error("Error update users:", err);
      res.status(500).json({ error: "Internal server error" });
      return;
    }
    res.json({ users: results });
  });
});

app.get("/lokasi", (req, res) => {
  db.query(
    `SELECT 
        master_lokasi.id AS id, 
        master_lokasi.nama_lokasi, 
        master_lokasi.toleransi, 
        master_shift.id AS id_shift,
        master_shift.shift,
        master_shift.jam_masuk, 
        master_shift.jam_keluar, 
        master_lokasi.lat, 
        master_lokasi.long 
    FROM master_lokasi 
    LEFT JOIN master_shift ON master_lokasi.id = master_shift.id_lokasi ORDER BY master_lokasi.nama_lokasi, master_shift.jam_masuk;`,
    (err, results) => {
      if (err) {
        console.error("Error fetching lokasi:", err);
        res.status(500).json({ error: "Internal server error" });
        return;
      }
      res.json({ lokasi: results });
    }
  );
});

app.get("/masterLokasi", (req, res) => {
  db.query("SELECT * FROM master_lokasi", (err, results) => {
    if (err) {
      console.error("Error fetching lokasi:", err);
      res.status(500).json({ error: "Internal server error" });
      return;
    }
    res.json({ lokasi: results });
  });
});

app.post("/lokasi", async (req, res) => {
  const { nama_lokasi, toleransi, lat, long } = req.query;
  const sqlQueryLokasi =
    "INSERT INTO master_lokasi (nama_lokasi,toleransi,lat,`long`) VALUES (?,?,?,?)";
  db.query(
    sqlQueryLokasi,
    [nama_lokasi, toleransi, lat, long],
    (err, results) => {
      if (err) {
        console.error("Error insert lokasi:", err);
        res.status(500).json({ error: "Internal server error" });
        return;
      }
      res.json({ lokasi: results });
    }
  );
});

app.put("/lokasi", async (req, res) => {
  const { id, nama_lokasi, toleransi, lat, long } = req.query;
  const sqlQueryLokasi =
    "UPDATE master_lokasi SET nama_lokasi=?, toleransi=?, lat=?,`long`=? WHERE id=?";
  db.query(
    sqlQueryLokasi,
    [nama_lokasi, toleransi, lat, long, id],
    (err, results) => {
      if (err) {
        console.error("Error update lokasi:", err);
        res.status(500).json({ error: "Internal server error" });
        return;
      }
      res.json({ lokasi: results });
    }
  );
});

app.get("/shift", (req, res) => {
  db.query(
    "SELECT master_shift.*,master_lokasi.nama_lokasi FROM master_shift LEFT JOIN master_lokasi ON master_shift.id_lokasi = master_lokasi.id ORDER BY master_lokasi.nama_lokasi, master_shift.shift;",
    (err, results) => {
      if (err) {
        console.error("Error fetching shift:", err);
        res.status(500).json({ error: "Internal server error" });
        return;
      }
      res.json({ shift: results });
    }
  );
});

app.get("/shiftoption", (req, res) => {
  const { id_lokasi } = req.query;
  db.query(
    `SELECT * FROM master_shift WHERE id_lokasi=${id_lokasi};`,
    (err, results) => {
      if (err) {
        console.error("Error fetching shift:", err);
        res.status(500).json({ error: "Internal server error" });
        return;
      }
      res.json({ shift: results });
    }
  );
});

app.post("/shift", async (req, res) => {
  const { id_lokasi, shift, jam_masuk, jam_keluar } = req.query;
  const sqlQueryShift = `INSERT INTO master_shift (id_lokasi,shift,jam_masuk,jam_keluar) VALUES (?,?,?,?)`;
  db.query(
    sqlQueryShift,
    [id_lokasi, shift, jam_masuk, jam_keluar],
    (err, results) => {
      if (err) {
        console.error("Error insert shift:", err);
        res.status(500).json({ error: "Internal server error" });
        return;
      }
      console.log(results);
      res.json({ users: results });
    }
  );
});

app.put("/shift", async (req, res) => {
  const { id, id_lokasi, shift, jam_masuk, jam_keluar } = req.query;
  const sqlQueryShift = `UPDATE master_shift SET id_lokasi=?, shift=?, jam_masuk=?, jam_keluar=? WHERE id=?`;
  db.query(
    sqlQueryShift,
    [id_lokasi, shift, jam_masuk, jam_keluar, id],
    (err, results) => {
      if (err) {
        console.error("Error update shift:", err);
        res.status(500).json({ error: "Internal server error" });
        return;
      }
      console.log(results);
      res.json({ shift: results });
    }
  );
});

app.get("/login", (req, res) => {
  let { username, password } = req.query;
  db.query(
    `SELECT users.*,master_karyawan.id_lokasi FROM users LEFT JOIN master_karyawan ON users.id_karyawan = master_karyawan.id WHERE users.username='${username}' AND users.password='${password}'`,
    async (err, results) => {
      if (err) {
        console.error("Error fetching lokasi:", err);
        res.status(500).json({ error: "Internal server error" });
        return;
      }

      if (results) {
        if (results.length > 0) {
          const current_absen = await getAbsensi(results[0].id_karyawan);
          const status_absen = current_absen
            ? current_absen.map((item) => {
                return item.status;
              })
            : [];
          res.json({
            valid: true,
            id_karyawan: results[0].id_karyawan,
            id_lokasi: results[0].id_lokasi,
            status_absen: status_absen,
          });
        } else {
          res.json({ valid: false });
        }
      }
    }
  );
});

// Function

async function getCurrentDateTime() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0"); // Month is zero-based
  const day = String(now.getDate()).padStart(2, "0");

  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

async function getCurrentDate() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0"); // Month is zero-based
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

async function getIzintDateTime(date) {
  const now = new Date(date);

  const getHour = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0"); // Month is zero-based
  const day = String(now.getDate()).padStart(2, "0");

  const hours = String(getHour.getHours()).padStart(2, "0");
  const minutes = String(getHour.getMinutes()).padStart(2, "0");
  const seconds = String(getHour.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

async function getLocation(id_lokasi) {
  return new Promise((resolve, reject) => {
    db.query(
      `SELECT * FROM master_lokasi WHERE id=${id_lokasi}`,
      (err, results) => {
        if (err) {
          console.error("Error fetching lokasi:", err);
          reject(err);
          return;
        }
        resolve(results[0]);
      }
    );
  });
}

async function getShift(id_lokasi, id_karyawan, dates) {
  return new Promise((resolve, reject) => {
    db.query(
      `SELECT * FROM shift_karyawan WHERE id_lokasi=${id_lokasi} AND id_karyawan=${id_karyawan} AND '${dates}' BETWEEN start_date AND end_date`,
      (err, results) => {
        if (err) {
          console.error("Error fetching lokasi:", err);
          reject(err);
          return;
        }
        resolve(results[0] ? results[0]?.id_shift : null);
      }
    );
  });
}

async function getValidateTimeStamp(id_shift) {
  return new Promise((resolve, reject) => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    const formattedDateTime = `${hours}:${minutes}:${seconds}`;

    const sql_query = `
      SELECT 
        SUBTIME(master_shift.jam_keluar, SEC_TO_TIME(master_lokasi.toleransi * 60)) AS minimum,
        ADDTIME(master_shift.jam_keluar, SEC_TO_TIME(master_lokasi.toleransi * 60)) AS maximum
      FROM master_shift 
      LEFT JOIN master_lokasi ON master_shift.id_lokasi = master_lokasi.id
      WHERE master_shift.id = ${id_shift};
    `;

    db.query(sql_query, (err, results) => {
      if (err) {
        console.error("Error fetching lokasi:", err);
        reject(err);
        return;
      }

      const { minimum, maximum } = results[0];

      // Convert string times to Date objects for comparison
      const minTime = new Date(`1970-01-01T${minimum}`);
      const maxTime = new Date(`1970-01-01T${maximum}`);
      const currentDateTime = new Date(`1970-01-01T${formattedDateTime}`);

      let validate = false;

      // Validate if the current time is within the range or greater than maxTime
      if (
        currentDateTime >= minTime &&
        (currentDateTime <= maxTime || currentDateTime > maxTime)
      ) {
        validate = true;
      }

      resolve(validate);
    });
  });
}

async function getAbsensi(id_karyawan) {
  try {
    const results = await fetchAbsensi(id_karyawan);

    if (results.length > 0) {
      return results;
    } else {
      return [];
    }
  } catch (err) {
    console.error("Error in getAbsensi:", err);
    return [];
  }
}

// Function to fetch absensi data based on date and id_karyawan
async function fetchAbsensi(id_karyawan) {
  return new Promise((resolve, reject) => {
    db.query(
      `SELECT *
        FROM absensi
        WHERE id_karyawan=${id_karyawan} AND timestamp >= DATE_SUB(CURDATE(), INTERVAL 1 DAY)
          AND timestamp < CURDATE()
        ORDER BY timestamp DESC
        LIMIT 1;`,
      (err, results) => {
        if (err) {
          console.error("Error fetching absensi:", err);
          reject(err);
          return;
        }
        resolve(results);
      }
    );
  });
}

function getDistanceBetweenPoints(lat1, lon1, lat2, lon2) {
  if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) {
    throw new Error("Invalid input. Latitude and Longitude must be numbers.");
  }

  const deg2rad = (angle) => {
    return angle * (Math.PI / 180);
  };

  const rad2deg = (angle) => {
    return angle * (180 / Math.PI);
  };

  const theta = lon1 - lon2;
  let miles =
    Math.sin(deg2rad(lat1)) * Math.sin(deg2rad(lat2)) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.cos(deg2rad(theta));
  miles = Math.acos(miles);
  miles = rad2deg(miles);
  miles = miles * 60 * 1.1515;
  const feet = miles * 5280;
  const yards = feet / 3;
  const kilometers = miles * 1.609344;
  const meters = kilometers * 1000;

  return { miles, feet, yards, kilometers, meters };
}

function number_format(value, precision) {
  const multiplier = Math.pow(10, precision || 0);
  return Math.round(value * multiplier) / multiplier;
}

// Listen

app.listen(port);
console.log("Listening on localhost:" + port);
