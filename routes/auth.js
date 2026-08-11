const express = require('express');
const bcrypt  = require('bcryptjs');
const router  = express.Router();

const prisma              = require('../services/prisma');
const { getUserPerms, hasPerm } = require('../helpers/permissions');

// ==========================================
// LOGIN
// ==========================================
router.get('/login', (req, res) => {
    if (req.session && req.session.user) return res.redirect('/');
    res.render('login', { error: null, username: '' });
});

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.render('login', { error: 'Username dan password harus diisi.', username: username || '' });
        }
        const user = await prisma.user.findUnique({ where: { username: username.trim().toLowerCase() } });
        if (!user) {
            return res.render('login', { error: 'Username atau password salah.', username });
        }
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.render('login', { error: 'Username atau password salah.', username });
        }
        req.session.user = {
            id:          user.id,
            username:    user.username,
            nama:        user.nama,
            role:        user.role,
            divisi:      user.divisi || 'IT',
            permissions: user.permissions || null,
            fotoUrl:     user.fotoUrl || null
        };
        const perms = getUserPerms(req.session.user);
        if (perms.canAudit && !perms.canViewLog) return res.redirect('/audit');
        if ((user.role || '').toLowerCase() === 'pelapor') return res.redirect('/tugas');
        if (!perms.canViewLog && perms.canAsset)  return res.redirect('/aset');
        // User dengan role Tugas MTC — langsung ke halaman tugas
        if (perms.canTugasMtc && !perms.canViewLog && !perms.canViewMaintenance) return res.redirect('/tugas');
        // User maintenance (divisi MAINTENANCE) redirect ke dashboard maintenance
        const divisi = (user.divisi || '').toUpperCase();
        if (divisi === 'MAINTENANCE' && perms.canViewLog) return res.redirect('/maintenance');
        // User dengan canViewMaintenance saja (misal HRGA) redirect ke view maintenance
        if (perms.canViewMaintenance && !perms.canViewLog) return res.redirect('/maintenance');
        res.redirect('/kerja');
    } catch (error) {
        console.error('[LOGIN ERROR]', error.message);
        res.render('login', { error: 'Terjadi kesalahan server. Coba lagi.', username: req.body.username || '' });
    }
});

// ==========================================
// LOGOUT
// ==========================================
router.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

// ==========================================
// 403
// ==========================================
router.get('/403', (req, res) => {
    res.status(403).render('403', { message: 'Akses ditolak.' });
});

module.exports = router;
