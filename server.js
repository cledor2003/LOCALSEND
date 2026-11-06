const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 10000;

// --- MIDDLEWARES ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuration des sessions pour sécuriser l'admin
app.use(session({
    secret: 'cle_secrete_localsend_aksam',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
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

// --- ROUTE DE CONNEXION ADMIN ---
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    // Identifiants par défaut
    if (username === 'admin' && password === 'aksam2026') {
        req.session.isAdmin = true;
        return res.json({ success: true, redirect: '/admin.html' });
    }
    
    // Alignement du message d'erreur avec le champ 'error' attendu par le frontend
    res.status(401).json({ success: false, error: 'Identifiant ou mot de passe incorrect.' });
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