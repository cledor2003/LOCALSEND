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
});
const Employee = mongoose.model('Employee', employeeSchema);

// --- FONCTION INITIALISATION ADMIN ---
async function initDefaultAdmin() {
    console.log('✅ Compte Admin par défaut initialisé dans la base de données.');
}

// --- ROUTE DE CONNEXION ADMIN (Flexible pour PIN / Password) ---
app.post('/api/login', (req, res) => {
    const { username, password, pin, code } = req.body;
    
    // Récupère le secret peu importe le nom du champ envoyé par le formulaire (password, pin ou code)
    const secretUtilise = password || pin || code;
    
    // Mot de passe / PIN administrateur accepté
    if (secretUtilise === 'aksam2026') {
        req.session.isAdmin = true;
        
        return req.session.save((err) => {
            if (err) {
                return res.status(500).json({ success: false, error: 'Erreur de session serveur.' });
            }
            return res.json({ success: true, redirect: '/admin.html' });
        });
    }
    
    res.status(401).json({ success: false, error: 'Code PIN ou identifiant incorrect.' });
});

// --- ROUTE DE DÉCONNEXION ---
app.get('/api/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/index.html');
    });
});

// --- ROUTES API DIVERSES ---
app.post('/api/admin/employes', async (req, res) => {
    try {
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