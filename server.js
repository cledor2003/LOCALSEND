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

// --- PROTECTION ROUTE ADMIN ---
function verifierAdmin(req, res, next) {
    if (req.session && req.session.isAdmin) {
        return next();
    }
    return res.redirect('/index.html');
}

// Servir les fichiers publics
app.use(express.static(path.join(__dirname, 'public')));

// Route administrative privée
app.get('/admin.html', verifierAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'private', 'admin.html'));
});

// --- MODÈLES MONGODB ---
const employeeSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    pin: { type: String }
});
const Employee = mongoose.model('Employee', employeeSchema);

async function initDefaultAdmin() {
    console.log('✅ Initialisation du système terminée.');
}

// --- ROUTE DE CONNEXION FLEXIBLE ---
app.post('/api/login', async (req, res) => {
    const { username, password, pin, code, role, type } = req.body;
    
    // Récupère la valeur saisie dans le champ secret/PIN
    const secretUtilise = (password || pin || code || '').toString().trim();
    // Récupère le type de rôle sélectionné dans la liste déroulante
    const roleSelectionne = (role || type || username || '').toString().toLowerCase();

    // 1. CONNEXION ADMINISTRATEUR
    // Valide si le mot de passe est aksam2026 OU si le rôle choisi est administrateur avec aksam2026
    if (secretUtilise === 'aksam2026' || (roleSelectionne.includes('admin') && secretUtilise === 'aksam2026')) {
        req.session.isAdmin = true;
        req.session.userType = 'admin';
        req.session.userName = 'Administrateur';
        
        return req.session.save((err) => {
            if (err) return res.status(500).json({ success: false, error: 'Erreur session.' });
            return res.json({ success: true, redirect: '/admin.html' });
        });
    }
    
    // 2. CONNEXION EMPLOYÉ / COLLABORATEUR
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
                if (err) return res.status(500).json({ success: false, error: 'Erreur session.' });
                return res.json({ success: true, redirect: '/employe.html' });
            });
        }
    } catch (e) {
        console.error("Erreur login employé:", e);
    }
    
    // Si la vérification échoue
    res.status(401).json({ success: false, error: 'Identifiant ou code PIN incorrect.' });
});

// --- ROUTE INFORMATIONS SESSION ---
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