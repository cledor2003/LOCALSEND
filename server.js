const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Schémas Mongoose stricts
const employeeSchema = new mongoose.Schema({
    name: { type: String, unique: true, required: true },
    pin: { type: String, required: true },
    role: { type: String, default: 'Employé' },
    department: { type: String, default: 'Général' },
    phone: { type: String, default: '' },
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

app.post('/api/login', async (req, res) => {
    const { name, pin, role } = req.body;
    
    if (role === 'admin') {
        const adminPass = process.env.ADMIN_PASSWORD || '0000';
        if (pin === adminPass) return res.json({ success: true, role: 'admin' });
        return res.status(401).json({ success: false, message: 'Code admin incorrect' });
    }

    try {
        const emp = await Employee.findOne({ name, pin });
        if (emp) return res.json({ success: true, role: 'employee', name: emp.name });
        res.status(401).json({ success: false, message: 'Identifiants invalides' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

app.post('/api/pointage', async (req, res) => {
    const { employe, status, location } = req.body;
    try {
        await Employee.findOneAndUpdate({ name: employe }, { status, location: location || 'GPS Actif' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/taches', async (req, res) => {
    const { employe, tache } = req.body;
    try {
        await Task.create({ employe, tache });
        await Employee.findOneAndUpdate({ name: employe }, { lastTask: tache });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.get('/api/admin/data', async (req, res) => {
    try {
        const employees = await Employee.find({});
        const tasks = await Task.find({}).sort({ date: -1 }).limit(20);
        
        let statuses = {};
        employees.forEach(e => {
            statuses[e.name] = { 
                status: e.status, 
                location: e.location, 
                lastTask: e.lastTask,
                role: e.role,
                department: e.department 
            };
        });

        res.json({ statuses, tasks });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/admin/employes', async (req, res) => {
    const { name, pin, role, department, phone } = req.body;
    if (!name || !pin) {
        return res.status(400).json({ success: false, message: 'Nom et PIN requis' });
    }
    try {
        const existing = await Employee.findOne({ name });
        if (existing) {
            return res.status(400).json({ success: false, message: 'Cet employé existe déjà' });
        }

        await Employee.create({ 
            name, pin, role: role || 'Employé', department: department || 'Général',
            phone: phone || '', status: 'OFFLINE', location: 'Non localisé', lastTask: 'Aucun' 
        });
        res.json({ success: true, message: 'Employé créé avec succès' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.delete('/api/admin/employes/:name', async (req, res) => {
    try {
        await Employee.findOneAndDelete({ name: req.params.name });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// Récupération sécurisée de l'URI MongoDB (prend en compte MONGODB_URI ou MONGO_URI)
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb+srv://sowcledor400_db_user:Aksam2026DbPass@cluster0.41hehnt.mongodb.net/pointage?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI)
  .then(() => {
      console.log('Connecté à MongoDB Atlas avec succès');
      app.listen(PORT, () => {
          console.log(`Serveur démarré et opérationnel sur le port ${PORT}`);
      });
  })
  .catch(err => {
      console.error('Erreur critique de connexion MongoDB Atlas:', err.message);
  });