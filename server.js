const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Connexion MongoDB (ou fallback local)
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/teletravail_db';
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connecté à MongoDB avec succès'))
  .catch(err => console.log('Erreur de connexion MongoDB (Mode local actif)', err.message));

// Schémas Mongoose
const employeeSchema = new mongoose.Schema({
    name: { type: String, unique: true, required: true },
    pin: { type: String, required: true }, // Code secret pour l'accès sécurisé
    status: { type: String, default: 'OFFLINE' },
    location: { type: String, default: 'Non localisé' },
    lastTask: { type: String, default: 'Aucun rapport' }
});

const taskSchema = new mongoose.Schema({
    employe: String,
    tache: String,
    date: { type: Date, default: Date.now }
});

const Employee = mongoose.model('Employee', employeeSchema);
const Task = mongoose.model('Task', taskSchema);

// --- ROUTES API ---

// Authentification Employé / Admin
app.post('/api/login', async (req, res) => {
    const { name, pin, role } = req.body;
    if (role === 'admin') {
        if (pin === '0000') return res.json({ success: true, role: 'admin' });
        return res.status(401).json({ success: false, message: 'Code admin incorrect' });
    }

    try {
        const emp = await Employee.findOne({ name, pin });
        if (emp) return res.json({ success: true, role: 'employee', name: emp.name });
        res.status(401).json({ success: false, message: 'Identifiants invalides' });
    } catch {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// Pointage
app.post('/api/pointage', async (req, res) => {
    const { employe, status, location } = req.body;
    try {
        await Employee.findOneAndUpdate({ name: employe }, { status, location: location || 'GPS Actif' });
        res.json({ success: true });
    } catch {
        res.status(500).json({ success: false });
    }
});

// Rapport de tâches
app.post('/api/taches', async (req, res) => {
    const { employe, tache } = req.body;
    try {
        await Task.create({ employe, tache });
        await Employee.findOneAndUpdate({ name: employe }, { lastTask: tache });
        res.json({ success: true });
    } catch {
        res.status(500).json({ success: false });
    }
});

// Admin : Données globales (Répertoire + Flux)
app.get('/api/admin/data', async (req, res) => {
    try {
        const employees = await Employee.find({});
        const tasks = await Task.find({}).sort({ date: -1 }).limit(20);
        
        // Formatage pour correspondre au front
        let statuses = {};
        employees.forEach(e => {
            statuses[e.name] = { status: e.status, location: e.location, lastTask: e.lastTask };
        });

        res.json({ statuses, tasks });
    } catch {
        res.status(500).json({ success: false });
    }
});

// Admin : Créer un employé
app.post('/api/admin/employes', async (req, res) => {
    const { name, pin } = req.body;
    try {
        await Employee.create({ name, pin: pin || '1234' });
        res.json({ success: true });
    } catch {
        res.status(400).json({ success: false, message: 'Employé déjà existant ou données invalides' });
    }
});

// Admin : Supprimer un employé
app.delete('/api/admin/employes/:name', async (req, res) => {
    try {
        await Employee.findOneAndDelete({ name: req.params.name });
        res.json({ success: true });
    } catch {
        res.status(500).json({ success: false });
    }
});

app.listen(PORT, () => {
    console.log(`Serveur Nexus Télétravail démarré sur le port ${PORT}`);
});