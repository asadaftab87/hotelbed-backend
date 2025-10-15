import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: process.env.DB_HOST || "107.21.156.43",
  user: process.env.DB_USER || "asadaftab",
  password: process.env.DB_PASS || "Asad124@",
  database: process.env.DB_NAME || "hotelbed",
  waitForConnections: true,
  connectionLimit: 20,
  multipleStatements: true,
});

export async function loadCSVToMySQL(csvPath: string, table: string) {
  const conn = await pool.getConnection();
  try {
    await conn.query(`ALTER TABLE \`${table}\` DISABLE KEYS;`);

    const sql = `
      LOAD DATA LOCAL INFILE ?
      INTO TABLE \`${table}\`
      FIELDS TERMINATED BY ',' ENCLOSED BY '"'
      LINES TERMINATED BY '\n'
      IGNORE 1 LINES;
    `;
    await conn.query(sql, [csvPath]);

    await conn.query(`ALTER TABLE \`${table}\` ENABLE KEYS;`);
  } finally {
    conn.release();
  }
}
