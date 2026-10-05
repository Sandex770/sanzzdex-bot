import {
    addMatkul,
    updateMatkul,
    deleteMatkul,
    getJadwalHari,
    HARI,
    getNowWIB,
} from '../../services/jadwalService.js';

// Cek apakah sender adalah owner ATAU admin di grup WA
const isOwnerOrAdmin = (m, sock) => {
    if (m.isOwner) return true;

    // Cek admin di metadata grup
    const participants = m.metadata?.participants || [];
    if (!participants.length) return false;

    const sender = m.sender;
    const found = participants.find((p) => {
        const pid = typeof p === 'string' ? p : p.id || p.jid;
        return pid === sender;
    });
    if (!found) return false;

    return found.admin === 'admin' || found.admin === 'superadmin';
};

const HARI_INDO = {
    minggu: 'Minggu',
    senin: 'Senin',
    selasa: 'Selasa',
    rabu: 'Rabu',
    kamis: 'Kamis',
    jumat: 'Jumat',
    sabtu: 'Sabtu',
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

const HELP_TEXT = `📚 *MANAJEMEN MATA KULIAH*

*Tambah:*
\`.matkul add <hari> | <nama> | <jam_masuk> - <jam_keluar> | <ruangan> | <dosen>\`
Contoh:
\`.matkul add senin | Dasar Pemrograman | 08.00 - 09.30 | 208 | Pak Budi\`

*Lihat daftar:*
\`.matkul list\` — semua hari
\`.matkul list senin\` — hari tertentu

*Edit:*
\`.matkul edit <hari> | <nama> | <field> | <nilai>\`
Field: \`nama\`, \`jam_masuk\`, \`jam_keluar\`, \`ruangan\`, \`dosen\`, \`note\`
Contoh:
\`.matkul edit senin | Basis Data | ruangan | 301\`

*Hapus:*
\`.matkul del <hari> | <nama>\`
Contoh:
\`.matkul del senin | Basis Data\``;

export default {
    name: 'matkul',
    aliases: ['addmatkul', 'editmatkul', 'delmatkul', 'listmatkul'],
    description: 'CRUD jadwal mata kuliah',
    category: 'Kuliah',
    execute: async (sock, m, args, text) => {
        // Cek akses: owner atau admin grup
        if (!isOwnerOrAdmin(m, sock)) {
            return m.reply('❌ Akses ditolak. Hanya *owner* atau *admin grup* yang bisa mengelola matkul.');
        }

        // Cek apakah alias yang dipakai (misal .addmatkul) menentukan subcommand
        const cmdName = (m.command || '').toLowerCase();
        let sub = (args[0] || '').toLowerCase();

        // Kalau pakai alias .addmatkul / .editmatkul / dll → override sub
        if (cmdName === 'addmatkul') sub = 'add';
        else if (cmdName === 'editmatkul') sub = 'edit';
        else if (cmdName === 'delmatkul') sub = 'del';
        else if (cmdName === 'listmatkul') sub = 'list';

        // Kalau alias dipakai, args[0] adalah argumen pertama (bukan subcommand)
        const aliasUsed = ['addmatkul', 'editmatkul', 'delmatkul', 'listmatkul'].includes(cmdName);

        // Argumen setelah subcommand
        const restArgs = aliasUsed ? args : args.slice(1);
        const restText = aliasUsed
            ? text
            : text.replace(/^\S+\s*/, '').trim();

        // ===== HELP =====
        if (!sub || sub === 'help' || sub === 'bantuan') {
            return m.reply(HELP_TEXT);
        }

        // ===== LIST =====
        if (sub === 'list' || sub === 'lihat') {
            const hariFilter = (restArgs[0] || '').toLowerCase();
            if (hariFilter && !HARI.includes(hariFilter)) {
                return m.reply(`Hari tidak valid. Pilihan: ${HARI.join(', ')}`);
            }

            if (hariFilter) {
                const list = await getJadwalHari(hariFilter);
                if (!list.length) return m.reply(`📭 Tidak ada matkul hari *${HARI_INDO[hariFilter]}*.`);
                const lines = [`📅 *JADWAL ${HARI_INDO[hariFilter].toUpperCase()}*`, ''];
                list.forEach((mk, i) => { lines.push(formatMatkul(mk, i)); lines.push(''); });
                return m.reply(lines.join('\n'));
            }

            const lines = [`📅 *SEMUA JADWAL MINGGUAN*`, ''];
            let ada = false;
            for (const h of HARI) {
                const list = await getJadwalHari(h);
                if (!list.length) continue;
                ada = true;
                lines.push(`*${HARI_INDO[h].toUpperCase()}*`);
                list.forEach((mk, i) => {
                    lines.push(`  ${i + 1}. ${mk.nama} (${mk.jam_masuk}-${mk.jam_keluar}) - R.${mk.ruangan}`);
                });
                lines.push('');
            }
            if (!ada) lines.push('_Belum ada matkul yang diisi._');
            return m.reply(lines.join('\n'));
        }

        // ===== ADD =====
        if (sub === 'add' || sub === 'tambah') {
            // Format: <hari> | <nama> | <jam> - <jam> | <ruangan> | <dosen>
            const parts = restText.split('|').map((s) => s.trim());
            if (parts.length < 5) {
                return m.reply(
                    '❌ Format salah.\n\n' +
                    '`.matkul add <hari> | <nama> | <jam_masuk> - <jam_keluar> | <ruangan> | <dosen>`\n\n' +
                    'Contoh:\n' +
                    '`.matkul add senin | Dasar Pemrograman | 08.00 - 09.30 | 208 | Pak Budi`'
                );
            }

            const [hari, nama, jamRange, ruangan, ...dosenParts] = parts;
            const dosen = dosenParts.join(' | ');

            const jamMatch = jamRange.match(/(\d{1,2}[:.]?\d{0,2})\s*-\s*(\d{1,2}[:.]?\d{0,2})/);
            if (!jamMatch) {
                return m.reply('❌ Format jam salah. Contoh: `08.00 - 09.30` atau `08:00 - 09:30`');
            }

            const [, jamMasuk, jamKeluar] = jamMatch;
            const res = await addMatkul(hari, nama, jamMasuk, jamKeluar, ruangan, dosen);

            if (!res.ok) return m.reply(`❌ ${res.msg}`);

            return m.reply(
                `✅ ${res.msg}\n\n` +
                `📚 *${res.data.nama}*\n` +
                `📅 ${HARI_INDO[hari.toLowerCase()]}\n` +
                `🕐 ${res.data.jam_masuk} - ${res.data.jam_keluar} WIB\n` +
                `📍 Ruangan ${res.data.ruangan}\n` +
                `👤 ${res.data.dosen}`
            );
        }

        // ===== EDIT =====
        if (sub === 'edit' || sub === 'update') {
            const parts = restText.split('|').map((s) => s.trim());
            if (parts.length < 4) {
                return m.reply(
                    '❌ Format salah.\n\n' +
                    '`.matkul edit <hari> | <nama> | <field> | <nilai>`\n\n' +
                    'Field: `nama`, `jam_masuk`, `jam_keluar`, `ruangan`, `dosen`, `note`\n\n' +
                    'Contoh:\n' +
                    '`.matkul edit senin | Basis Data | ruangan | 301`'
                );
            }

            const [hari, nama, field, ...nilaiParts] = parts;
            const nilai = nilaiParts.join(' | ');

            const res = await updateMatkul(hari, nama, field, nilai);
            if (!res.ok) return m.reply(`❌ ${res.msg}`);

            return m.reply(
                `✅ ${res.msg}\n\n` +
                `📚 *${res.data.nama}*\n` +
                `🕐 ${res.data.jam_masuk} - ${res.data.jam_keluar} WIB\n` +
                `📍 Ruangan ${res.data.ruangan}\n` +
                `👤 ${res.data.dosen}` +
                (res.data.note ? `\n📝 _${res.data.note}_` : '')
            );
        }

        // ===== DELETE =====
        if (sub === 'del' || sub === 'hapus' || sub === 'delete' || sub === 'remove') {
            const parts = restText.split('|').map((s) => s.trim());
            if (parts.length < 2) {
                return m.reply(
                    '❌ Format salah.\n\n' +
                    '`.matkul del <hari> | <nama>`\n\n' +
                    'Contoh:\n' +
                    '`.matkul del senin | Basis Data`'
                );
            }

            const [hari, nama] = parts;
            const res = await deleteMatkul(hari, nama);
            if (!res.ok) return m.reply(`❌ ${res.msg}`);
            return m.reply(`✅ ${res.msg}`);
        }

        return m.reply(`Subcommand *${sub}* tidak dikenal.\n\n${HELP_TEXT}`);
    },
};