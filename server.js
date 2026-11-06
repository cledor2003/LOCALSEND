const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 10000;

// --- CONFIGURATION ESSENTIELLE POUR RENDER (Proxy) ---
app.set('trust proxy', 1);

// --- MIDDLEWARES ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuration des sessions sécurisées pour le cloud
app.use(session({
    secret: 'cle_secrete_localsend_aksam',
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: false, 
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 heures
    }
}));

// --- MIDDLEWARE DE PROTECTION ADMIN ---
function verifierAdmin(req, res, next) {
    if (req.session && req.session.isAdmin) {
        return next();
    }
    return res.redirect('/login.html');
}

// Servir les fichiers publics (index, login, styles, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// --- ROUTE PROTÉGÉE POUR ADMIN ---
app.get('/admin.html', verifierAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'private', 'admin.html'));
});

// --- MODÈLE EMPLOYÉ ---
const employeeSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    pin: { type: String }
});
const Employee = mongoose.model('Employee', employeeSchema);

// --- FONCTION INITIALISATION ADMIN ---
async function initDefaultAdmin() {
    console.log('✅ Système AKSAM initialisé avec succès.');
}

// --- ROUTE DE CONNEXION UNIFIÉE (Admin & Employés) ---
app.post('/api/login', async (req, res) => {
    const { username, password, pin, code, role, type } = req.body;
    
    const secretUtilise = (password || pin || code || '').toString().trim();
    const roleSelectionne = (role || type || username || '').toString().toLowerCase();

    // 1. CAS DE L'ADMINISTRATEUR
    if (secretUtilise === 'aksam2026' || (roleSelectionne.includes('admin') && secretUtilise === 'aksam2026')) {
        req.session.isAdmin = true;
        req.session.userType = 'admin';
        req.session.userName = 'Administrateur';
        
        return req.session.save((err) => {
            if (err) return res.status(500).json({ success: false, error: 'Erreur de session serveur.' });
            return res.json({ success: true, redirect: '/admin.html' });
        });
    }
    
    // 2. CAS D'UN EMPLOYÉ / COLLABORATEUR
    try {
        const nomCherche = (username || '').trim();
        const employeTrouve = await Employee.findOne({ 
            $or: [{ name: nomCherche }, { pin: secretUtilise }] 
        });
        
        if (employeTrouve) {
            req.session.isAdmin = false;
            req.session.userType = 'employee';
            req.session.userName = employeTrouve.name;
            
            return req.session.save((err) => {
                if (err) return res.status(500).json({ success: false, error: 'Erreur de session serveur.' });
                return res.json({ success: true, redirect: '/employe.html' });
            });
        }
    } catch (e) {
        console.error("Erreur recherche employé:", e);
    }
    
    // Si aucun compte ne correspond
    res.status(401).json({ success: false, error: 'Identifiant ou code PIN incorrect.' });
});

// --- ROUTE POUR RÉCUPÉRER L'UTILISATEUR CONNECTÉ (Évite le "undefined") ---
app.get('/api/current-user', (req, res) => {
    if (req.session && req.session.userName) {
        return res.json({ 
            loggedIn: true, 
            name: req.session.userName, 
            isAdmin: req.session.isAdmin || false 
        });
    }
    res.json({ loggedIn: false });
});

// --- ROUTE DE DÉCONNEXION ---
app.get('/api/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/index.html');
    });
});

// --- ROUTES API GESTION EMPLOYÉS ---
app.get('/api/admin/employes', async (req, res) => {
    try {
        const employes = await Employee.find();
        res.json(employes);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/employes', async (req, res) => {
    try {
        const { name, pin } = req.body;
        if (name) {
            await Employee.findOneAndUpdate({ name }, { name, pin }, { upsert: true, new: true });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
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

// --- CONNEXION MONGODB ATLAS ---
const MONGO_URI = process.env.MONGODB_URI || "mongodb+srv://sowcledor400_db_user:YblwacNjVehm97If@cluster0.louf7rl.mongodb.net/pointage?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(MONGO_URI)
.then(async () => {
    console.log('✅ AKSAM connecté avec succès à Cluster0 (Persistance Cloud Active)');
    await initDefaultAdmin();
    app.listen(PORT, () => {
        console.log(`🚀 Serveur AKSAM opérationnel sur le port ${PORT}`);
    });
})
.catch(err => {
    console.error('❌ Erreur de connexion MongoDB Atlas:', err.message);
});