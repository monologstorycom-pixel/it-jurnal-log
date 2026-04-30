// ==========================================
// DATE & TIME HELPERS
// ==========================================

function buildDateTime(tanggal, jam) {
    if (!tanggal || tanggal.trim() === '') return null;
    const jamStr = (jam && jam.trim() !== '') ? jam.trim() : '00:00';
    const dt = new Date(tanggal.trim() + 'T' + jamStr + ':00');
    return isNaN(dt.getTime()) ? null : dt;
}

function hitungDurasiDateTime(dtMulai, dtSelesai) {
    if (!dtMulai || !dtSelesai) return null;
    const diff = Math.floor((dtSelesai - dtMulai) / 60000);
    return diff > 0 ? diff : null;
}

function hitungDurasiJam(jamMulai, jamSelesai) {
    if (!jamMulai || !jamSelesai) return null;
    const [hM, mM] = jamMulai.split(':').map(Number);
    const [hS, mS] = jamSelesai.split(':').map(Number);
    let totalMulai   = hM * 60 + mM;
    let totalSelesai = hS * 60 + mS;
    if (totalSelesai < totalMulai) totalSelesai += 24 * 60;
    const diff = totalSelesai - totalMulai;
    return diff > 0 ? diff : null;
}

function formatDurasi(menit) {
    if (!menit || menit <= 0) return null;
    const hari = Math.floor(menit / 1440);
    const sisaSetelahHari = menit % 1440;
    const jam  = Math.floor(sisaSetelahHari / 60);
    const sisa = sisaSetelahHari % 60;
    const parts = [];
    if (hari > 0) parts.push(hari + ' hari');
    if (jam  > 0) parts.push(jam  + ' jam');
    if (sisa > 0) parts.push(sisa + ' menit');
    return parts.length > 0 ? parts.join(' ') : '0 menit';
}

function formatTanggal(dt) {
    if (!dt) return '-';
    return new Date(dt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatJamMenit(jamStr) {
    return jamStr || '';
}

function getYearOptions() {
    const years = [];
    for (let y = new Date().getFullYear(); y >= 2024; y--) years.push(y);
    return years;
}

module.exports = {
    buildDateTime,
    hitungDurasiDateTime,
    hitungDurasiJam,
    formatDurasi,
    formatTanggal,
    formatJamMenit,
    getYearOptions,
};
