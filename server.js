const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Fichier de stockage local persistant sur le serveur
const DATA_FILE = path.join(__dirname, 'data.json');

// Charger ou initialiser les données
function loadData() {
    if (!fs.existsSync(DATA_FILE)) {
        const initialData = {
            employees: [
                { name: 'admin', pin: '0000', role: 'Administrateur', department: 'Direction', phone: '', status: 'OFFLINE', location: 'Non localisé', lastTask: 'Aucun' }
            ],
            tasks: []
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
    }
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// --- ROUTES API ---

// Authentification
app.post('/api/login', (req, res) => {
    const { name, pin, role } = req.body;
    const db = loadData();
    
    if (role === 'admin') {
        const adminPass = process.env.ADMIN_PASSWORD || '0000';
        if (pin === adminPass) return res.json({ success: true, role: 'admin' });
        return res.status(401).json({ success: false, message: 'Code admin incorrect' });
    }

    const emp = db.employees.find(e => e.name === name && e.pin === pin);
    if (emp) {
        return res.json({ success: true, role: 'employee', name: emp.name });
    }
    res.status(401).json({ success: false, message: 'Identifiants invalides' });
});

// Pointage GPS et Statut
app.post('/api/pointage', (req, res) => {
    const { employe, status, location } = req.body;
    const db = loadData();
    const emp = db.employees.find(e => e.name === employe);
    if (emp) {
        emp.status = status;
        emp.location = location || 'GPS Actif';
        saveData(db);
        return res.json({ success: true });
    }
    res.status(404).json({ success: false, message: 'Employé non trouvé' });
});

// Rapport de tâches
app.post('/api/taches', (req, res) => {
    const { employe, tache } = req.body;
    const db = loadData();
    
    db.tasks.unshift({ employe, tache, date: new Date() });
    const emp = db.employees.find(e => e.name === employe);
    if (emp) {
        emp.lastTask = tache;
    }
    saveData(db);
    res.json({ success: true });
});

// Admin : Récupérer toutes les données
app.get('/api/admin/data', (req, res) => {
    const db = loadData();
    let statuses = {};
    db.employees.forEach(e => {
        statuses[e.name] = { 
            status: e.status, 
            location: e.location, 
            lastTask: e.lastTask,
            role: e.role,
            department: e.department 
        };
    });

    res.json({ statuses, tasks: db.tasks.slice(0, 20) });
});

// Admin : Créer un employé
app.post('/api/admin/employes', (req, res) => {
    const { name, pin, role, department, phone } = req.body;
    if (!name || !pin) {
        return res.status(400).json({ success: false, message: 'Nom et PIN requis' });
    }

    const db = loadData();
    if (db.employees.some(e => e.name === name)) {
        return res.status(400).json({ success: false, message: 'Cet employé existe déjà' });
    }

    db.employees.push({
        name,
        pin,
        role: role || 'Employé',
        department: department || 'Général',
        phone: phone || '',
        status: 'OFFLINE',
        location: 'Non localisé',
        lastTask: 'Aucun'
    });

    saveData(db);
    res.json({ success: true, message: 'Employé créé avec succès' });
});

// Admin : Supprimer un employé
app.delete('/api/admin/employes/:name', (req, res) => {
    const db = loadData();
    db.employees = db.employees.filter(e => e.name !== req.params.name);
    saveData(db);
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Serveur local performant démarré sur le port ${PORT}`);
});