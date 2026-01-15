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
  console.log("MongoDB connected");

  app.get("/", (req, res) => {
    res.send("PawfectStay backend radi");
  });

  // ================= USER =================

  app.post("/register", async (req, res) => {
    try {
      const db = getDb();
      const { ime, prezime, email, lozinka } = req.body;

      if (!ime || !prezime || !email || !lozinka) {
        return res.status(400).json({ message: "Nedostaju podaci" });
      }

      const exists = await db.collection("users").findOne({ email });
      if (exists) {
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

      const user = await db.collection("users").findOne({ email });
      if (!user || user.lozinka !== lozinka) {
        return res.status(401).json({ message: "Neispravni podaci" });
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

  // ================= ADMIN =================

  app.post("/admin/login", (req, res) => {
    const { username, password } = req.body;

    if (username === "admin" && password === "admin123") {
      return res.json({ role: "admin" });
    }

    res.status(401).json({ message: "Pogrešan admin login" });
  });

  // ================= DOGS – ADMIN =================


  app.get("/dogs/all", async (req, res) => {
    const db = getDb();

    const dogs = await db.collection("dogs").aggregate([
      {
        $lookup: {
          from: "users",
          localField: "ownerId",
          foreignField: "_id",
          as: "owner"
        }
      },
      { $unwind: "$owner" },
      {
        $project: {
          name: 1,
          breed: 1,
          age: 1,
          owner: {
            ime: "$owner.ime",
            prezime: "$owner.prezime",
            email: "$owner.email"
          }
        }
      }
    ]).toArray();

    res.json(dogs);
  });

  // ================= DOGS – USER =================

  app.post("/dogs", async (req, res) => {
    try {
      const db = getDb();
      const { name, breed, age, userId } = req.body;

      if (!userId) {
        return res.status(400).json({ message: "Nedostaje userId" });
      }

      await db.collection("dogs").insertOne({
        name,
        breed,
        age,
        ownerId: new ObjectId(userId),
        createdAt: new Date()
      });

      res.status(201).json({ message: "Pas spremljen" });
    } catch {
      res.status(500).json({ message: "Greška pri spremanju psa" });
    }
  });

  // svi psi jednog korisnika
  app.get("/dogs", async (req, res) => {
    const db = getDb();
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ message: "Nedostaje userId" });
    }

    const dogs = await db
      .collection("dogs")
      .find({ ownerId: new ObjectId(userId) })
      .toArray();

    res.json(dogs);
  });

  // jedan pas – samo vlasnik
  app.get("/dogs/:id", async (req, res) => {
    const db = getDb();
    const { id } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ message: "Nedostaje userId" });
    }

    const dog = await db.collection("dogs").findOne({
      _id: new ObjectId(id),
      ownerId: new ObjectId(userId)
    });

    if (!dog) {
      return res.status(404).json({ message: "Pas nije pronađen" });
    }

    res.json(dog);
  });

  // uređivanje psa – samo vlasnik
  app.put("/dogs/:id", async (req, res) => {
    const db = getDb();
    const { id } = req.params;
    const { userId, name, breed, age } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "Nedostaje userId" });
    }

    const result = await db.collection("dogs").updateOne(
      { _id: new ObjectId(id), ownerId: new ObjectId(userId) },
      { $set: { name, breed, age } }
    );

    if (result.matchedCount === 0) {
      return res.status(403).json({ message: "Nemaš pravo uređivati ovog psa" });
    }

    res.json({ message: "Profil psa ažuriran" });
  });

  // ================= RESERVATIONS =================

  app.post("/reservations", async (req, res) => {
    const db = getDb();
    const { petName, duration, date, time, note, userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "Nedostaje userId" });
    }

    await db.collection("reservations").insertOne({
      petName,
      duration,
      date,
      time,
      note,
      userId: new ObjectId(userId),
      status: "pending",
      statusText: "Na čekanju",
      createdAt: new Date()
    });

    res.status(201).json({ message: "Rezervacija spremljena" });
  });

  app.get("/reservations/user/:userId", async (req, res) => {
    const db = getDb();
    const { userId } = req.params;

    const reservations = await db
      .collection("reservations")
      .find({ userId: new ObjectId(userId) })
      .sort({ createdAt: -1 })
      .toArray();

    res.json(reservations);
  });

  app.get("/admin/reservations", async (req, res) => {
    const db = getDb();
    const reservations = await db.collection("reservations").find().toArray();
    res.json(reservations);
  });

  app.put("/admin/reservations/:id", async (req, res) => {
    const db = getDb();
    const { id } = req.params;
    const { status, statusText } = req.body;

    await db.collection("reservations").updateOne(
      { _id: new ObjectId(id) },
      { $set: { status, statusText } }
    );

    res.json({ message: "Status ažuriran" });
  });

  app.delete("/admin/reservations/:id", async (req, res) => {
    const db = getDb();
    const { id } = req.params;

    await db.collection("reservations").deleteOne({
      _id: new ObjectId(id)
    });

    res.json({ message: "Rezervacija obrisana" });
  });

  app.listen(PORT, () => {
    console.log(`Server radi na http://localhost:${PORT}`);
  });
}

startServer();
