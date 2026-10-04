import {
    getJadwalHari, HARI, formatTanggalIndo, getTanggalHariIniISO,
} from '../../services/jadwalService.js';

export default {
    name: 'jadwal',
    aliases: ['jadwalkuliah'],
    description: 'Lihat jadwal kuliah. Format: .jadwal [hari]',
    category: 'Kuliah',
        execute: async (sock, m, args) => {
        try {
            const hari = (args[0] || '').toLowerCase();
            if (hari && !HARI.includes(hari)) {
                return m.reply(`Hari tidak valid. Pilihan: ${HARI.join(', ')}`);
            }

            if (hari) {
                const list = await getJadwalHari(hari);
                if (!list.length) return m.reply(`📭 Tidak ada jadwal hari *${hari}*.`);
                return m.reply(formatList(hari, list));
            }

            const lines = [`📅 *JADWAL KULIAH MINGGUAN*`, ''];
            for (const h of HARI) {
                const list = await getJadwalHari(h);
                if (!list.length) continue;
                lines.push(`*${h.toUpperCase()}*`);
                list.forEach((mk, i) => {
                    lines.push(`  ${i + 1}. ${mk.nama} (${mk.jam_masuk}-${mk.jam_keluar}) - R.${mk.ruangan}`);
                });
                lines.push('');
            }
            m.reply(lines.join('\n'));
        } catch (err) {
            console.error('[JADWAL CMD] Error:', err);
            return m.reply(`❌ Error: ${err.message}`);
        }
    },

const formatList = (hari, list) => {
    const lines = [`📅 *JADWAL ${hari.toUpperCase()}*`, ''];
    list.forEach((mk, i) => {
        lines.push(`*${i + 1}. ${mk.nama}*`);
        lines.push(`   🕐 ${mk.jam_masuk} - ${mk.jam_keluar} WIB`);
        lines.push(`   📍 Ruangan ${mk.ruangan}`);
        lines.push(`   👤 ${mk.dosen}`);
        if (mk.note) lines.push(`   📝 _${mk.note}_`);
        lines.push('');
    });
    return lines.join('\n');
};