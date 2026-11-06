const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 10000;

// --- CONFIGURATION RENDER PROXY ---
app.set('trust proxy', 1);

// --- MIDDLEWARES ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: 'cle_secrete_localsend_aksam',
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: false, 
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 
    }
}));

// --- MIDDLEWARE DE PROTECTION ADMIN ---
function verifierAdmin(req, res, next) {
    if (req.session && req.session.isAdmin) {
        return next();
    }
    return res.status(401).json({ success: false, error: 'Accès non autorisé.' });
}

// Servir les fichiers publics
app.use(express.static(path.join(__dirname, 'public')));

// Route administrative protégée (HTML)
app.get('/admin.html', (req, res, next) => {
    if (req.session && req.session.isAdmin) {
        return res.sendFile(path.join(__dirname, 'private', 'admin.html'));
    }
    return res.redirect('/login.html');
});

// --- MODÈLE EMPLOYÉ ---
const employeeSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    pin: { type: String }
});
const Employee = mongoose.model('Employee', employeeSchema);

// --- 1. CONNEXION ADMIN ---
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    
    if (username === 'admin' && password === 'aksam2026') {
        req.session.isAdmin = true;
        req.session.userType = 'admin';
        req.session.userName = 'Administrateur';
        
        return req.session.save((err) => {
            if (err) return res.status(500).json({ success: false, error: 'Erreur session.' });
            return res.json({ success: true, redirect: '/admin.html' });
        });
    }
    
    return res.status(401).json({ success: false, error: 'Identifiant ou mot de passe administrateur incorrect.' });
});

// --- 2. CONNEXION EMPLOYÉ ---
app.post('/api/employe/login', async (req, res) => {
    const { username } = req.body;
    const nomCherche = (username || '').trim();

    try {
        const employeTrouve = await Employee.findOne({ name: nomCherche });
        
        if (employeTrouve) {
            req.session.isAdmin = false;
            req.session.userType = 'employee';
            req.session.userName = employeTrouve.name;
            
            return req.session.save((err) => {
                if (err) return res.status(500).json({ success: false, error: 'Erreur session.' });
                return res.json({ success: true, redirect: '/employe.html' });
            });
        }
    } catch (e) {
        console.error("Erreur login employé:", e);
    }
    
    return res.status(401).json({ success: false, error: "Nom d'employé non reconnu dans la base de données." });
});

// --- ROUTE UTILISATEUR ACTUEL ---
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

// --- DÉCONNEXION ---
app.get('/api/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/index.html');
    });
});

// --- GESTION DES EMPLOYÉS (Sécurisé Admin) ---
app.get('/api/admin/employes', verifierAdmin, async (req, res) => {
    try {
        const employes = await Employee.find();
        res.json(employes);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/employes', verifierAdmin, async (req, res) => {
    try {
        const { name, pin } = req.body;
        if (!name) {
            return res.status(400).json({ success: false, error: "Le nom est requis." });
        }
        await Employee.findOneAndUpdate(
            { name: name.trim() }, 
            { name: name.trim(), pin: pin ? pin.trim() : '' }, 
            { upsert: true, new: true }
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.delete('/api/admin/employes/:name', verifierAdmin, async (req, res) => {
    try {
        await Employee.findOneAndDelete({ name: req.params.name });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// --- CONNEXION MONGODB ATLAS ---
const MONGO_URI = process.env.MONGODB_URI || "mongodb+srv://sowcledor400_db_user:YblwacNjVehm97If@cluster0.louf7rl.mongodb.net/pointage?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(MONGO_URI)
.then(async () => {
    console.log('✅ AKSAM connecté avec succès à Cluster0 (Persistance Cloud Active)');
    app.listen(PORT, () => {
        console.log(`🚀 Serveur AKSAM opérationnel sur le port ${PORT}`);
    });
})
.catch(err => {
    console.error('❌ Erreur de connexion MongoDB Atlas:', err.message);
});