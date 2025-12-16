import { MongoClient } from 'mongodb';

import { config } from 'dotenv';

config();

const mongoURI = process.env.MONGO_URI;
const db_name = process.env.DB_NAME;

async function connectToDatabase() {
    try {
        const client = new MongoClient(mongoURI);
        await client.connect();
        console.log('Uspješno spajanje na bazu podataka');
        let db = client.db(db_pawfectstay);
        return db;
    } catch (error) {
        console.error('Greška prilikom spajanja na bazu podataka', error);
        throw error;
    }
}

export { connectToDatabase };