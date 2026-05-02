const express = require('express');
const bcrypt  = require('bcryptjs');
const router  = express.Router();

const prisma                        = require('../services/prisma');
const { requireLogin, requireAdmin } = require('../middleware/auth');

// ==========================================
// LIST USERS
// ==========================================
router.get('/users', requireLogin, requireAdmin, async (req, res) => {
    try {
        const { msg, msgType } = req.query;
        const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
        res.render('users', { users, msg: msg || null, msgType: msgType || 'success' });
    } catch (error) {
        console.error('[USERS ERROR]', error.message);
        res.status(500).send('Database Error: ' + error.message);
    }
});

// ==========================================
// TAMBAH USER
// ==========================================
router.post('/users/tambah', requireLogin, requireAdmin, async (req, res) => {
    try {
        const { nama, username, password } = req.body;
        if (!nama || !username || !password) {
            return res.redirect('/users?msg=Nama%2C+username%2C+dan+password+wajib+diisi&msgType=error');
        }
        if (password.length < 6) {
            return res.redirect('/users?msg=Password+minimal+6+karakter&msgType=error');
        }
        const existing = await prisma.user.findUnique({ where: { username: username.trim().toLowerCase() } });
        if (existing) {
            return res.redirect('/users?msg=Username+sudah+dipakai%2C+pilih+yang+lain&msgType=error');
        }

        const permissions = {
            canView:    req.body.canView    === 'on',
            canAdd:     req.body.canAdd     === 'on',
            canEdit:    req.body.canEdit    === 'on',
            canDelete:  req.body.canDelete  === 'on',
            canAsset:   req.body.canAsset   === 'on',
            canExport:  req.body.canExport  === 'on',
            canUsers:   req.body.canUsers   === 'on',
            canViewLog: req.body.canViewLog === 'on',
            canAudit:   req.body.canAudit   === 'on',
            canVendor:  req.body.canVendor  === 'on',
        };

        const role   = req.body.role || 'user';
        const divisi = (req.body.divisi || 'IT').toString().trim().toUpperCase();
        const hashed = await bcrypt.hash(password, 10);

        await prisma.user.create({
            data: {
                nama:     nama.trim(),
                username: username.trim().toLowerCase(),
                password: hashed,
                role, divisi,
                permissions: JSON.stringify(permissions)
            }
        });
        res.redirect('/users?msg=User+berhasil+ditambahkan&msgType=success');
    } catch (error) {
        console.error('[USER TAMBAH ERROR]', error.message);
        res.redirect('/users?msg=Gagal+tambah+user:+' + encodeURIComponent(error.message) + '&msgType=error');
    }
});

// ==========================================
// EDIT USER
// ==========================================
router.post('/users/edit/:id', requireLogin, requireAdmin, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { nama, username, password } = req.body;
        if (!nama || !username) {
            return res.redirect('/users?msg=Nama+dan+username+wajib+diisi&msgType=error');
        }
        const existing = await prisma.user.findFirst({
            where: { username: username.trim().toLowerCase(), NOT: { id } }
        });
        if (existing) {
            return res.redirect('/users?msg=Username+sudah+dipakai+user+lain&msgType=error');
        }

        const permissions = {
            canView:    req.body.canView    === 'on',
            canAdd:     req.body.canAdd     === 'on',
            canEdit:    req.body.canEdit    === 'on',
            canDelete:  req.body.canDelete  === 'on',
            canAsset:   req.body.canAsset   === 'on',
            canExport:  req.body.canExport  === 'on',
            canUsers:   req.body.canUsers   === 'on',
            canViewLog: req.body.canViewLog === 'on',
            canAudit:   req.body.canAudit   === 'on',
            canVendor:  req.body.canVendor  === 'on',
        };

        const role   = req.body.role || 'user';
        const divisi = (req.body.divisi || 'IT').toString().trim().toUpperCase();

        const updateData = {
            nama:     nama.trim(),
            username: username.trim().toLowerCase(),
            role, divisi,
            permissions: JSON.stringify(permissions)
        };

        if (password && password.trim().length > 0) {
            if (password.length < 6) return res.redirect('/users?msg=Password+minimal+6+karakter&msgType=error');
            updateData.password = await bcrypt.hash(password, 10);
        }

        await prisma.user.update({ where: { id }, data: updateData });

        // Update session jika edit diri sendiri
        if (req.session.user && req.session.user.id === id) {
            Object.assign(req.session.user, {
                nama:        updateData.nama,
                username:    updateData.username,
                role:        updateData.role,
                divisi:      updateData.divisi,
                permissions: updateData.permissions
            });
        }
        res.redirect('/users?msg=User+berhasil+diperbarui&msgType=success');
    } catch (error) {
        console.error('[USER EDIT ERROR]', error.message);
        res.redirect('/users?msg=Gagal+edit+user&msgType=error');
    }
});

// ==========================================
// HAPUS USER
// ==========================================
router.post('/users/hapus/:id', requireLogin, requireAdmin, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.redirect('/users?msg=ID+user+tidak+valid&msgType=error');
        if (req.session.user && req.session.user.id === id) {
            return res.redirect('/users?msg=Tidak+bisa+hapus+akun+sendiri&msgType=error');
        }
        await prisma.user.delete({ where: { id } });
        res.redirect('/users?msg=User+berhasil+dihapus&msgType=success');
    } catch (error) {
        console.error('[USER HAPUS ERROR]', error.message);
        res.redirect('/users?msg=Gagal+hapus+user&msgType=error');
    }
});

module.exports = router;
