import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const mongoURI = process.env.MONGO_URI;
const dbName = process.env.DB_NAME;

let db;

export async function connectToDatabase() {
  try {
    const client = new MongoClient(mongoURI);
    await client.connect();
    db = client.db(dbName);
    console.log("Spojeno na MongoDB Atlas");
    return db;
  } catch (err) {
    console.error("Greška pri spajanju na bazu", err);
    throw err;
  }
}

export function getDb() {
  if (!db) throw new Error("Baza nije inicijalizirana!");
  return db;
}
