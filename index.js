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
    await connectToDatabase();

    app.get("/", (req, res) => {
        res.send("PawfectStay backend radi");
    });

    // registracija korisnika 
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

    // prijava korisnika
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

    // prijava administratora
    app.post("/admin/login", (req, res) => {
        const { username, password } = req.body;

        const ADMIN_USERNAME = "admin";
        const ADMIN_PASSWORD = "admin123";

        if (!username || !password) {
            return res.status(400).json({
                message: "Korisničko ime i lozinka su obavezni"
            });
        }

        if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
            return res.status(401).json({
                message: "Pogrešno admin korisničko ime ili lozinka"
            });
        }

        res.json({
            admin: {
                username: ADMIN_USERNAME,
                role: "admin"
            }
        });
    });

    // zakazivanje termina
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

    // dodavanje psa 
    app.post("/dogs", async (req, res) => {
        try {
            const db = getDb();
            const { name, breed, age } = req.body;

            if (!name || !breed || age === undefined) {
                return res.status(400).json({ message: "Nedostaju podaci o psu" });
            }

            await db.collection("dogs").insertOne({
                name,
                breed,
                age,
                createdAt: new Date()
            });

            res.status(201).json({ message: "Pas uspješno spremljen" });
        } catch {
            res.status(500).json({ message: "Greška pri spremanju psa" });
        }
    });

    // dohvacanje svih pasa 
    app.get("/dogs", async (req, res) => {
        try {
            const db = getDb();
            const dogs = await db.collection("dogs").find().toArray();
            res.json(dogs);
        } catch {
            res.status(500).json({ message: "Greška pri dohvaćanju pasa" });
        }
    });

    // dohvacanje pasa po id-u 
    app.get("/dogs/:id", async (req, res) => {
        try {
            const db = getDb();
            const dog = await db.collection("dogs").findOne({
                _id: new ObjectId(req.params.id)
            });

            if (!dog) {
                return res.status(404).json({ message: "Pas nije pronađen" });
            }

            res.json(dog);
        } catch {
            res.status(500).json({ message: "Greška pri dohvaćanju psa" });
        }
    });

    // ažuriranje podataka o psu 
    app.put("/dogs/:id", async (req, res) => {
        try {
            const db = getDb();
            const { name, breed, age } = req.body;

            await db.collection("dogs").updateOne(
                { _id: new ObjectId(req.params.id) },
                { $set: { name, breed, age } }
            );

            res.json({ message: "Profil psa ažuriran" });
        } catch {
            res.status(500).json({ message: "Greška pri ažuriranju psa" });
        }
    });

    app.listen(PORT, () => {
        console.log(`Server radi na http://localhost:${PORT}`);
    });
}

startServer();
