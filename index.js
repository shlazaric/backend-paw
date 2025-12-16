const express = require("express");
require("dotenv").config();

const { connectToDatabase, getDb } = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

async function startServer() {
    await connectToDatabase();

    app.get("/", (req, res) => {
        res.send("PawfectStay backend radi s bazom ✅");
    });

    app.listen(PORT, () => {
        console.log(`Server pokrenut na http://localhost:${PORT}`);
    });
}

startServer();
