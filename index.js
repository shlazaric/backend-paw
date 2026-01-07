import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { ObjectId } from "mongodb";

import { connectToDatabase, getDb } from "./db.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: "http://localhost:8080" }));
app.use(express.json());

async function startServer() {
    try {
        await connectToDatabase();
        console.log(" Spojeno na MongoDB Atlas");


        app.get("/", (req, res) => {
            res.send("PawfectStay backend radi ");
        });


        app.post("/register", async (req, res) => {
            try {
                const db = getDb();
                const { ime, prezime, email, lozinka } = req.body;

                if (!ime || !prezime || !email || !lozinka) {
                    return res.status(400).json({ message: "Nedostaju podaci" });
                }

                // provjera postoji li email
                const existingUser = await db
                    .collection("users")
                    .findOne({ email });

                if (existingUser) {
                    return res
                        .status(409)
                        .json({ message: "Korisnik s tim emailom već postoji" });
                }

                const newUser = {
                    ime,
                    prezime,
                    email,
                    lozinka,
                    createdAt: new Date()
                };

                await db.collection("users").insertOne(newUser);

                res.status(201).json({ message: "Registracija uspješna" });
            } catch (err) {
                console.error(err);
                res.status(500).json({ message: "Greška na serveru" });
            }
        });


        app.post("/dogs", async (req, res) => {
            try {
                const db = getDb();
                const { name, breed, age } = req.body;

                if (!name || !breed || !age) {
                    return res.status(400).json({ message: "Nedostaju podaci o psu" });
                }

                const dog = {
                    name,
                    breed,
                    age,
                    createdAt: new Date()
                };

                const result = await db.collection("dogs").insertOne(dog);
                res.status(201).json({ id: result.insertedId });
            } catch (err) {
                res.status(500).json({ message: "Greška pri spremanju psa" });
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
            console.log(` Server radi na http://localhost:${PORT}`);
        });

    } catch (err) {
        console.error(" Server se nije pokrenuo", err);
    }
}

startServer();
