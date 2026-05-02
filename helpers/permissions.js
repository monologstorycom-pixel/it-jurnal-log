// ==========================================
// PERMISSION HELPERS
// ==========================================

function getUserPerms(user) {
    if (!user) return {};
    if (user.permissions) {
        try {
            const p = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;
            return {
                canView:    p.canView    === true,
                canAdd:     p.canAdd     === true,
                canEdit:    p.canEdit    === true,
                canDelete:  p.canDelete  === true,
                canAsset:   p.canAsset   === true,
                canExport:  p.canExport  === true,
                canUsers:   p.canUsers   === true,
                canViewLog: p.canViewLog === true,
                canAudit:   p.canAudit   === true,
                canVendor:  p.canVendor  === true,
            };
        } catch(e) {
            console.warn('[getUserPerms] Gagal parse permissions:', e.message);
            return { canView:false, canAdd:false, canEdit:false, canDelete:false, canAsset:false, canExport:false, canUsers:false, canViewLog:false, canAudit:false, canVendor:false };
        }
    }
    return { canView:false, canAdd:false, canEdit:false, canDelete:false, canAsset:false, canExport:false, canUsers:false, canViewLog:false, canAudit:false, canVendor:false };
}

function hasPerm(user, perm) {
    if (!user) return false;
    const perms = getUserPerms(user);
    return perms[perm] === true;
}

function canSeeAllAset(user) {
    if (!user) return false;
    if (hasPerm(user, 'canUsers')) return true;
    if (hasPerm(user, 'canAudit')) return true;
    return false;
}

function getAiScope(user) {
    if (!user) {
        return { role: 'public', canLog: false, canAsetAll: false, divisiFilter: null };
    }

    const isAdmin  = hasPerm(user, 'canUsers');
    const isAudit  = hasPerm(user, 'canAudit');
    const divisi   = (user.divisi || '').trim().toLowerCase();
    const isIT     = divisi === 'it';

    if (isAdmin) return { role: 'admin', canLog: true, canAsetAll: true, divisiFilter: null };
    if (isAudit) return { role: 'audit', canLog: false, canAsetAll: true, divisiFilter: null };
    if (isIT)    return { role: 'it', canLog: true, canAsetAll: false, divisiFilter: user.divisi };
    return { role: 'user', canLog: false, canAsetAll: false, divisiFilter: user.divisi };
}

module.exports = { getUserPerms, hasPerm, canSeeAllAset, getAiScope };
