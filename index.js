import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { connectToDatabase, getDb } from "./db.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: "http://localhost:8080" }));
app.use(express.json());

async function startServer() {
    await connectToDatabase();

    app.get("/", (req, res) => {
        res.send("PawfectStay backend radi");
    });

    app.post("/register", async (req, res) => {
        try {
            const db = getDb();
            const { ime, prezime, email, lozinka } = req.body;

            if (!ime || !prezime || !email || !lozinka) {
                return res.status(400).json({ message: "Nedostaju podaci" });
            }

            const existingUser = await db.collection("users").findOne({ email });

            if (existingUser) {
                return res.status(409).json({ message: "Korisnik već postoji" });
            }

            await db.collection("users").insertOne({
                ime,
                prezime,
                email,
                lozinka,
                createdAt: new Date()
            });

            res.status(201).json({ message: "Registracija uspješna" });
        } catch {
            res.status(500).json({ message: "Greška na serveru" });
        }
    });

    app.post("/login", async (req, res) => {
        try {
            const db = getDb();
            const { email, lozinka } = req.body;

            if (!email || !lozinka) {
                return res.status(400).json({ message: "Email i lozinka su obavezni" });
            }

            const user = await db.collection("users").findOne({ email });

            if (!user) {
                return res.status(401).json({ message: "Korisnik ne postoji" });
            }

            if (user.lozinka !== lozinka) {
                return res.status(401).json({ message: "Neispravna lozinka" });
            }

            res.json({
                user: {
                    id: user._id,
                    ime: user.ime,
                    prezime: user.prezime,
                    email: user.email
                }
            });
        } catch {
            res.status(500).json({ message: "Greška pri prijavi" });
        }
    });

    app.post("/reservations", async (req, res) => {
        try {
            const db = getDb();
            const { petName, duration, date, time, note } = req.body;

            if (!petName || !duration || !date || !time) {
                return res.status(400).json({ message: "Nedostaju podaci" });
            }

            await db.collection("reservations").insertOne({
                petName,
                duration,
                date,
                time,
                note,
                status: "pending",
                createdAt: new Date()
            });

            res.status(201).json({ message: "Rezervacija spremljena" });
        } catch {
            res.status(500).json({ message: "Greška pri spremanju rezervacije" });
        }
    });

    app.listen(PORT, () => {
        console.log(`Server radi na http://localhost:${PORT}`);
    });
}

startServer();
