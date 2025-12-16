const express = require("express");
require("dotenv").config();

const { connectToDatabase, getDb } = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());


async function startServer() {
    await connectToDatabase();


    app.get("/", (req, res) => {
        res.send("PawfectStay backend radi s MongoDB ✅");
    });

    app.post("/dogs", async (req, res) => {
        try {
            const db = getDb();
            const dog = req.body;

            if (!dog.name || !dog.breed || !dog.age) {
                return res.status(400).json({ message: "Nedostaju podaci o psu" });
            }

            const result = await db.collection("dogs").insertOne(dog);
            res.status(201).json({
                message: "Pas uspješno dodan",
                id: result.insertedId,
            });
        } catch (error) {
            res.status(500).json({ message: "Greška na serveru" });
        }
    });

    // Dohvat svih pasa (ADMIN)
    app.get("/dogs", async (req, res) => {
        try {
            const db = getDb();
            const dogs = await db.collection("dogs").find().toArray();
            res.json(dogs);
        } catch (error) {
            res.status(500).json({ message: "Greška pri dohvaćanju pasa" });
        }
    });


    app.listen(PORT, () => {
        console.log(`🚀 Server radi na http://localhost:${PORT}`);
    });
}

startServer();
