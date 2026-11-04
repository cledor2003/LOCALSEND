const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// --- SCHÉMAS MONGOOSE ---
const employeeSchema = new mongoose.Schema({
    name: { type: String, unique: true, required: true },
    pin: { type: String, required: true },
    role: { type: String, default: 'Employé' },
    department: { type: String, default: 'Général' },
    phone: { type: String, default: '' },
    avatar: { type: String, default: '' },
    status: { type: String, default: 'OFFLINE' },
    location: { type: String, default: 'Non localisé' },
    lastTask: { type: String, default: 'Aucun' },
    startTime: { type: String, default: '--:--' },
    pauseTime: { type: String, default: '--:--' },
    endTime: { type: String, default: '--:--' },
    currentApp: { type: String, default: 'Aucune' }
});

const taskSchema = new mongoose.Schema({
    employe: String,
    tache: String,
    currentApp: String,
    screenshots: [String],
    date: { type: Date, default: Date.now }
});

const Employee = mongoose.model('Employee', employeeSchema);
const Task = mongoose.model('Task', taskSchema);

// Initialisation automatique du compte Admin si la base est neuve
async function initDefaultAdmin() {
    try {
        const adminCount = await Employee.countDocuments({ role: 'Administrateur' });
        if (adminCount === 0) {
            await Employee.create({
                name: 'admin',
                pin: process.env.ADMIN_PASSWORD || '0000',
                role: 'Administrateur',
                department: 'Direction',
                phone: '',
                avatar: '',
                status: 'OFFLINE'
            });
            console.log('✅ Compte Admin par défaut initialisé dans la base de données.');
        }
    } catch (err) {
        console.error('Erreur initialisation admin:', err.message);
    }
}

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
        if (emp) {
            return res.json({ success: true, role: 'employee', name: emp.name, avatar: emp.avatar || '' });
        }
        res.status(401).json({ success: false, message: 'Identifiants invalides' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

app.post('/api/pointage', async (req, res) => {
    const { employe, status, location, currentApp } = req.body;
    try {
        const updateData = { status };
        if (location) updateData.location = location;
        if (currentApp) updateData.currentApp = currentApp;

        const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        if (status === 'ONLINE') updateData.startTime = now;
        if (status === 'PAUSE') updateData.pauseTime = now;
        if (status === 'OFFLINE') updateData.endTime = now;

        await Employee.findOneAndUpdate({ name: employe }, updateData);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/employee/avatar', async (req, res) => {
    const { employe, avatar } = req.body;
    try {
        await Employee.findOneAndUpdate({ name: employe }, { avatar });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/taches', async (req, res) => {
    const { employe, tache, currentApp, screenshots } = req.body;
    try {
        await Task.create({ 
            employe, 
            tache, 
            currentApp: currentApp || 'Non spécifié', 
            screenshots: screenshots || [] 
        });

        const updateData = { lastTask: tache };
        if (currentApp) updateData.currentApp = currentApp;
        await Employee.findOneAndUpdate({ name: employe }, updateData);

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
                status: e.status || 'OFFLINE', 
                location: e.location || 'Non localisé', 
                lastTask: e.lastTask || 'Aucun',
                role: e.role || 'Employé',
                department: e.department || 'Général',
                phone: e.phone || '',
                avatar: e.avatar || '',
                startTime: e.startTime || '--:--',
                pauseTime: e.pauseTime || '--:--',
                endTime: e.endTime || '--:--',
                currentApp: e.currentApp || 'Non renseigné'
            };
        });

        res.json({ statuses, tasks });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/admin/employes', async (req, res) => {
    const { name, pin, role, department, phone, avatar } = req.body;
    if (!name || !pin) return res.status(400).json({ success: false, message: 'Nom et PIN requis' });

    try {
        const existing = await Employee.findOne({ name });
        if (existing) {
            return res.status(400).json({ success: false, message: 'Cet employé existe déjà' });
        }

        await Employee.create({ 
            name, pin, 
            role: role || 'Employé', 
            department: department || 'Général',
            phone: phone || '',
            avatar: avatar || '',
            status: 'OFFLINE', 
            location: 'Non localisé', 
            lastTask: 'Aucun',
            startTime: '--:--', pauseTime: '--:--', endTime: '--:--', currentApp: 'Aucune' 
        });
        res.json({ success: true, message: 'Employé créé' });
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

// --- CONNEXION MONGODB ATLAS (Format Direct Sans SRV) ---
const MONGO_URI = process.env.MONGODB_URI || "mongodb://sowcledor400_db_user:Aksam2026DbPass@cluster0-shard-00-00.41hehnt.mongodb.net:27017,cluster0-shard-00-01.41hehnt.mongodb.net:27017,cluster0-shard-00-02.41hehnt.mongodb.net:27017/pointage?ssl=true&replicaSet=atlas-13b3x3-shard-0&authSource=admin&retryWrites=true&w=majority";

mongoose.connect(MONGO_URI)
  .then(async () => {
      console.log('✅ AKSAM est connecté à MongoDB Atlas avec succès !');
      await initDefaultAdmin();
      app.listen(PORT, () => {
          console.log(`🚀 Serveur AKSAM opérationnel sur le port ${PORT}`);
      });
  })
  .catch(err => {
      console.error('❌ Erreur de connexion MongoDB Atlas:', err.message);
  });