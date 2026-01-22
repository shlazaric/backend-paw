import { getDb } from "./db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET || "tajni_kljuc";

export default {
  // Registracija korisnika
  async registerUser(userData) {
    const db = getDb();
    const doc = {
      ime: userData.ime,
      prezime: userData.prezime,
      email: userData.email,
      lozinka: await bcrypt.hash(userData.lozinka, 10),
    };
    try {
      const result = await db.collection("users").insertOne(doc);
      return result.insertedId;
    } catch (e) {
      throw new Error("Korisnik već postoji ili problem sa podacima");
    }
  },

  // Login korisnika
  async logInUser({ email, lozinka }) {
    const db = getDb();
    const user = await db.collection("users").findOne({ email });
    if (!user) throw new Error("Neispravni podaci");

    const match = await bcrypt.compare(lozinka, user.lozinka);
    if (!match) throw new Error("Neispravni podaci");

    const token = jwt.sign(
      { id: user._id, email: user.email, ime: user.ime, prezime: user.prezime, role: "user" },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return { token, user: { id: user._id, ime: user.ime, prezime: user.prezime, email: user.email } };
  },

  // Middleware za provjeru korisničkog tokena
  verifyMyWay(req, res, next) {
    try {
      const token = req.headers.authorization?.split(" ")[1];
      if (!token) return res.status(401).send("Token je obavezan");

      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch {
      return res.status(403).send("Nevaljali token");
    }
  },

  // Middleware za provjeru admin tokena
  verifyAdmin(req, res, next) {
    try {
      const token = req.headers.authorization?.split(" ")[1];
      if (!token) return res.status(401).send("Token je obavezan");

      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.role !== "admin") return res.status(403).send("Nema prava");

      req.user = decoded;
      next();
    } catch {
      return res.status(403).send("Nevaljali token");
    }
  },
};
