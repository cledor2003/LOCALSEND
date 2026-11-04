const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_FILE = path.join(__dirname, 'data.json');

function loadData() {
    if (!fs.existsSync(DATA_FILE)) {
        const initialData = {
            employees: [
                { name: 'admin', pin: '0000', role: 'Administrateur', department: 'Direction', status: 'OFFLINE', location: 'Non localisé', lastTask: 'Aucun', startTime: '--:--', pauseTime: '--:--', endTime: '--:--', currentApp: 'Aucune' }
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

// Enregistrement des Statuts, Horaires et Application active
app.post('/api/pointage', (req, res) => {
    const { employe, status, location, currentApp } = req.body;
    const db = loadData();
    const emp = db.employees.find(e => e.name === employe);
    
    if (emp) {
        emp.status = status;
        if (location) emp.location = location;
        if (currentApp) emp.currentApp = currentApp;
        
        const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        if (status === 'ONLINE') emp.startTime = now;
        if (status === 'PAUSE') emp.pauseTime = now;
        if (status === 'OFFLINE') emp.endTime = now;

        saveData(db);
        return res.json({ success: true });
    }
    res.status(404).json({ success: false, message: 'Employé non trouvé' });
});

app.post('/api/taches', (req, res) => {
    const { employe, tache, currentApp } = req.body;
    const db = loadData();
    
    db.tasks.unshift({ employe, tache, currentApp: currentApp || 'Non spécifié', date: new Date() });
    const emp = db.employees.find(e => e.name === employe);
    if (emp) {
        emp.lastTask = tache;
        if (currentApp) emp.currentApp = currentApp;
    }

    saveData(db);
    res.json({ success: true });
});

app.get('/api/admin/data', (req, res) => {
    const db = loadData();
    let statuses = {};
    db.employees.forEach(e => {
        statuses[e.name] = { 
            status: e.status || 'OFFLINE', 
            location: e.location || 'Non localisé', 
            lastTask: e.lastTask || 'Aucun',
            role: e.role || 'Employé',
            department: e.department || 'Général',
            startTime: e.startTime || '--:--',
            pauseTime: e.pauseTime || '--:--',
            endTime: e.endTime || '--:--',
            currentApp: e.currentApp || 'Non renseigné'
        };
    });

    res.json({ statuses, tasks: db.tasks.slice(0, 20) });
});

app.post('/api/admin/employes', (req, res) => {
    const { name, pin, role, department } = req.body;
    if (!name || !pin) return res.status(400).json({ success: false, message: 'Nom et PIN requis' });

    const db = loadData();
    if (db.employees.some(e => e.name === name)) {
        return res.status(400).json({ success: false, message: 'Cet employé existe déjà' });
    }

    db.employees.push({
        name, pin, role: role || 'Employé', department: department || 'Général',
        status: 'OFFLINE', location: 'Non localisé', lastTask: 'Aucun',
        startTime: '--:--', pauseTime: '--:--', endTime: '--:--', currentApp: 'Aucune'
    });

    saveData(db);
    res.json({ success: true, message: 'Employé créé' });
});

app.delete('/api/admin/employes/:name', (req, res) => {
    const db = loadData();
    db.employees = db.employees.filter(e => e.name !== req.params.name);
    saveData(db);
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});