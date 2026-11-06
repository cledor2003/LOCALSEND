const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session'); // Nécessaire pour gérer la session admin

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
    cookie: { secure: false } // Mettre à true si HTTPS strict avec cookie sécurisé
}));

// Servir uniquement les fichiers réellement publics (index, login, styles, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// --- MODÈLE EMPLOYÉ (Exemple basé sur ton projet) ---
const employeeSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    // autres champs potentiels...
});
const Employee = mongoose.model('Employee', employeeSchema);

// --- FONCTION INITIALISATION ADMIN ---
async function initDefaultAdmin() {
    // Logique d'initialisation de l'admin par défaut si besoin
    console.log('✅ Vérification du compte Admin...');
}

// --- ROUTES API ---
app.post('/api/admin/employes', async (req, res) => {
    try {
        // Logique d'ajout d'employé
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

// Route de connexion (exemple pour valider la session admin)
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    // Vérifie tes identifiants admin ici
    if (username === 'admin' && password === 'aksam2026') {
        req.session.isAdmin = true;
        return res.json({ success: true, redirect: '/admin.html' });
    }
    res.status(401).json({ success: false, message: 'Identifiants incorrects' });
});

// Route de déconnexion
app.get('/api/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/index.html');
    });
});

// --- ROUTE PROTÉGÉE POUR ADMIN ---
// Empêche l'accès direct si la session n'est pas active
app.get('/admin.html', (req, res) => {
    if (req.session && req.session.isAdmin) {
        return res.sendFile(path.join(__dirname, 'private', 'admin.html')); // Ou un dossier sécurisé
    }
    // Si non connecté, redirection automatique vers l'accueil/login
    res.redirect('/index.html');
});

// --- CONNEXION MONGODB ATLAS (Lien validé) ---
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