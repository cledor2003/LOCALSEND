const express = require("express");
const path = require("path");
const mongoose = require("mongoose");

const app = express();
const PORT = process.env.PORT || 3000;

// Variables d'environnement
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "aksam2026";
const MONGO_URI = process.env.MONGODB_URI;

// Connexion à MongoDB Atlas
if (!MONGO_URI) {
  console.error("❌ ERREUR : La variable MONGODB_URI n'est pas définie dans l'environnement !");
} else {
  mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ Connexion réussie à MongoDB Atlas !"))
    .catch((err) => console.error("❌ Erreur de connexion MongoDB :", err));
}

// --- Modèles MongoDB ---
const employeeSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  pin: { type: String, required: true }
});

const recordSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  employeeId: { type: String, required: true },
  type: { type: String, enum: ["in", "out"], required: true },
  ts: { type: Date, default: Date.now },
  lat: Number,
  lng: Number,
  accuracy: Number
});

const settingSchema = new mongoose.Schema({
  key: { type: String, default: "settings", unique: true },
  startTime: { type: String, default: "08:00" }
});

const Employee = mongoose.model("Employee", employeeSchema);
const Record = mongoose.model("Record", recordSchema);
const Setting = mongoose.model("Setting", settingSchema);

// --- Fonctions utiles ---
function randomPin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function requireAdminAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Basic ")) {
    res.set("WWW-Authenticate", 'Basic realm="Espace admin AKSAM"');
    return res.status(401).send("Authentification requise.");
  }
  const decoded = Buffer.from(auth.split(" ")[1], "base64").toString("utf-8");
  const sepIndex = decoded.indexOf(":");
  const user = decoded.slice(0, sepIndex);
  const pass = decoded.slice(sepIndex + 1);
  if (user === ADMIN_USER && pass === ADMIN_PASSWORD) {
    return next();
  }
  res.set("WWW-Authenticate", 'Basic realm="Espace admin AKSAM"');
  return res.status(401).send("Identifiants incorrects.");
}

app.use(express.json());

// Protection de la page Admin
app.get("/admin.html", requireAdminAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// --- Routes API Protégées (Admin) ---

app.post("/api/employees", requireAdminAuth, async (req, res) => {
  try {
    const { name, pin } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Nom requis" });

    const employee = new Employee({
      id: `emp_${Date.now()}`,
      name: name.trim(),
      pin: /^\d{4}$/.test(pin || "") ? pin : randomPin(),
    });

    await employee.save();
    res.json(employee);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur lors de la création d'employé" });
  }
});

app.delete("/api/employees/:id", requireAdminAuth, async (req, res) => {
  try {
    await Employee.deleteOne({ id: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de la suppression" });
  }
});

app.put("/api/settings", requireAdminAuth, async (req, res) => {
  try {
    const { startTime } = req.body;
    const settings = await Setting.findOneAndUpdate(
      { key: "settings" },
      { startTime: startTime || "08:00" },
      { upsert: true, new: true }
    );
    res.json({ startTime: settings.startTime });
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de la mise à jour des paramètres" });
  }
});

// Priority sur les fichiers statiques de public/
app.use(express.static(path.join(__dirname, "public")));

// --- Routes API Publiques ---

app.get("/api/employees", async (req, res) => {
  try {
    const employees = await Employee.find({}, { _id: 0, __v: 0 });
    res.json(employees);
  } catch (err) {
    res.status(500).json({ error: "Erreur chargement employés" });
  }
});

app.get("/api/records", async (req, res) => {
  try {
    const records = await Record.find({}, { _id: 0, __v: 0 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: "Erreur chargement pointages" });
  }
});

app.post("/api/records", async (req, res) => {
  try {
    const { employeeId, pin, lat, lng, accuracy } = req.body;

    const employee = await Employee.findOne({ id: employeeId });
    if (!employee) return res.status(404).json({ error: "Employé introuvable" });
    if (employee.pin !== pin) return res.status(401).json({ error: "Code PIN incorrect" });

    // Récupérer le dernier pointage pour cet employé
    const lastRecord = await Record.findOne({ employeeId }).sort({ ts: -1 });
    const lastType = lastRecord ? lastRecord.type : "out";
    const type = lastType === "out" ? "in" : "out";

    const record = new Record({
      id: `rec_${Date.now()}`,
      employeeId,
      type,
      ts: new Date().toISOString(),
      lat,
      lng,
      accuracy,
    });

    await record.save();
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de l'enregistrement du pointage" });
  }
});

app.get("/api/settings", async (req, res) => {
  try {
    let settings = await Setting.findOne({ key: "settings" });
    if (!settings) {
      settings = await Setting.create({ key: "settings", startTime: "08:00" });
    }
    res.json({ startTime: settings.startTime });
  } catch (err) {
    res.status(500).json({ error: "Erreur chargement paramètres" });
  }
});

app.listen(PORT, () => {
  console.log(`PointageDistance lancé sur http://localhost:${PORT}`);
});
