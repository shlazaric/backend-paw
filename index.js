const express = require("express");
const { MongoClient } = require("mongodb");
import { connectToDatabase } from './db.js';


const app = express();
const PORT = 3000;

app.use(express.json());

const db = await connectToDatabase();

const uri =
    "mongodb+srv://admin:<db_password>@pawfectstay.gplvkbj.mongodb.net/?appName=pawfectstay";

const client = new MongoClient(uri);
let db;

async function connectDB() {
    try {
        await client.connect();
        db = client.db("pawfectstay");
        console.log("Spojeno na MongoDB Atlas");
    } catch (err) {
        console.error(err);
    }
}

connectDB();

app.get("/", (req, res) => {
    res.send("Server radi");
});

app.post("/dogs", async (req, res) => {
    const dog = req.body;

    if (!dog.name || !dog.breed || !dog.age) {
        return res.status(400).json({ message: "Nedostaju podaci" });
    }

    const result = await db.collection("dogs").insertOne(dog);
    res.json({ id: result.insertedId });
});

app.get("/dogs", async (req, res) => {
    const dogs = await db.collection("dogs").find().toArray();
    res.json(dogs);
});

app.listen(PORT, () => {
    console.log(`Server pokrenut na http://localhost:${PORT}`);
});
