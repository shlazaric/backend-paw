import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { ObjectId } from "mongodb";
import { connectToDatabase, getDb } from "./db.js";
import jwt from "jsonwebtoken";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: "http://localhost:8080" }));
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "tajni_kljuc";

// --- Middleware za korisnički JWT ---
const verifyMyWay = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Token nije poslan" });
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: "Nevažeći token" });
  }
};

// --- Middleware za admin JWT ---
const verifyAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Token nije poslan" });
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== "admin") return res.status(403).json({ message: "Nema pristup" });
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: "Nevažeći token" });
  }
};

// --- Provjera  ObjectId ---
const isValidObjectId = (id) => ObjectId.isValid(id);

async function startServer() {
  await connectToDatabase();
  console.log("MongoDB connected");

  app.get("/", (req, res) => res.send("PawfectStay backend radi"));

  // --- Registracija usera ---
  app.post("/register", async (req, res) => {
    try {
      const db = getDb();
      const { ime, prezime, email, password } = req.body;
      const existingUser = await db.collection("users").findOne({ email });
      if (existingUser) return res.status(400).json({ message: "Korisnik već postoji" });
      const result = await db.collection("users").insertOne({ ime, prezime, email, password });
      res.status(201).json({ message: "Registracija uspješna", id: result.insertedId });
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  });

  // --- Login usera ---
  app.post("/login", async (req, res) => {
    try {
      const db = getDb();
      const { email, password } = req.body;
      const user = await db.collection("users").findOne({ email, password });
      if (!user) return res.status(401).json({ message: "Pogrešan email ili lozinka" });
      const token = jwt.sign({ id: user._id.toString(), role: "user" }, JWT_SECRET, { expiresIn: "7d" });
      res.json({ role: "user", token });
    } catch (err) {
      res.status(401).json({ message: err.message });
    }
  });

  // --- Admin login ---
  app.post("/admin/login", (req, res) => {
    const { username, password } = req.body;
    if (username === "admin" && password === "admin123") {
      const token = jwt.sign({ id: "admin", username, role: "admin" }, JWT_SECRET, { expiresIn: "7d" });
      return res.json({ role: "admin", token });
    }
    res.status(401).json({ message: "Pogrešan admin login" });
  });

  app.post("/dogs", verifyMyWay, async (req, res) => {
    try {
      const db = getDb();
      const { name, breed, age } = req.body;
      const ownerId = req.user.id;
      const result = await db.collection("dogs").insertOne({
        name,
        breed,
        age,
        ownerId: new ObjectId(ownerId),
        createdAt: new Date()
      });
      res.status(201).json({ message: "Pas spremljen", dogId: result.insertedId });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Greška pri spremanju psa" });
    }
  });

  app.get("/dogs", verifyMyWay, async (req, res) => {
    try {
      const db = getDb();
      const ownerId = req.user.id;
      const dogs = await db.collection("dogs").find({ ownerId: new ObjectId(ownerId) }).toArray();
      res.json(dogs);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Greška pri dohvaćanju pasa" });
    }
  });

  // ---admin-prikaz svih pasa ----
  app.get("/dogs/all", verifyAdmin, async (req, res) => {
    try {
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
        {
          $unwind: {
            path: "$owner",
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $project: {
            _id: 1,
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
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Greška pri dohvaćanju pasa" });
    }
  });

  // --- dohvat jednog psa  ---
  app.get("/dogs/:id", async (req, res) => {
    try {
      const db = getDb();
      const dogId = req.params.id;
      if (!isValidObjectId(dogId)) return res.status(400).json({ message: "Nevažeći ID psa" });

      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ message: "Token nije poslan" });
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, JWT_SECRET);

      const dog = await db.collection("dogs").findOne({ _id: new ObjectId(dogId) });
      if (!dog) return res.status(404).json({ message: "Pas nije pronađen" });

      if (decoded.role !== "admin" && dog.ownerId.toString() !== decoded.id)
        return res.status(403).json({ message: "Nema pristup ovom psu" });

      res.json(dog);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Greška pri dohvaćanju psa" });
    }
  });

  app.put("/dogs/:id", async (req, res) => {
    try {
      const db = getDb();
      const dogId = req.params.id;
      const { name, breed, age } = req.body;
      if (!isValidObjectId(dogId)) return res.status(400).json({ message: "Nevažeći ID psa" });

      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ message: "Token nije poslan" });
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, JWT_SECRET);

      const dog = await db.collection("dogs").findOne({ _id: new ObjectId(dogId) });
      if (!dog) return res.status(404).json({ message: "Pas nije pronađen" });

      if (decoded.role !== "admin" && dog.ownerId.toString() !== decoded.id)
        return res.status(403).json({ message: "Nema pristup ovom psu" });

      await db.collection("dogs").updateOne(
        { _id: new ObjectId(dogId) },
        { $set: { name, breed, age } }
      );
      res.json({ message: "Profil psa je uspješno ažuriran" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Greška pri ažuriranju psa" });
    }
  });

  app.delete("/dogs/:id", async (req, res) => {
    try {
      const db = getDb();
      const dogId = req.params.id;
      if (!isValidObjectId(dogId)) return res.status(400).json({ message: "Nevažeći ID psa" });

      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ message: "Token nije poslan" });
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, JWT_SECRET);

      const dog = await db.collection("dogs").findOne({ _id: new ObjectId(dogId) });
      if (!dog) return res.status(404).json({ message: "Pas nije pronađen" });

      if (decoded.role !== "admin" && dog.ownerId.toString() !== decoded.id)
        return res.status(403).json({ message: "Nema pristup ovom psu" });

      await db.collection("dogs").deleteOne({ _id: new ObjectId(dogId) });
      res.json({ message: "Pas je obrisan" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Greška pri brisanju psa" });
    }
  });

  // --- Rezervacije ---
  app.post("/reservations", verifyMyWay, async (req, res) => {
    try {
      const db = getDb();
      const { petName, duration, date, time, note } = req.body;
      const userId = req.user.id;
      const reservation = {
        petName,
        duration,
        date,
        time,
        note,
        userId: new ObjectId(userId),
        status: "pending",
        createdAt: new Date()
      };
      const result = await db.collection("reservations").insertOne(reservation);
      res.status(201).json({ message: "Rezervacija spremljena", reservationId: result.insertedId });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Greška pri spremanju rezervacije" });
    }
  });

  app.get("/reservations/user", verifyMyWay, async (req, res) => {
    try {
      const db = getDb();
      const userId = req.user.id;
      const reservations = await db.collection("reservations")
        .find({ userId: new ObjectId(userId) })
        .sort({ createdAt: -1 })
        .toArray();
      const mapped = reservations.map(r => ({
        ...r,
        statusText: r.status === "pending" ? "Na čekanju" : r.status === "accepted" ? "Prihvaćeno" : r.status === "declined" ? "Odbijeno" : r.status
      }));
      res.json(mapped);
    } catch (err) {
      res.status(500).json({ message: "Greška pri dohvaćanju rezervacija" });
    }
  });

  app.get("/admin/reservations", verifyAdmin, async (req, res) => {
    try {
      const db = getDb();
      const reservations = await db.collection("reservations").find({}).sort({ createdAt: -1 }).toArray();
      const mapped = reservations.map(r => ({
        _id: r._id,
        petName: r.petName,
        duration: r.duration,
        date: r.date,
        time: r.time,
        note: r.note || "",
        status: r.status,
        statusText: r.status === "pending" ? "Na čekanju" : r.status === "accepted" ? "Prihvaćeno" : r.status === "declined" ? "Odbijeno" : r.status
      }));
      res.json(mapped);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Greška pri dohvaćanju rezervacija" });
    }
  });

  app.put("/admin/reservations/:id", verifyAdmin, async (req, res) => {
    try {
      const db = getDb();
      const { status } = req.body;
      const id = req.params.id;
      if (!["pending","accepted","declined"].includes(status)) return res.status(400).json({ message: "Nevažeći status" });
      if (!isValidObjectId(id)) return res.status(400).json({ message: "Nevažeći ID rezervacije" });
      await db.collection("reservations").updateOne({ _id: new ObjectId(id) }, { $set: { status } });
      res.json({ message: "Status rezervacije ažuriran" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Greška pri ažuriranju statusa" });
    }
  });

  app.delete("/admin/reservations/:id", verifyAdmin, async (req, res) => {
    try {
      const db = getDb();
      const id = req.params.id;
      if (!isValidObjectId(id)) return res.status(400).json({ message: "Nevažeći ID rezervacije" });
      await db.collection("reservations").deleteOne({ _id: new ObjectId(id) });
      res.json({ message: "Rezervacija obrisana" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Greška pri brisanju rezervacije" });
    }
  });

  app.listen(PORT, () => console.log(`Server radi na http://localhost:${PORT}`));
}

startServer();
