const express = require("express");
const crypto = require("crypto");
const path = require("path");
const { MongoClient } = require("mongodb");

const app = express();
const PORT = process.env.PORT || 3000;

const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "aksam2026";
const SESSION_COOKIE = "aksam_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h
const MONGODB_URI = process.env.MONGODB_URI;

const sessions = new Map(); // token -> expiry timestamp

let db;
let dbReady = false;

async function connectDB() {
  if (!MONGODB_URI) {
    console.error("⚠️  MONGODB_URI n'est pas défini. Ajoute cette variable d'environnement sur Render.");
    return;
  }
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db();
    await db.collection("employees").createIndex({ id: 1 }, { unique: true });
    await db.collection("records").createIndex({ id: 1 }, { unique: true });
    dbReady = true;
    console.log("✅ Connecté à MongoDB");
  } catch (err) {
    console.error("❌ Impossible de se connecter à MongoDB :", err.message);
  }
}

function requireDB(req, res, next) {
  if (!dbReady) return res.status(503).json({ error: "Base de données indisponible pour le moment." });
  next();
}

function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  });
  return out;
}

function isAuthenticated(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return false;
  const expiry = sessions.get(token);
  if (!expiry || expiry < Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function requireAdminPage(req, res, next) {
  if (isAuthenticated(req)) return next();
  return res.redirect("/login.html");
}

function requireAdminApi(req, res, next) {
  if (isAuthenticated(req)) return next();
  return res.status(401).json({ error: "Non authentifié." });
}

app.use(express.json());

// Si le corps JSON envoyé est invalide, express.json() lève une erreur —
// on s'assure que la réponse reste au format JSON attendu par le client
// au lieu de la page d'erreur HTML par défaut d'Express.
app.use((err, req, res, next) => {
  if (err && err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Requête invalide, réessaie." });
  }
  next(err);
});

// Enveloppe les routes async pour que toute erreur inattendue (ex: MongoDB
// qui répond lentement ou coupe la connexion) soit toujours renvoyée en
// JSON plutôt que de faire planter la requête silencieusement.
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  if (username === ADMIN_USER && password === ADMIN_PASSWORD) {
    const token = crypto.randomBytes(24).toString("hex");
    sessions.set(token, Date.now() + SESSION_TTL_MS);
    res.setHeader(
      "Set-Cookie",
      `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${SESSION_TTL_MS / 1000}; SameSite=Lax`
    );
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: "Identifiant ou mot de passe incorrect." });
});

app.post("/api/logout", (req, res) => {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) sessions.delete(token);
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
  res.json({ ok: true });
});

app.get("/api/session", (req, res) => {
  res.json({ authenticated: isAuthenticated(req) });
});

app.get("/admin.html", requireAdminPage, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

function randomPin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}
function todayKey(iso) {
  return new Date(iso).toISOString().slice(0, 10);
}
function allowedNextActions(lastTypeToday) {
  switch (lastTypeToday) {
    case undefined:
    case null:
      return ["in"];
    case "in":
    case "pause_end":
      return ["pause_start", "out"];
    case "pause_start":
      return ["pause_end"];
    case "out":
      return [];
    default:
      return ["in"];
  }
}

app.post("/api/employees", requireAdminApi, requireDB, asyncHandler(async (req, res) => {
  const { name, pin } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "Nom requis" });
  const employee = {
    id: `emp_${Date.now()}`,
    name: name.trim(),
    pin: /^\d{4}$/.test(pin || "") ? pin : randomPin(),
  };
  await db.collection("employees").insertOne(employee);
  res.json(employee);
}));

app.delete("/api/employees/:id", requireAdminApi, requireDB, asyncHandler(async (req, res) => {
  await db.collection("employees").deleteOne({ id: req.params.id });
  const deletedRecords = await db.collection("records").deleteMany({ employeeId: req.params.id });
  res.json({ ok: true, recordsDeleted: deletedRecords.deletedCount });
}));

app.put("/api/settings", requireAdminApi, requireDB, asyncHandler(async (req, res) => {
  const { startTime } = req.body;
  await db.collection("settings").updateOne(
    { _id: "config" },
    { $set: { startTime: startTime || "08:00" } },
    { upsert: true }
  );
  res.json({ startTime: startTime || "08:00" });
}));

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/employees", requireDB, asyncHandler(async (req, res) => {
  const employees = await db.collection("employees").find({}, { projection: { _id: 0 } }).toArray();
  res.json(employees);
}));

app.get("/api/records", requireDB, asyncHandler(async (req, res) => {
  const records = await db.collection("records").find({}, { projection: { _id: 0 } }).toArray();
  res.json(records);
}));

app.post("/api/records", requireDB, asyncHandler(async (req, res) => {
  const { employeeId, pin, action, lat, lng, accuracy } = req.body;
  const employee = await db.collection("employees").findOne({ id: employeeId });
  if (!employee) return res.status(404).json({ error: "Employé introuvable" });
  if (employee.pin !== pin) return res.status(401).json({ error: "Code PIN incorrect" });

  const today = todayKey(new Date().toISOString());
  const own = await db.collection("records").find({ employeeId }).toArray();
  const todaysFiltered = own
    .filter((r) => todayKey(r.ts) === today)
    .sort((a, b) => new Date(b.ts) - new Date(a.ts));
  const lastType = todaysFiltered[0] ? todaysFiltered[0].type : null;
  const allowed = allowedNextActions(lastType);

  if (!allowed.includes(action)) {
    return res.status(400).json({ error: "Action non valide pour l'état actuel." });
  }

  const record = {
    id: `rec_${Date.now()}`,
    employeeId,
    type: action,
    ts: new Date().toISOString(),
    lat,
    lng,
    accuracy,
  };
  await db.collection("records").insertOne(record);
  res.json(record);
}));

app.get("/api/settings", requireDB, asyncHandler(async (req, res) => {
  const settings = await db.collection("settings").findOne({ _id: "config" });
  res.json({ startTime: (settings && settings.startTime) || "08:00" });
}));

// Filet de sécurité final : toute erreur non prévue ailleurs renvoie du JSON
// propre au lieu de la page d'erreur HTML par défaut d'Express.
app.use((err, req, res, next) => {
  console.error("Erreur non gérée :", err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "Erreur serveur inattendue. Réessaie dans un instant." });
});

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`AKSAM PointageDistance lancé sur http://localhost:${PORT}`);
    console.log(`  Accueil  : http://localhost:${PORT}/`);
    console.log(`  Employés : http://localhost:${PORT}/employe.html`);
    console.log(`  Connexion admin : http://localhost:${PORT}/login.html`);
  });
});
