const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, "data", "db.json");

const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "aksam2026";

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

app.get("/admin.html", requireAdminAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.post("/api/employees", requireAdminAuth, (req, res) => {
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

app.delete("/api/employees/:id", requireAdminAuth, (req, res) => {
  const db = readDB();
  db.employees = db.employees.filter((e) => e.id !== req.params.id);
  writeDB(db);
  res.json({ ok: true });
});

app.put("/api/settings", requireAdminAuth, (req, res) => {
  const { startTime } = req.body;
  const db = readDB();
  db.startTime = startTime || db.startTime;
  writeDB(db);
  res.json({ startTime: db.startTime });
});

app.use(express.static(path.join(__dirname, "public")));

function ensureDataDir() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
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

app.get("/api/employees", (req, res) => {
  const db = readDB();
  res.json(db.employees);
});

app.get("/api/records", (req, res) => {
  const db = readDB();
  res.json(db.records);
});

app.post("/api/records", (req, res) => {
  const { employeeId, pin, lat, lng, accuracy } = req.body;
  const db = readDB();
  const employee = db.employees.find((e) => e.id === employeeId);
  if (!employee) return res.status(404).json({ error: "Employé introuvable" });
  if (employee.pin !== pin) return res.status(401).json({ error: "Code PIN incorrect" });

  const own = db.records
    .filter((r) => r.employeeId === employeeId)
    .sort((a, b) => new Date(b.ts) - new Date(a.ts));
  const lastType = own[0] ? own[0].type : "out";
  const type = lastType === "out" ? "in" : "out";

  const record = {
    id: `rec_${Date.now()}`,
    employeeId,
    type,
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
  console.log(`PointageDistance lancé sur http://localhost:${PORT}`);
  console.log(`  Employés : http://localhost:${PORT}/employe.html`);
  console.log(`  Admin    : http://localhost:${PORT}/admin.html (protégé par mot de passe)`);
});
