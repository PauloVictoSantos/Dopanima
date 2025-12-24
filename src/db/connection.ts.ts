import mysql from "mysql2/promise";

export const db = mysql.createPool({
host: "localhost",
user: "root",
password: "01470439212",
database: "db_Dopanima",
});