export default {
    name: 'jadwal',
    aliases: ['jadwalkuliah'],
    description: 'Lihat jadwal kuliah. Format: .jadwal [hari]',
    category: 'Kuliah',
    execute: async (sock, m, args) => {
        try {
            // ===== DEBUG 1: import service =====
            let svc;
            try {
                svc = await import('../../services/jadwalService.js');
            } catch (e) {
                return m.reply(`❌ [1] Gagal import jadwalService:\n${e.message}\n\n${e.stack?.split('\n').slice(0, 3).join('\n')}`);
            }

            const { getJadwalHari, HARI, loadJadwal } = svc;

            if (!getJadwalHari || !HARI) {
                return m.reply(`❌ [2] Export jadwalService tidak lengkap.\ngetJadwalHari: ${typeof getJadwalHari}\nHARI: ${typeof HARI}`);
            }

            // ===== DEBUG 2: baca JSON =====
            try {
                await loadJadwal();
            } catch (e) {
                return m.reply(`❌ [3] loadJadwal gagal:\n${e.message}`);
            }

            const hari = (args[0] || '').toLowerCase();

            if (hari && !HARI.includes(hari)) {
                return m.reply(`📅 Hari tidak valid.\nPilihan: ${HARI.join(', ')}`);
            }

            // ===== DEBUG 3: mode hari spesifik =====
            if (hari) {
                let list;
                try {
                    list = await getJadwalHari(hari);
                } catch (e) {
                    return m.reply(`❌ [4] getJadwalHari('${hari}') gagal:\n${e.message}\n${e.stack?.split('\n').slice(0, 3).join('\n')}`);
                }

                if (!list || !list.length) {
                    return m.reply(`📭 Tidak ada jadwal hari *${hari}*.`);
                }

                return m.reply(formatList(hari, list));
            }

            // ===== DEBUG 4: mode semua hari =====
            const lines = [`📅 *JADWAL KULIAH MINGGUAN*`, ''];
            let adaIsi = false;

            for (const h of HARI) {
                let list;
                try {
                    list = await getJadwalHari(h);
                } catch (e) {
                    return m.reply(`❌ [5] Gagal baca hari ${h}:\n${e.message}`);
                }

                if (!list || !list.length) continue;
                adaIsi = true;
                lines.push(`*${h.toUpperCase()}*`);
                list.forEach((mk, i) => {
                    lines.push(`  ${i + 1}. ${mk.nama} (${mk.jam_masuk}-${mk.jam_keluar}) - R.${mk.ruangan}`);
                });
                lines.push('');
            }

            if (!adaIsi) {
                lines.push('📭 Belum ada jadwal yang diisi.');
                lines.push('');
                lines.push('Isi dulu di `data/jadwal.json` di VPS.');
            }

            m.reply(lines.join('\n'));
        } catch (err) {
            // ===== DEBUG 5: error tak terduga =====
            const stack = (err.stack || '').split('\n').slice(0, 5).join('\n');
            return m.reply(
                `❌ *ERROR*\n` +
                `Message: ${err.message}\n` +
                `Name: ${err.name}\n\n` +
                `Stack:\n${stack}`
            );
        }
    },
};

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