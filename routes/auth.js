const express = require('express');
const bcrypt  = require('bcryptjs');
const router  = express.Router();

const prisma              = require('../services/prisma');
const { getUserPerms, hasPerm } = require('../helpers/permissions');

// ==========================================
// LOGIN
// ==========================================
router.get('/login', (req, res) => {
    if (req.session && req.session.user) return res.redirect('/kerja');
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
            permissions: user.permissions || null
        };
        const perms = getUserPerms(req.session.user);
        if (perms.canAudit && !perms.canViewLog) return res.redirect('/audit');
        if (!perms.canViewLog && perms.canAsset)  return res.redirect('/aset');
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
