const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 10000;

app.set('trust proxy', 1);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(session({
    secret: 'cle_secrete_localsend_aksam',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
}));

function verifierAdmin(req, res, next) {
    if (req.session && req.session.isAdmin) return next();
    return res.status(401).json({ success: false, error: 'Accès non autorisé.' });
}

app.use(express.static(path.join(__dirname, 'public')));

app.get('/admin.html', (req, res) => {
    if (req.session && req.session.isAdmin) {
        return res.sendFile(path.join(__dirname, 'private', 'admin.html'));
    }
    return res.redirect('/login.html');
});

// --- MODÈLES MONGODB ---
const employeeSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    pin: { type: String },
    role: { type: String, default: 'Employé' },
    department: { type: String, default: 'Informatique / IT' },
    phone: { type: String },
    avatar: { type: String },
    status: { type: String, default: 'OFFLINE' },
    currentApp: { type: String, default: 'Aucune' },
    location: { type: String, default: 'Non localisé' },
    startTime: { type: String, default: '--:--' },
    pauseTime: { type: String, default: '--:--' },
    endTime: { type: String, default: '--:--' },
    lastTask: { type: String, default: '' }
});
const Employee = mongoose.model('Employee', employeeSchema);

const reportSchema = new mongoose.Schema({
    employe: String,
    currentApp: String,
    tache: String,
    screenshots: [String],
    date: { type: Date, default: Date.now }
});
const Report = mongoose.model('Report', reportSchema);

const meetingSchema = new mongoose.Schema({
    title: { type: String, required: true },
    date: { type: String, required: true },
    time: { type: String, required: true },
    organizer: { type: String, required: true },
    participants: [String],
    link: { type: String, required: true }, // Lien rendu obligatoire
    createdAt: { type: Date, default: Date.now }
});
const Meeting = mongoose.model('Meeting', meetingSchema);

// --- ROUTES AUTH ---
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === 'aksam2026') {
        req.session.isAdmin = true;
        req.session.userName = 'Administrateur';
        return req.session.save(() => res.json({ success: true, redirect: '/admin.html' }));
    }
    return res.status(401).json({ success: false, error: 'Identifiants incorrects.' });
});

app.post('/api/employe/login', async (req, res) => {
    const { username, pin } = req.body;
    try {
        const query = { name: (username || '').trim() };
        if (pin) query.pin = pin.trim();
        
        const employe = await Employee.findOne(query);
        if (employe) {
            req.session.isAdmin = false;
            req.session.userName = employe.name;
            return req.session.save(() => res.json({ success: true, redirect: '/employe.html' }));
        }
    } catch (e) {
        console.error(e);
    }
    return res.status(401).json({ success: false, error: 'Nom ou code PIN incorrect.' });
});

app.get('/api/current-user', (req, res) => {
    if (req.session && req.session.userName) {
        return res.json({ loggedIn: true, name: req.session.userName, isAdmin: req.session.isAdmin || false });
    }
    res.json({ loggedIn: false });
});

app.get('/api/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/index.html'));
});

// --- API ADMIN & DATA ---
app.get('/api/admin/data', verifierAdmin, async (req, res) => {
    try {
        const employees = await Employee.find();
        const reports = await Report.find().sort({ date: -1 }).limit(50);
        const meetings = await Meeting.find().sort({ createdAt: -1 });
        
        const statuses = {};
        employees.forEach(emp => {
            statuses[emp.name] = {
                role: emp.role,
                department: emp.department,
                phone: emp.phone,
                avatar: emp.avatar,
                status: emp.status,
                currentApp: emp.currentApp,
                location: emp.location,
                startTime: emp.startTime,
                pauseTime: emp.pauseTime,
                endTime: emp.endTime,
                lastTask: emp.lastTask
            };
        });

        res.json({ success: true, statuses, tasks: reports, meetings });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/admin/employes', verifierAdmin, async (req, res) => {
    try {
        const { name, pin, role, department, phone, avatar } = req.body;
        if (!name) return res.status(400).json({ success: false, error: "Le nom est requis." });
        
        await Employee.findOneAndUpdate(
            { name: name.trim() }, 
            { name: name.trim(), pin, role, department, phone, avatar }, 
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

// --- API RÉUNIONS ---
app.post('/api/meetings', verifierAdmin, async (req, res) => {
    try {
        const { title, date, time, participants, link } = req.body;
        if (!link) {
            return res.status(400).json({ success: false, error: "Le lien de réunion est obligatoire." });
        }
        const newMeeting = await Meeting.create({
            title,
            date,
            time,
            organizer: req.session.userName || 'Administrateur',
            participants: participants || [],
            link
        });
        res.json({ success: true, meeting: newMeeting });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/meetings', async (req, res) => {
    if (!req.session || !req.session.userName) return res.status(401).json({ error: 'Non connecté' });
    try {
        const userName = req.session.userName;
        let meetings;
        if (req.session.isAdmin) {
            meetings = await Meeting.find().sort({ createdAt: -1 });
        } else {
            meetings = await Meeting.find({
                $or: [{ organizer: userName }, { participants: userName }]
            }).sort({ createdAt: -1 });
        }
        res.json({ success: true, meetings });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// --- API EMPLOYÉ (Pointage & Rapports) ---
app.post('/api/employe/status', async (req, res) => {
    if (!req.session || !req.session.userName) return res.status(401).json({ error: 'Non connecté' });
    try {
        const { status, currentApp, location, time } = req.body;
        const updateData = { status, currentApp, location };
        if (status === 'ONLINE') updateData.startTime = time;
        if (status === 'PAUSE') updateData.pauseTime = time;
        if (status === 'OFFLINE') updateData.endTime = time;

        await Employee.findOneAndUpdate({ name: req.session.userName }, updateData);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/employe/report', async (req, res) => {
    if (!req.session || !req.session.userName) return res.status(401).json({ error: 'Non connecté' });
    try {
        const { currentApp, tache, screenshots } = req.body;
        await Report.create({
            employe: req.session.userName,
            currentApp: currentApp || 'Général',
            tache,
            screenshots: screenshots || []
        });
        await Employee.findOneAndUpdate({ name: req.session.userName }, { lastTask: tache });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const MONGO_URI = process.env.MONGODB_URI || "mongodb+srv://sowcledor400_db_user:YblwacNjVehm97If@cluster0.louf7rl.mongodb.net/pointage?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(MONGO_URI)
.then(() => {
    console.log('✅ Connecté à MongoDB Atlas');
    app.listen(PORT, () => console.log(`🚀 Serveur actif sur le port ${PORT}`));
})
.catch(err => console.error('❌ Erreur MongoDB:', err.message));