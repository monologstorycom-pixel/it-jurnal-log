const { hasPerm, getUserPerms } = require('../helpers/permissions');

// ==========================================
// AUTH MIDDLEWARE
// ==========================================

function requireLogin(req, res, next) {
    if (req.session && req.session.user) return next();
    res.redirect('/login');
}

function requireAdmin(req, res, next) {
    if (req.session && req.session.user && hasPerm(req.session.user, 'canUsers')) return next();
    res.status(403).render('403', { message: 'Halaman ini hanya untuk Admin.' });
}

function requireUser(req, res, next) {
    if (req.session && req.session.user) {
        const user = req.session.user;
        if (hasPerm(user, 'canAdd') || hasPerm(user, 'canEdit') || hasPerm(user, 'canAsset')) return next();
    }
    res.status(403).render('403', { message: 'Anda tidak punya izin untuk aksi ini.' });
}

// Inject locals ke semua view
function injectLocals(req, res, next) {
    res.locals.currentUser = req.session.user || null;
    res.locals.userPerms   = req.session.user ? getUserPerms(req.session.user) : {};
    res.locals.activePage  = '';
    next();
}

module.exports = { requireLogin, requireAdmin, requireUser, injectLocals };
