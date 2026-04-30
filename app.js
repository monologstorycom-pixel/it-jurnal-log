require('dotenv').config();

const express    = require('express');
const bodyParser = require('body-parser');
const path       = require('path');
const fs         = require('fs');
const session    = require('express-session');

const { injectLocals } = require('./middleware/auth');
const { uploadDir }    = require('./helpers/photo');

// ==========================================
// ROUTES
// ==========================================
const authRoutes    = require('./routes/auth');
const journalRoutes = require('./routes/journal');
const auditRoutes   = require('./routes/audit');
const asetRoutes    = require('./routes/aset');
const vendorRoutes  = require('./routes/vendor');
const usersRoutes   = require('./routes/users');
const aiRoutes      = require('./routes/ai');

const app = express();

// ==========================================
// VIEW ENGINE
// ==========================================
app.set('view engine', 'ejs');

// ==========================================
// BODY PARSER
// ==========================================
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ==========================================
// STATIC FILES
// ==========================================
app.use('/uploads', express.static(uploadDir));
app.use(express.static(path.resolve(__dirname, 'public')));

// ==========================================
// SESSION
// ==========================================
app.use(session({
    secret:            'itlog-rsby-secret-2026',
    resave:            false,
    saveUninitialized: false,
    cookie:            { maxAge: 8 * 60 * 60 * 1000 }
}));

// ==========================================
// INJECT LOCALS (currentUser, userPerms)
// ==========================================
app.use(injectLocals);

// ==========================================
// MOUNT ROUTES
// ==========================================
app.use('/', authRoutes);
app.use('/', journalRoutes);
app.use('/', auditRoutes);
app.use('/', asetRoutes);
app.use('/', vendorRoutes);
app.use('/', usersRoutes);
app.use('/', aiRoutes);

// ==========================================
// START SERVER
// ==========================================
app.listen(3001, '0.0.0.0', () => {
    console.log('🚀 SYSTEM READY AT PORT 3001');
    console.log('📁 Upload directory:', uploadDir);
    if (!fs.existsSync(uploadDir)) {
        console.warn('⚠️  Upload directory tidak ditemukan, membuat...');
        fs.mkdirSync(uploadDir, { recursive: true });
    }
});
