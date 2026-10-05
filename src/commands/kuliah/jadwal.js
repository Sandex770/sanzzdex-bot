import {
    getJadwalHari,
    HARI,
    loadJadwal,
} from '../../services/jadwalService.js';

// Hari yang ditampilkan di tombol (Senin - Jumat)
const HARI_BUTTON = ['senin', 'selasa', 'rabu', 'kamis', 'jumat'];

// Hari yang ditampilkan di .jadwalkuliah (Senin - Sabtu)
const HARI_FULL = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];

const HARI_INDO = {
    senin: 'Senin',
    selasa: 'Selasa',
    rabu: 'Rabu',
    kamis: 'Kamis',
    jumat: 'Jumat',
    sabtu: 'Sabtu',
    minggu: 'Minggu',
};

// Format 1 matkul
const formatMatkul = (mk, index) => {
    const lines = [];
    lines.push(`${index + 1}.`);
    lines.push(`Mata Kuliah :`);
    lines.push(`${mk.nama}`);
    lines.push(`Jam :`);
    lines.push(`${mk.jam_masuk} - ${mk.jam_keluar}`);
    lines.push(`Ruangan :`);
    lines.push(`${mk.ruangan}`);
    lines.push(`Dosen :`);
    lines.push(`${mk.dosen}`);
    if (mk.note) {
        lines.push(`Note :`);
        lines.push(`${mk.note}`);
    }
    return lines.join('\n');
};

// Format 1 hari
const formatHari = (hari, list) => {
    const title = `📅 *JADWAL ${HARI_INDO[hari].toUpperCase()}*`;
    if (!list.length) {
        return `${title}\n\n📭 _Tidak ada jadwal / libur_`;
    }
    const matkulStr = list.map((mk, i) => formatMatkul(mk, i)).join('\n\n');
    return `${title}\n\n${matkulStr}`;
};

// Extract buttonId (support interactive / native flow)
const extractButtonId = (m) => {
    let id =
        m.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
        m.message?.buttonsResponseMessage?.selectedButtonId ||
        m.message?.templateButtonReplyMessage?.selectedId ||
        '';

    if (!id) {
        const paramsRaw =
            m.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson ||
            m.msg?.nativeFlowResponseMessage?.paramsJson ||
            '';
        try {
            const params = typeof paramsRaw === 'string' ? JSON.parse(paramsRaw) : paramsRaw || {};
            id = params?.id || '';
        } catch {
            id = '';
        }
    }

    return id;
};

// ========== COMMAND 1: .jadwal (pakai tombol) ==========
const jadwalCmd = {
    name: 'jadwal',
    description: 'Lihat jadwal kuliah (pilih hari lewat tombol)',
    category: 'Kuliah',
    execute: async (sock, m) => {
        const rows = HARI_BUTTON.map((h) => ({
            title: `📅 ${HARI_INDO[h]}`,
            description: `Lihat jadwal hari ${HARI_INDO[h]}`,
            id: `jadwal_pick_${h}`,
        }));

        try {
            return await sock.sendMessage(
                m.chat,
                {
                    interactiveMessage: {
                        body: {
                            text: `📅 *JADWAL KULIAH*\n\nPilih hari di bawah:`,
                        },
                        footer: {
                            text: 'Pilih hari',
                        },
                        nativeFlowMessage: {
                            messageVersion: 1,
                            buttons: [
                                {
                                    name: 'single_select',
                                    buttonParamsJson: JSON.stringify({
                                        title: 'Pilih Hari',
                                        sections: [
                                            {
                                                title: 'Hari Kuliah',
                                                rows,
                                            },
                                        ],
                                    }),
                                },
                            ],
                        },
                    },
                },
                { quoted: m }
            );
        } catch (e) {
            return m.reply(`❌ Gagal kirim tombol: ${e.message}`);
        }
    },

    handleButton: async (sock, m) => {
        const buttonId = extractButtonId(m);
        if (!buttonId || !buttonId.startsWith('jadwal_')) return false;

        if (buttonId.startsWith('jadwal_pick_')) {
            const hari = buttonId.replace('jadwal_pick_', '').toLowerCase();
            if (!HARI_INDO[hari]) return m.reply('❌ Hari tidak valid.');

            const list = await getJadwalHari(hari);
            return m.reply(formatHari(hari, list));
        }

        return false;
    },

    buttonPrefix: 'jadwal',
};

// ========== COMMAND 2: .jadwalkuliah (langsung semua) ==========
const jadwalKuliahCmd = {
    name: 'jadwalkuliah',
    aliases: ['jadwalku', 'jkw'],
    description: 'Lihat semua jadwal kuliah Senin-Sabtu',
    category: 'Kuliah',
    execute: async (sock, m, args) => {
        try {
            const hari = (args[0] || '').toLowerCase();

            // Mode hari spesifik (misal .jadwalkuliah senin)
            if (hari) {
                if (!HARI_INDO[hari]) {
                    return m.reply(`📅 Hari tidak valid.\nPilihan: ${HARI_FULL.join(', ')}`);
                }
                const list = await getJadwalHari(hari);
                return m.reply(formatHari(hari, list));
            }

            // Mode semua hari (Senin - Sabtu)
            const parts = [`📅 *JADWAL KULIAH MINGGUAN*`];
            for (const h of HARI_FULL) {
                const list = await getJadwalHari(h);
                parts.push('');
                parts.push(formatHari(h, list));
            }

            return m.reply(parts.join('\n'));
        } catch (err) {
            console.error('[JADWALKULIAH] Error:', err);
            return m.reply(`❌ Error: ${err.message}`);
        }
    },
};

// ========== EXPORT DUA COMMAND ==========
export default [jadwalCmd, jadwalKuliahCmd];