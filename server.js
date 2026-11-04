// Schéma Mongoose mis à jour
const employeeSchema = new mongoose.Schema({
    name: { type: String, unique: true, required: true },
    pin: { type: String, required: true },
    role: { type: String, default: 'Employé' },
    department: { type: String, default: 'Général' },
    phone: { type: String, default: '' },
    status: { type: String, default: 'OFFLINE' },
    location: { type: String, default: 'Non localisé' },
    lastTask: { type: String, default: 'Aucun rapport' }
});

const Employee = mongoose.model('Employee', employeeSchema);

// Route de création mise à jour
app.post('/api/admin/employes', async (req, res) => {
    const { name, pin, role, department, phone } = req.body;
    if (!name || !pin) {
        return res.status(400).json({ success: false, message: 'Nom et PIN requis' });
    }
    try {
        const existing = await Employee.findOne({ name });
        if (existing) {
            return res.status(400).json({ success: false, message: 'Cet employé existe déjà' });
        }

        await Employee.create({ 
            name, 
            pin, 
            role: role || 'Employé', 
            department: department || 'Général',
            phone: phone || '',
            status: 'OFFLINE', 
            location: 'Non localisé', 
            lastTask: 'Aucun' 
        });
        res.json({ success: true, message: 'Employé créé avec succès' });
    } catch (error) {
        console.error("Erreur création:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});