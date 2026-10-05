import {
    isGroupBlocked,
    getBlockedGroups,
    blockGroup,
    unblockGroup,
    clearBlocked,
} from '../../services/blockgcService.js';

const MAX_LIST = 50; // batas maksimum grup dalam list biar nggak berat

const shortenName = (name) => {
    if (!name) return '(no name)';
    return name.length > 30 ? name.slice(0, 27) + '...' : name;
};

export default {
    name: 'blockgc',
    aliases: ['blockgrup', 'blacklistgc'],
    description: 'Blokir/unblock grup biar bot diam total',
    category: 'Owner',
    execute: async (sock, m, args, text) => {
        // Owner-only (command category Owner sudah handle di handler)
        const sub = (args[0] || '').toLowerCase();

        // ===== SUBCOMMAND: list =====
        if (sub === 'list') {
            const blocked = await getBlockedGroups();
            if (!blocked.length) return m.reply('📭 Belum ada grup yang diblokir.');
            const lines = [`🚫 *GRUP DIBLOKIR (${blocked.length})*`, ''];
            for (const jid of blocked) {
                let name = '(tidak diketahui)';
                try {
                    const meta = await sock.groupMetadata(jid);
                    name = meta.subject || name;
                } catch {}
                lines.push(`• ${name}\n  \`${jid}\``);
            }
            return m.reply(lines.join('\n'));
        }

        // ===== SUBCOMMAND: add <jid> =====
        if (sub === 'add') {
            const target = args[1];
            if (!target) return m.reply('Format: `.blockgc add <jid_grup>`');
            const jid = target.includes('@g.us') ? target : `${target}@g.us`;
            const list = await blockGroup(jid);
            return m.reply(`✅ Grup diblokir: \`${jid}\`\nTotal diblokir: ${list.length}`);
        }

        // ===== SUBCOMMAND: remove <jid> =====
        if (sub === 'remove' || sub === 'del' || sub === 'unblock') {
            const target = args[1];
            if (!target) return m.reply('Format: `.blockgc remove <jid_grup>`');
            const jid = target.includes('@g.us') ? target : `${target}@g.us`;
            const list = await unblockGroup(jid);
            return m.reply(`✅ Grup dibuka blokirnya: \`${jid}\`\nTotal diblokir: ${list.length}`);
        }

        // ===== SUBCOMMAND: clear =====
        if (sub === 'clear') {
            const list = await clearBlocked();
            return m.reply(`✅ Semua blokir dihapus.\nTotal diblokir: ${list.length}`);
        }

        // ===== DEFAULT: tampilkan menu list tombol =====
        let allGroups;
        try {
            allGroups = await sock.groupFetchAllParticipating();
        } catch (e) {
            return m.reply(`❌ Gagal ambil daftar grup: ${e.message}`);
        }

        const groupArr = Object.values(allGroups);
        if (!groupArr.length) return m.reply('📭 Bot tidak berada di grup mana pun.');

        const blocked = await getBlockedGroups();
        const blockedSet = new Set(blocked);

        // Sort: yang diblokir di atas, lalu alfabetis
        groupArr.sort((a, b) => {
            const aB = blockedSet.has(a.id) ? 0 : 1;
            const bB = blockedSet.has(b.id) ? 0 : 1;
            if (aB !== bB) return aB - bB;
            return (a.subject || '').localeCompare(b.subject || '');
        });

        // Batasi jumlah list biar nggak overload
        const sliced = groupArr.slice(0, MAX_LIST);

        // Build list rows
        const rows = sliced.map((g) => {
            const isBlocked = blockedSet.has(g.id);
            return {
                title: `${isBlocked ? '🚫 ' : '✅ '}${shortenName(g.subject)}`,
                description: `${g.participants?.length || 0} member · ${isBlocked ? 'DIBLOKIR' : 'aktif'}`,
                id: `blockgc_pick_${g.id}`,
            };
        });

        const sections = [
            {
                title: `Grup (${sliced.length}/${groupArr.length})`,
                rows,
            },
        ];

        const teks = [
            `🚫 *MANAJEMEN BLOKIR GRUP*`,
            '',
            `Total grup bot: *${groupArr.length}*`,
            `Sedang diblokir: *${blocked.length}*`,
            '',
            'Pilih grup di bawah untuk blokir/unblock:',
            '',
            `_Menampilkan ${sliced.length} grup pertama._`,
        ].join('\n');

        try {
            return await sock.sendMessage(
                m.chat,
                {
                    text: teks,
                    footer: 'Pilih grup',
                    buttons: [
                        {
                            buttonId: 'action',
                            buttonText: { displayText: 'Pilih Grup' },
                            type: 6,
                            nativeFlowInfo: {
                                name: 'single_select',
                                paramsJson: JSON.stringify({
                                    title: 'Daftar Grup',
                                    sections,
                                }),
                            },
                        },
                    ],
                    headerType: 1,
                },
                { quoted: m }
            );
        } catch {
            // Fallback kalau tombol gagal (client lama)
            const lines = [`🚫 *MANAJEMEN BLOKIR GRUP*`, ''];
            lines.push(`Total grup: ${groupArr.length} · Diblokir: ${blocked.length}`);
            lines.push('');
            lines.push('_Tombol tidak didukung. Pakai subcommand:_');
            lines.push('`.blockgc add <jid>`');
            lines.push('`.blockgc remove <jid>`');
            lines.push('`.blockgc list`');
            lines.push('`.blockgc clear`');
            return m.reply(lines.join('\n'));
        }
    },

    // ===== HANDLE TOMBOL =====
    // Dipanggil saat user klik list item (buttonId diawali "blockgc_")
    handleButton: async (sock, m, isOwner) => {
        if (!isOwner) return false;

        const buttonId =
            m.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
            m.message?.buttonsResponseMessage?.selectedButtonId ||
            '';

        if (!buttonId.startsWith('blockgc_')) return false;

        // Format: blockgc_pick_<jid>
        if (buttonId.startsWith('blockgc_pick_')) {
            const jid = buttonId.replace('blockgc_pick_', '');
            const isBlocked = await isGroupBlocked(jid);

            let name = jid;
            try {
                const meta = await sock.groupMetadata(jid);
                name = meta.subject || jid;
            } catch {}

            const actionText = isBlocked
                ? `🔓 Buka blokir grup *${name}*?`
                : `🚫 Blokir grup *${name}*?`;

            return sock.sendMessage(
                m.chat,
                {
                    text: `${actionText}\n\n\`${jid}\``,
                    footer: 'Konfirmasi',
                    buttons: [
                        {
                            buttonId: isBlocked ? `blockgc_do_unblock_${jid}` : `blockgc_do_block_${jid}`,
                            buttonText: { displayText: isBlocked ? 'Buka Blokir' : 'Blokir' },
                            type: 1,
                        },
                        {
                            buttonId: 'blockgc_cancel',
                            buttonText: { displayText: 'Batal' },
                            type: 1,
                        },
                    ],
                    headerType: 1,
                },
                { quoted: m }
            );
        }

        // ===== Konfirmasi blokir =====
        if (buttonId.startsWith('blockgc_do_block_')) {
            const jid = buttonId.replace('blockgc_do_block_', '');
            await blockGroup(jid);
            return m.reply(`✅ Grup berhasil diblokir.\n\`${jid}\``);
        }

        // ===== Konfirmasi unblock =====
        if (buttonId.startsWith('blockgc_do_unblock_')) {
            const jid = buttonId.replace('blockgc_do_unblock_', '');
            await unblockGroup(jid);
            return m.reply(`✅ Blokir grup dibuka.\n\`${jid}\``);
        }

        // ===== Batal =====
        if (buttonId === 'blockgc_cancel') {
            return m.reply('❌ Dibatalkan.');
        }

        return false;
    },

    buttonPrefix: 'blockgc',
};