const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, "data", "db.json");

const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "aksam2026";
const SESSION_COOKIE = "aksam_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h

// Sessions gardées en mémoire (suffisant pour une seule instance du serveur)
const sessions = new Map(); // token -> expiry timestamp

function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    out[k] = decodeURIComponent(v);
  });
  return out;
}

function isAuthenticated(req) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
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

// --- Auth ---
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
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  if (token) sessions.delete(token);
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
  res.json({ ok: true });
});

app.get("/api/session", (req, res) => {
  res.json({ authenticated: isAuthenticated(req) });
});

// --- Page admin protégée : redirige vers /login.html si pas connecté ---
app.get("/admin.html", requireAdminPage, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// --- Actions admin protégées ---
app.post("/api/employees", requireAdminApi, (req, res) => {
  const { name, pin } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "Nom requis" });
  const db = readDB();
  const employee = {
    id: `emp_${Date.now()}`,
    name: name.trim(),
    pin: /^\d{4}$/.test(pin || "") ? pin : randomPin(),
  };
  db.employees.push(employee);
  writeDB(db);
  res.json(employee);
});

app.delete("/api/employees/:id", requireAdminApi, (req, res) => {
  const db = readDB();
  db.employees = db.employees.filter((e) => e.id !== req.params.id);
  writeDB(db);
  res.json({ ok: true });
});

app.put("/api/settings", requireAdminApi, (req, res) => {
  const { startTime } = req.body;
  const db = readDB();
  db.startTime = startTime || db.startTime;
  writeDB(db);
  res.json({ startTime: db.startTime });
});

// --- Fichiers statiques publics (login.html, employe.html, index.html, style.css...) ---
app.use(express.static(path.join(__dirname, "public")));

function ensureDataDir() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readDB() {
  ensureDataDir();
  if (!fs.existsSync(DB_PATH)) {
    const initial = { employees: [], records: [], startTime: "08:00" };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
}

function writeDB(db) {
  ensureDataDir();
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function randomPin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function todayKey(iso) {
  return new Date(iso).toISOString().slice(0, 10);
}

// État autorisé : quelles actions sont valides selon le dernier pointage du jour
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
      return []; // journée terminée
    default:
      return ["in"];
  }
}

app.get("/api/employees", (req, res) => {
  const db = readDB();
  res.json(db.employees);
});

app.get("/api/records", (req, res) => {
  const db = readDB();
  res.json(db.records);
});

app.post("/api/records", (req, res) => {
  const { employeeId, pin, action, lat, lng, accuracy } = req.body;
  const db = readDB();
  const employee = db.employees.find((e) => e.id === employeeId);
  if (!employee) return res.status(404).json({ error: "Employé introuvable" });
  if (employee.pin !== pin) return res.status(401).json({ error: "Code PIN incorrect" });

  const today = todayKey(new Date().toISOString());
  const todaysOwn = db.records
    .filter((r) => r.employeeId === employeeId && todayKey(r.ts) === today)
    .sort((a, b) => new Date(b.ts) - new Date(a.ts));
  const lastType = todaysOwn[0] ? todaysOwn[0].type : null;
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
  db.records.push(record);
  writeDB(db);
  res.json(record);
});

app.get("/api/settings", (req, res) => {
  const db = readDB();
  res.json({ startTime: db.startTime || "08:00" });
});

app.listen(PORT, () => {
  console.log(`AKSAM PointageDistance lancé sur http://localhost:${PORT}`);
  console.log(`  Accueil  : http://localhost:${PORT}/`);
  console.log(`  Employés : http://localhost:${PORT}/employe.html`);
  console.log(`  Connexion admin : http://localhost:${PORT}/login.html`);
});
