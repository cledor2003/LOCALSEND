const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, "data", "db.json");

app.use(express.json());
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

// --- Employees ---
app.get("/api/employees", (req, res) => {
  const db = readDB();
  res.json(db.employees);
});

app.post("/api/employees", (req, res) => {
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

app.delete("/api/employees/:id", (req, res) => {
  const db = readDB();
  db.employees = db.employees.filter((e) => e.id !== req.params.id);
  writeDB(db);
  res.json({ ok: true });
});

// --- Records (pointages) ---
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

// --- Settings ---
app.get("/api/settings", (req, res) => {
  const db = readDB();
  res.json({ startTime: db.startTime || "08:00" });
});

app.put("/api/settings", (req, res) => {
  const { startTime } = req.body;
  const db = readDB();
  db.startTime = startTime || db.startTime;
  writeDB(db);
  res.json({ startTime: db.startTime });
});

app.listen(PORT, () => {
  console.log(`PointageDistance lancé sur http://localhost:${PORT}`);
  console.log(`  Employés : http://localhost:${PORT}/employe.html`);
  console.log(`  Admin    : http://localhost:${PORT}/admin.html`);
});
