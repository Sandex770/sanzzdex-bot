export default {
    name: 'kuliah',
    aliases: ['menukuliah', 'fiturkuliah'],
    description: 'Daftar semua fitur kuliah',
    category: 'Kuliah',
    execute: async (sock, m) => {
        const teks = [
            `📚 *FITUR KULIAH*`,
            '',
            `Semua command seputar jadwal kuliah:`,
        ].join('\n');

        try {
            return await sock.sendMessage(
                m.chat,
                {
                    interactiveMessage: {
                        body: {
                            text: teks,
                        },
                        footer: {
                            text: 'Pilih kategori fitur',
                        },
                        nativeFlowMessage: {
                            messageVersion: 1,
                            buttons: [
                                {
                                    name: 'single_select',
                                    buttonParamsJson: JSON.stringify({
                                        title: 'Pilih Kategori',
                                        sections: [
                                            {
                                                title: '📅 Lihat Jadwal',
                                                rows: [
                                                    {
                                                        title: '📅 Jadwal Per Hari',
                                                        description: 'Pilih hari lewat tombol',
                                                        id: 'kuliah_info_jadwal',
                                                    },
                                                    {
                                                        title: '📋 Jadwal Mingguan',
                                                        description: 'Semua jadwal Senin-Sabtu',
                                                        id: 'kuliah_info_jadwalmingguan',
                                                    },
                                                ],
                                            },
                                            {
                                                title: '✏️ Kelola Matkul',
                                                rows: [
                                                    {
                                                        title: '➕ Tambah Matkul',
                                                        description: 'Format & contoh',
                                                        id: 'kuliah_info_addmatkul',
                                                    },
                                                    {
                                                        title: '📝 Edit Matkul',
                                                        description: 'Ubah data matkul',
                                                        id: 'kuliah_info_editmatkul',
                                                    },
                                                    {
                                                        title: '🗑️ Hapus Matkul',
                                                        description: 'Hapus matkul',
                                                        id: 'kuliah_info_delmatkul',
                                                    },
                                                    {
                                                        title: '📋 List Matkul',
                                                        description: 'Lihat semua matkul',
                                                        id: 'kuliah_info_listmatkul',
                                                    },
                                                ],
                                            },
                                            {
                                                title: '🔧 Info & Note',
                                                rows: [
                                                    {
                                                        title: '📝 Set Info Matkul',
                                                        description: 'Set note (daring, dll)',
                                                        id: 'kuliah_info_setinfo',
                                                    },
                                                ],
                                            },
                                            {
                                                title: '⚙️ Admin (Owner)',
                                                rows: [
                                                    {
                                                        title: '🔓 Whitelist Grup (.acclek)',
                                                        description: 'Kelola grup yang di-acc',
                                                        id: 'kuliah_info_acclek',
                                                    },
                                                    {
                                                        title: '🚫 Blacklist Grup (.blockgc)',
                                                        description: 'Blokir grup biar bot diam',
                                                        id: 'kuliah_info_blockgc',
                                                    },
                                                ],
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
            return m.reply(`❌ Gagal kirim menu: ${e.message}`);
        }
    },

    handleButton: async (sock, m) => {
        // Extract buttonId
        let buttonId =
            m.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
            m.message?.buttonsResponseMessage?.selectedButtonId ||
            m.message?.templateButtonReplyMessage?.selectedId ||
            '';

        if (!buttonId) {
            const paramsRaw =
                m.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson ||
                m.msg?.nativeFlowResponseMessage?.paramsJson ||
                '';
            try {
                const params = typeof paramsRaw === 'string' ? JSON.parse(paramsRaw) : paramsRaw || {};
                buttonId = params?.id || '';
            } catch {
                buttonId = '';
            }
        }

        if (!buttonId || !buttonId.startsWith('kuliah_info_')) return false;

        const prefix = m.prefix || '.';
        const info = {
            kuliah_info_jadwal: {
                title: '📅 JADWAL PER HARI',
                body: [
                    `*Command:* \`${prefix}jadwal\``,
                    '',
                    `Menampilkan tombol pilihan hari *Senin - Jumat*.`,
                    '',
                    `*Contoh:*`,
                    `\`${prefix}jadwal\``,
                    '',
                    `_Klik tombol → pilih hari → jadwal muncul_`,
                ].join('\n'),
            },
            kuliah_info_jadwalmingguan: {
                title: '📋 JADWAL MINGGUAN',
                body: [
                    `*Command:* \`${prefix}jadwalkuliah\``,
                    '',
                    `Menampilkan semua jadwal *Senin - Sabtu*.`,
                    `Hari libur tetap muncul dengan keterangan.`,
                    '',
                    `*Contoh:*`,
                    `\`${prefix}jadwalkuliah\`         — semua hari`,
                    `\`${prefix}jadwalkuliah senin\`   — hari tertentu`,
                ].join('\n'),
            },
            kuliah_info_addmatkul: {
                title: '➕ TAMBAH MATKUL',
                body: [
                    `*Command:* \`${prefix}matkul add\``,
                    '',
                    `*Format:*`,
                    `\`${prefix}matkul add <hari> | <nama> | <jam_masuk> - <jam_keluar> | <ruangan> | <dosen>\``,
                    '',
                    `*Contoh:*`,
                    `\`${prefix}matkul add senin | Dasar Pemrograman | 08.00 - 09.30 | 208 | Pak Budi\``,
                    `\`${prefix}matkul add selasa | Algoritma | 13.00 - 14.30 | 301 | Bu Ani\``,
                    '',
                    `*Hari:* senin, selasa, rabu, kamis, jumat, sabtu`,
                    `*Jam:* format bebas (\`08.00\`, \`08:00\`, \`8\`)`,
                ].join('\n'),
            },
            kuliah_info_editmatkul: {
                title: '📝 EDIT MATKUL',
                body: [
                    `*Command:* \`${prefix}matkul edit\``,
                    '',
                    `*Format:*`,
                    `\`${prefix}matkul edit <hari> | <nama> | <field> | <nilai>\``,
                    '',
                    `*Field:* \`nama\`, \`jam_masuk\`, \`jam_keluar\`, \`ruangan\`, \`dosen\`, \`note\``,
                    '',
                    `*Contoh:*`,
                    `\`${prefix}matkul edit senin | Basis Data | ruangan | 301\``,
                    `\`${prefix}matkul edit senin | Basis Data | dosen | Bu Siti\``,
                ].join('\n'),
            },
            kuliah_info_delmatkul: {
                title: '🗑️ HAPUS MATKUL',
                body: [
                    `*Command:* \`${prefix}matkul del\``,
                    '',
                    `*Format:*`,
                    `\`${prefix}matkul del <hari> | <nama>\``,
                    '',
                    `*Contoh:*`,
                    `\`${prefix}matkul del senin | Basis Data\``,
                ].join('\n'),
            },
            kuliah_info_listmatkul: {
                title: '📋 LIST MATKUL',
                body: [
                    `*Command:* \`${prefix}matkul list\``,
                    '',
                    `Menampilkan semua matkul yang terdaftar.`,
                    '',
                    `*Contoh:*`,
                    `\`${prefix}matkul list\`          — semua hari`,
                    `\`${prefix}matkul list senin\`    — hari tertentu`,
                ].join('\n'),
            },
            kuliah_info_setinfo: {
                title: '📝 SET INFO MATKUL',
                body: [
                    `*Command:* \`${prefix}setinfomatkul\``,
                    '',
                    `Set note tambahan untuk matkul (daring, jam pengganti, dll).`,
                    '',
                    `*Format:*`,
                    `\`${prefix}setinfomatkul <nama matkul> | <note>\``,
                    '',
                    `*Contoh:*`,
                    `\`${prefix}setinfomatkul dasar pemrograman | daring\``,
                    `\`${prefix}setinfomatkul basis data | dosen sakit\``,
                    `\`${prefix}setinfomatkul dasar pemrograman | clear\``,
                ].join('\n'),
            },
            kuliah_info_acclek: {
                title: '🔓 WHITELIST GRUP',
                body: [
                    `*Command:* \`${prefix}acclek\``,
                    '',
                    `Kelola grup yang *di-acc* — bot cuma jalan di grup yang di-acc.`,
                    '',
                    `*Subcommand:*`,
                    `\`${prefix}acclek\`           — lihat daftar`,
                    `\`${prefix}acclek add\`       — acc grup ini`,
                    `\`${prefix}acclek remove\`    — lepas acc grup ini`,
                    `\`${prefix}acclek on\`        — filter ON`,
                    `\`${prefix}acclek off\`       — filter OFF`,
                    '',
                    `_Owner only._`,
                ].join('\n'),
            },
            kuliah_info_blockgc: {
                title: '🚫 BLACKLIST GRUP',
                body: [
                    `*Command:* \`${prefix}blockgc\``,
                    '',
                    `Blokir grup biar bot *diam total* di grup itu.`,
                    '',
                    `*Subcommand:*`,
                    `\`${prefix}blockgc\`             — menu tombol`,
                    `\`${prefix}blockgc list\`        — lihat grup diblokir`,
                    `\`${prefix}blockgc add <jid>\`   — blokir manual`,
                    `\`${prefix}blockgc remove <jid>\`— unblock`,
                    `\`${prefix}blockgc clear\`       — hapus semua blokir`,
                    '',
                    `_Owner only._`,
                ].join('\n'),
            },
        };

        const data = info[buttonId];
        if (!data) return false;

        return m.reply(`*${data.title}*\n\n${data.body}`);
    },

    buttonPrefix: 'kuliah',
};