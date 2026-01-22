import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { ObjectId } from "mongodb";
import { connectToDatabase, getDb } from "./db.js";
import auth from "./auth.js";
import jwt from "jsonwebtoken";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: "http://localhost:8080" }));
app.use(express.json());

async function startServer() {
  await connectToDatabase();
  console.log("MongoDB connected");

  app.get("/", (req, res) => res.send("PawfectStay backend radi"));

  // ================= USER =================
  app.post("/register", async (req, res) => {
    try {
      const id = await auth.registerUser(req.body);
      res.status(201).json({ message: "Registracija uspješna", id });
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/login", async (req, res) => {
    try {
      const result = await auth.logInUser(req.body);
      res.json(result);
    } catch (err) {
      res.status(401).json({ message: err.message });
    }
  });

  // ================= ADMIN =================
  app.post("/admin/login", (req, res) => {
    const { username, password } = req.body;

    if (username === "admin" && password === "admin123") {
      const token = jwt.sign(
        { id: "admin", username, role: "admin" },
        process.env.JWT_SECRET || "tajni_kljuc",
        { expiresIn: "7d" }
      );
      return res.json({ role: "admin", token });
    }

    res.status(401).json({ message: "Pogrešan admin login" });
  });

  // ================= DOGS – USER =================
  app.post("/dogs", auth.verifyMyWay, async (req, res) => {
    try {
      const db = getDb();
      const { name, breed, age } = req.body;
      const ownerId = req.user.id;

      const result = await db.collection("dogs").insertOne({
        name, breed, age, ownerId: new ObjectId(ownerId), createdAt: new Date()
      });

      res.status(201).json({ message: "Pas spremljen", dogId: result.insertedId });
    } catch {
      res.status(500).json({ message: "Greška pri spremanju psa" });
    }
  });

  app.get("/dogs", auth.verifyMyWay, async (req, res) => {
    try {
      const db = getDb();
      const ownerId = req.user.id;

      const dogs = await db.collection("dogs").find({ ownerId: new ObjectId(ownerId) }).toArray();
      res.json(dogs);
    } catch {
      res.status(500).json({ message: "Greška pri dohvaćanju pasa" });
    }
  });

  // ================= DOGS & RESERVATIONS – ADMIN =================
  app.get("/dogs/all", auth.verifyAdmin, async (req, res) => {
    try {
      const db = getDb();
      const dogs = await db.collection("dogs").aggregate([
        { $lookup: { from: "users", localField: "ownerId", foreignField: "_id", as: "owner" } },
        { $unwind: "$owner" },
        { $project: { name: 1, breed: 1, age: 1, owner: { ime: "$owner.ime", prezime: "$owner.prezime", email: "$owner.email" } } }
      ]).toArray();

      res.json(dogs);
    } catch {
      res.status(500).json({ message: "Greška pri dohvaćanju pasa" });
    }
  });

  app.post("/reservations", auth.verifyMyWay, async (req, res) => {
    try {
      const db = getDb();
      const { petName, duration, date, time, note } = req.body;
      const userId = req.user.id;

      const result = await db.collection("reservations").insertOne({
        petName, duration, date, time, note,
        userId: new ObjectId(userId),
        status: "pending",
        statusText: "Na čekanju",
        createdAt: new Date()
      });

      res.status(201).json({ message: "Rezervacija spremljena", id: result.insertedId });
    } catch {
      res.status(500).json({ message: "Greška pri spremanju rezervacije" });
    }
  });

  app.get("/reservations/user", auth.verifyMyWay, async (req, res) => {
    try {
      const db = getDb();
      const userId = req.user.id;
      const reservations = await db.collection("reservations").find({ userId: new ObjectId(userId) }).sort({ createdAt: -1 }).toArray();
      res.json(reservations);
    } catch {
      res.status(500).json({ message: "Greška pri dohvaćanju rezervacija" });
    }
  });

  app.get("/admin/reservations", auth.verifyAdmin, async (req, res) => {
    try {
      const db = getDb();
      const reservations = await db.collection("reservations").find().toArray();
      res.json(reservations);
    } catch {
      res.status(500).json({ message: "Greška pri dohvaćanju rezervacija" });
    }
  });

  app.listen(PORT, () => console.log(`Server radi na http://localhost:${PORT}`));
}

startServer();
