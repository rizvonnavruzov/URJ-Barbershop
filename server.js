const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DB_FILE = path.join(__dirname, 'db.json');
const ADMIN_PASSWORD = 'admin123'; // Simple password for now

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

// Simple Admin Auth Middleware
const adminAuth = (req, res, next) => {
    const password = req.headers['x-admin-password'];
    if (password === ADMIN_PASSWORD) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized: Invalid admin password' });
    }
};

// Initialize DB if not exists
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ bookings: [] }, null, 2));
}

// Get taken slots for a date (only confirmed/pending, not rejected)
app.get('/api/bookings', (req, res) => {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'Date is required' });

    const db = JSON.parse(fs.readFileSync(DB_FILE));
    const takenSlots = db.bookings
        .filter(b => b.date === date && b.status !== 'rejected')
        .map(b => b.time);

    res.json(takenSlots);
});

// Check individual booking status
app.get('/api/booking-status/:id', (req, res) => {
    const db = JSON.parse(fs.readFileSync(DB_FILE));
    const booking = db.bookings.find(b => b.id === req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    res.json({ status: booking.status });
});

// Create a booking (starts as pending)
app.post('/api/book', (req, res) => {
    const { name, phone, service, date, time, bank } = req.body;

    if (!name || !phone || !service || !date || !time || !bank) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    const dayOfWeek = new Date(date).getDay();

    if (service === 'haircut') {
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            return res.status(400).json({ error: 'Haircuts are only available on Saturday and Sunday' });
        }
    } else if (service === 'beard') {
        if (dayOfWeek !== 5) {
            return res.status(400).json({ error: 'Beard trims are only available on Friday' });
        }
    }

    const db = JSON.parse(fs.readFileSync(DB_FILE));
    const conflict = db.bookings.find(b => b.date === date && b.time === time && b.status !== 'rejected');
    if (conflict) {
        return res.status(400).json({ error: 'This slot is already booked' });
    }

    const newBooking = { 
        id: Math.random().toString(36).substr(2, 9),
        name, phone, service, date, time, bank, 
        status: 'pending',
        timestamp: new Date().toISOString() 
    };
    db.bookings.push(newBooking);
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    
    res.json({ message: 'Booking pending confirmation!', id: newBooking.id });
});

// ADMIN API: Get all bookings
app.get('/api/admin/bookings', adminAuth, (req, res) => {
    const db = JSON.parse(fs.readFileSync(DB_FILE));
    res.json(db.bookings);
});

// ADMIN API: Update status
app.post('/api/admin/update-status', adminAuth, (req, res) => {
    const { id, status } = req.body;
    if (!id || !status) return res.status(400).json({ error: 'ID and status required' });

    const db = JSON.parse(fs.readFileSync(DB_FILE));
    const booking = db.bookings.find(b => b.id === id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    booking.status = status;
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    res.json({ message: `Booking ${status}` });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
