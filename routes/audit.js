const express = require('express');
const router  = express.Router();

const prisma           = require('../services/prisma');
const { requireLogin } = require('../middleware/auth');
const { hasPerm }      = require('../helpers/permissions');
const { formatDurasi, getYearOptions } = require('../helpers/dateTime');

// ==========================================
// DASHBOARD AUDIT
// ==========================================
router.get('/audit', requireLogin, async (req, res) => {
    if (!hasPerm(req.session.user, 'canAudit')) {
        return res.status(403).render('403', { message: 'Akses ditolak. Halaman ini hanya untuk Tim Audit / Internal Control.' });
    }
    try {
        const { date, status, divisi, asetDivisi, chartPeriod } = req.query;
        const now = new Date();

        // Validasi date — fallback ke hari ini jika tidak valid
        let selectedDate = now;
        if (date) {
            const parsed = new Date(date);
            if (!isNaN(parsed.getTime())) selectedDate = parsed;
        }

        // Sanitasi chartPeriod — hanya boleh angka atau 'all'
        const allowedPeriods = ['7', '14', '30', '60', '90', 'all'];
        const period = allowedPeriods.includes(chartPeriod) ? chartPeriod : '30';
        const tStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 0,  0,  0);
        const tEnd   = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 23, 59, 59);

        let tableWhere = {
            OR: [
                { tipeInput: { not: 'multihari' }, tanggalManual: { gte: tStart, lte: tEnd } },
                { tipeInput: 'multihari', tanggalMulai: { lte: tEnd }, tanggalSelesai: { gte: tStart } }
            ]
        };
        if (status && status !== '') tableWhere.status = status;
        if (divisi && divisi !== '') tableWhere.divisi = divisi;

        const journals = await prisma.journal.findMany({ where: tableWhere, orderBy: { tanggalManual: 'desc' } });

        // Filter analitik & chart
        let chartWhere = {};
        if (period !== 'all') {
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - parseInt(period));
            chartWhere.tanggalManual = { gte: pastDate };
        }

        const chartLogs = await prisma.journal.findMany({
            where: chartWhere,
            select: { divisi: true, status: true, aktivitas: true, durasiMenit: true, pemesan: true }
        });

        let totalDurasi = 0, durasiCount = 0;
        const divisiMap = {}, masalahMap = {}, pemesanMap = {};

        chartLogs.forEach(j => {
            if (!divisiMap[j.divisi]) divisiMap[j.divisi] = { divisi: j.divisi, total: 0, pending: 0 };
            divisiMap[j.divisi].total++;
            if (j.status === 'Pending') divisiMap[j.divisi].pending++;

            const act = (j.aktivitas || 'Lainnya').trim();
            masalahMap[act] = (masalahMap[act] || 0) + 1;

            const pms = (j.pemesan || 'Tanpa Nama').trim();
            pemesanMap[pms] = (pemesanMap[pms] || 0) + 1;

            if (j.durasiMenit && j.durasiMenit > 0) { totalDurasi += j.durasiMenit; durasiCount++; }
        });

        const divisiBreakdown = Object.values(divisiMap).sort((a, b) => b.total - a.total);
        const divisiList      = divisiBreakdown.map(d => d.divisi);
        const masalahSering   = Object.entries(masalahMap).map(([nama, total]) => ({ nama, total })).sort((a, b) => b.total - a.total).slice(0, 10);
        const pemesanSering   = Object.entries(pemesanMap).map(([nama, total]) => ({ nama, total })).sort((a, b) => b.total - a.total).slice(0, 10);
        const rataRataMenit   = durasiCount > 0 ? Math.floor(totalDurasi / durasiCount) : 0;

        // Stats global
        const bulanStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const bulanEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

        const [totalAllTime, totalSolved, totalPending, bulanIni] = await Promise.all([
            prisma.journal.count(),
            prisma.journal.count({ where: { status: 'Solved' } }),
            prisma.journal.count({ where: { status: 'Pending' } }),
            prisma.journal.count({ where: { OR: [
                { tipeInput: { not: 'multihari' }, tanggalManual: { gte: bulanStart, lte: bulanEnd } },
                { tipeInput: 'multihari', tanggalMulai: { lte: bulanEnd }, tanggalSelesai: { gte: bulanStart } }
            ]}})
        ]);

        const pendingItems = await prisma.journal.findMany({
            where: { status: 'Pending' }, orderBy: { tanggalManual: 'asc' }, take: 10,
            select: { id: true, aktivitas: true, divisi: true, pemesan: true, tanggalManual: true, durasiMenit: true, tipeInput: true }
        });
        const pendingWithAge = pendingItems.map(p => ({
            ...p,
            hariPending: Math.floor((Date.now() - new Date(p.tanggalManual).getTime()) / (1000 * 60 * 60 * 24))
        }));

        // Data aset untuk audit
        let auditAsets = [];
        if (asetDivisi && asetDivisi !== '') {
            let divWhereAset = asetDivisi;
            if (asetDivisi === 'IT & IC' || asetDivisi === 'IT') divWhereAset = { in: ['IT', 'IT & IC'] };
            auditAsets = await prisma.aset.findMany({
                where: { divisi: divWhereAset },
                orderBy: { nama: 'asc' },
                include: { penggunaan: true, pinjaman: { where: { status: 'Dipinjam' } } }
            });
        }

        const stats = {
            totalAllTime, totalSolved, totalPending, bulanIni,
            divisiCount: divisiList.length,
            divisiList, divisiBreakdown, masalahSering, pemesanSering,
            rataRataMenit, rataRataFormat: formatDurasi(rataRataMenit),
            pendingItems: pendingWithAge
        };

        res.render('audit', {
            journals, auditAsets, yearOptions: getYearOptions(), formatDurasi, stats,
            filterDate:       date       || '',
            filterStatus:     status     || '',
            filterDivisi:     divisi     || '',
            filterAsetDivisi: asetDivisi || '',
            chartPeriod:      period
        });
    } catch (error) { console.error(error); res.status(500).send('Database Error: ' + error.message); }
});

// ==========================================
// EXPORT AUDIT → redirect ke /export
// ==========================================
router.get('/audit/export', requireLogin, (req, res) => {
    res.redirect('/export?' + new URLSearchParams(req.query).toString());
});

module.exports = router;
