import express from "express";
import dotenv from "dotenv";
import { ObjectId } from "mongodb";

import { connectToDatabase, getDb } from "./db.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());


async function startServer() {
    await connectToDatabase();


    app.get("/", (req, res) => {
        res.send("PawfectStay backend radi 🐾");
    });

    app.post("/dogs", async (req, res) => {
        try {
            const db = getDb();
            const dog = req.body;

            if (!dog.name || !dog.breed || !dog.age) {
                return res.status(400).json({ message: "Nedostaju podaci o psu" });
            }

            const result = await db.collection("dogs").insertOne(dog);
            res.status(201).json({ id: result.insertedId });
        } catch (err) {
            res.status(500).json({ message: "Greška na serveru" });
        }
    });

    app.get("/dogs", async (req, res) => {
        try {
            const db = getDb();
            const dogs = await db.collection("dogs").find().toArray();
            res.json(dogs);
        } catch (err) {
            res.status(500).json({ message: "Greška pri dohvaćanju pasa" });
        }
    });



    app.listen(PORT, () => {
        console.log(`🚀 Server radi na http://localhost:${PORT}`);
    });
}

startServer();
