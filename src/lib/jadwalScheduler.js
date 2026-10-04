import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import logger from '../utils/logger.js';
import {
    getJadwalHari, getJamPengganti, getAccGroups,
    getHariBesokWIB, getTanggalBesokISO, getHariIniWIB, getTanggalHariIniISO,
    menitSekarangWIB, jamKeMenit, formatTanggalIndo, HARI,
} from '../services/jadwalService.js';

const VIDEO_PATH = fileURLToPath(new URL('../assets/jadwal-banner.mp4', import.meta.url));

let videoBufferCache = null;

const getVideoBuffer = async () => {
    if (videoBufferCache) return videoBufferCache;
    try {
        videoBufferCache = await readFile(VIDEO_PATH);
        return videoBufferCache;
    } catch {
        return null;
    }
};

const kirimKeAccGroups = async (sock, text) => {
    const groups = await getAccGroups();
    if (!groups.length) {
        logger.warn('[jadwal] Tidak ada grup ter-acc. Jalankan .accgrup dulu.');
        return;
    }
    const video = await getVideoBuffer();

    for (const jid of groups) {
        try {
            if (video) {
                await sock.sendMessage(jid, {
                    video,
                    caption: text,
                    gifPlayback: true,
                    mimetype: 'video/mp4',
                });
            } else {
                await sock.sendMessage(jid, { text });
            }
        } catch (err) {
            logger.error(`[jadwal] Gagal kirim ke ${jid}: ${err.message}`);
        }
    }
};

const formatMatkul = (mk, index) => {
    const lines = [
        `*${index + 1}. ${mk.nama}*`,
        `   🕐 ${mk.jam_masuk} - ${mk.jam_keluar} WIB`,
        `   📍 Ruangan ${mk.ruangan}`,
        `   👤 ${mk.dosen}`,
    ];
    if (mk.note) lines.push(`   📝 _${mk.note}_`);
    return lines.join('\n');
};

const kirimNotifMalam = async (sock) => {
    const hariBesok = getHariBesokWIB();
    const tglBesok = getTanggalBesokISO();
    const jadwalBesok = await getJadwalHari(hariBesok);
    const pengganti = await getJamPengganti(tglBesok);

    const tglFormatted = formatTanggalIndo(tglBesok);

    // Kasus 1: ada jadwal reguler
    if (jadwalBesok.length > 0) {
        const teks = [
            `🌙 *REMINDER JADWAL BESOK*`,
            `📅 ${tglFormatted}`,
            '',
            ...jadwalBesok.map((mk, i) => formatMatkul(mk, i)),
            pengganti ? `\n⚠️ *JAM PENGGANTI:*\n${formatMatkul(pengganti, 0)}` : '',
            '',
            'Semangat besok! 💪',
        ].filter(Boolean).join('\n');
        await kirimKeAccGroups(sock, teks);
        logger.info(`[jadwal] Notif malam terkirim (${jadwalBesok.length} matkul)`);
        return;
    }

    // Kasus 2: kosong tapi ada jam pengganti
    if (pengganti) {
        const teks = [
            `🌙 *INFO JADWAL BESOK*`,
            `📅 ${tglFormatted}`,
            '',
            `⚠️ *Besok masuk — jam pengganti!*`,
            '',
            formatMatkul(pengganti, 0),
        ].join('\n');
        await kirimKeAccGroups(sock, teks);
        logger.info('[jadwal] Notif jam pengganti terkirim');
        return;
    }

    // Kasus 3: libur
    const teks = [
        `🌙 *INFO JADWAL BESOK*`,
        `📅 ${tglFormatted}`,
        '',
        `🎉 *Besok libur, tidak ada jadwal kuliah.*`,
        '',
        'Selamat istirahat! 😴',
    ].join('\n');
    await kirimKeAccGroups(sock, teks);
    logger.info('[jadwal] Notif libur terkirim');
};

const cekReminder30Menit = async (sock) => {
    const hariIni = getHariIniWIB();
    const jadwal = await getJadwalHari(hariIni);
    if (!jadwal.length) return;

    const menitNow = menitSekarangWIB();
    const tglHariIni = getTanggalHariIniISO();

    for (const mk of jadwal) {
        const menitMasuk = jamKeMenit(mk.jam_masuk);
        const target = menitMasuk - 30;
        if (menitNow !== target) continue;

        // Guard biar nggak dobel kirim di hari yang sama
        const key = `${tglHariIni}:${mk.id}`;
        if (!global.__jadwalReminderSent) global.__jadwalReminderSent = new Set();
        if (global.__jadwalReminderSent.has(key)) continue;
        global.__jadwalReminderSent.add(key);

        const lines = [
            `⏰ *30 MENIT LAGI MASUK*`,
            '',
            `📚 *${mk.nama}*`,
            `🕐 ${mk.jam_masuk} - ${mk.jam_keluar} WIB`,
            `📍 Ruangan ${mk.ruangan}`,
            `👤 ${mk.dosen}`,
        ];
        if (mk.note) lines.push(`📝 _${mk.note}_`);
        lines.push('', 'Siapkan diri kamu! 🎒');

        await kirimKeAccGroups(sock, lines.join('\n'));
        logger.info(`[jadwal] Reminder 30 menit: ${mk.nama}`);
    }
};

export const startJadwalScheduler = (getSocket) => {
    if (global.__jadwalSchedulerStarted) return;
    global.__jadwalSchedulerStarted = true;

    logger.info('📅 Jadwal scheduler started');

    // Cek tiap 60 detik untuk reminder 30 menit
    setInterval(() => {
        const sock = getSocket();
        if (!sock) return;
        cekReminder30Menit(sock).catch((e) =>
            logger.error(`[jadwal] reminder error: ${e.message}`)
        );
    }, 60 * 1000);

    // Cek notif malam tepat jam 20:00 WIB
    let lastNotifDate = null;
    setInterval(() => {
        const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
        const h = now.getUTCHours();
        const m = now.getUTCMinutes();
        const tgl = now.toISOString().slice(0, 10);

        if (h === 20 && m === 0 && lastNotifDate !== tgl) {
            lastNotifDate = tgl;
            const sock = getSocket();
            if (sock) {
                kirimNotifMalam(sock).catch((e) =>
                    logger.error(`[jadwal] notif malam error: ${e.message}`)
                );
            }
        }
    }, 60 * 1000);
};