import {
    isGroupBlocked,
    getBlockedGroups,
    blockGroup,
    unblockGroup,
    clearBlocked,
} from '../../services/blockgcService.js';

const shortenName = (name) => {
    if (!name) return '(no name)';
    return name.length > 30 ? name.slice(0, 27) + '...' : name;
};

// Helper: ambil buttonId dari berbagai format pesan
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

export default {
    name: 'blockgc',
    aliases: ['blockgrup', 'blacklistgc'],
    description: 'Blokir/unblock grup biar bot diam total',
    category: 'Owner',
    execute: async (sock, m, args, text) => {
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
        if (sub === 'add' || sub === 'block') {
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

        // ===== DEFAULT: tampilkan menu tombol =====
        const blocked = await getBlockedGroups();

        const teks = [
            `🚫 *MANAJEMEN BLOKIR GRUP*`,
            '',
            `Total diblokir: *${blocked.length}* grup`,
            '',
            'Pilih aksi di bawah:',
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
                            text: 'Pilih aksi',
                        },
                        nativeFlowMessage: {
                            messageVersion: 1,
                            buttons: [
                                {
                                    name: 'single_select',
                                    buttonParamsJson: JSON.stringify({
                                        title: 'Pilih Aksi',
                                        sections: [
                                            {
                                                title: 'Aksi',
                                                rows: [
                                                    {
                                                        title: '🚫 Blokir Grup',
                                                        description: 'Blokir grup biar bot diam',
                                                        id: 'blockgc_menu_block',
                                                    },
                                                    {
                                                        title: '🔓 Buka Blokir',
                                                        description: 'Aktifkan grup kembali',
                                                        id: 'blockgc_menu_unblock',
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
            return m.reply(`❌ Gagal kirim tombol: ${e.message}`);
        }
    },

    handleButton: async (sock, m, isOwner) => {
        if (!isOwner) return false;

        const buttonId = extractButtonId(m);
        if (!buttonId || !buttonId.startsWith('blockgc_')) return false;

        // ===== MENU: BLOKIR =====
        if (buttonId === 'blockgc_menu_block') {
            const allGroups = await sock.groupFetchAllParticipating();
            const blocked = await getBlockedGroups();
            const blockedSet = new Set(blocked);

            const activeGroups = Object.values(allGroups).filter((g) => !blockedSet.has(g.id));
            if (!activeGroups.length) {
                return m.reply('📭 Tidak ada grup aktif yang bisa diblokir.');
            }

            const rows = activeGroups.slice(0, 50).map((g) => ({
                title: `✅ ${shortenName(g.subject)}`,
                description: `${g.participants?.length || 0} member`,
                id: `blockgc_pick_${g.id}`,
            }));

            try {
                return await sock.sendMessage(
                    m.chat,
                    {
                        interactiveMessage: {
                            body: {
                                text: `🚫 *PILIH GRUP UNTUK DIBLOKIR*`,
                            },
                            footer: {
                                text: `Total ${rows.length} grup aktif`,
                            },
                            nativeFlowMessage: {
                                messageVersion: 1,
                                buttons: [
                                    {
                                        name: 'single_select',
                                        buttonParamsJson: JSON.stringify({
                                            title: 'Pilih Grup',
                                            sections: [
                                                {
                                                    title: `Grup Aktif (${rows.length})`,
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
                return m.reply(`❌ Gagal kirim list: ${e.message}`);
            }
        }

        // ===== MENU: UNBLOCK =====
        if (buttonId === 'blockgc_menu_unblock') {
            const blocked = await getBlockedGroups();
            if (!blocked.length) {
                return m.reply('📭 Tidak ada grup yang sedang diblokir.');
            }

            const rows = [];
            for (const jid of blocked.slice(0, 50)) {
                let name = jid;
                let count = 0;
                try {
                    const meta = await sock.groupMetadata(jid);
                    name = meta.subject || jid;
                    count = meta.participants?.length || 0;
                } catch {}
                rows.push({
                    title: `🚫 ${shortenName(name)}`,
                    description: `${count} member · DIBLOKIR`,
                    id: `blockgc_unpick_${jid}`,
                });
            }

            try {
                return await sock.sendMessage(
                    m.chat,
                    {
                        interactiveMessage: {
                            body: {
                                text: `🔓 *PILIH GRUP UNTUK DIBUKA BLOKIRNYA*`,
                            },
                            footer: {
                                text: `Total ${rows.length} grup diblokir`,
                            },
                            nativeFlowMessage: {
                                messageVersion: 1,
                                buttons: [
                                    {
                                        name: 'single_select',
                                        buttonParamsJson: JSON.stringify({
                                            title: 'Pilih Grup',
                                            sections: [
                                                {
                                                    title: `Diblokir (${rows.length})`,
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
                return m.reply(`❌ Gagal kirim list: ${e.message}`);
            }
        }

        // ===== User pilih grup untuk DIBLOKIR =====
        if (buttonId.startsWith('blockgc_pick_')) {
            const jid = buttonId.replace('blockgc_pick_', '');
            let name = jid;
            try {
                const meta = await sock.groupMetadata(jid);
                name = meta.subject || jid;
            } catch {}

            try {
                return await sock.sendMessage(
                    m.chat,
                    {
                        interactiveMessage: {
                            body: {
                                text: `🚫 Blokir grup *${name}*?\n\n\`${jid}\``,
                            },
                            footer: {
                                text: 'Konfirmasi',
                            },
                            nativeFlowMessage: {
                                messageVersion: 1,
                                buttons: [
                                    {
                                        name: 'quick_reply',
                                        buttonParamsJson: JSON.stringify({
                                            display_text: '🚫 Blokir',
                                            id: `blockgc_do_block_${jid}`,
                                        }),
                                    },
                                    {
                                        name: 'quick_reply',
                                        buttonParamsJson: JSON.stringify({
                                            display_text: '❌ Batal',
                                            id: 'blockgc_cancel',
                                        }),
                                    },
                                ],
                            },
                        },
                    },
                    { quoted: m }
                );
            } catch (e) {
                return m.reply(`❌ Gagal kirim konfirmasi: ${e.message}`);
            }
        }

        // ===== User pilih grup untuk DIBUKA BLOKIRNYA =====
        if (buttonId.startsWith('blockgc_unpick_')) {
            const jid = buttonId.replace('blockgc_unpick_', '');
            let name = jid;
            try {
                const meta = await sock.groupMetadata(jid);
                name = meta.subject || jid;
            } catch {}

            try {
                return await sock.sendMessage(
                    m.chat,
                    {
                        interactiveMessage: {
                            body: {
                                text: `🔓 Buka blokir grup *${name}*?\n\n\`${jid}\``,
                            },
                            footer: {
                                text: 'Konfirmasi',
                            },
                            nativeFlowMessage: {
                                messageVersion: 1,
                                buttons: [
                                    {
                                        name: 'quick_reply',
                                        buttonParamsJson: JSON.stringify({
                                            display_text: '🔓 Buka Blokir',
                                            id: `blockgc_do_unblock_${jid}`,
                                        }),
                                    },
                                    {
                                        name: 'quick_reply',
                                        buttonParamsJson: JSON.stringify({
                                            display_text: '❌ Batal',
                                            id: 'blockgc_cancel',
                                        }),
                                    },
                                ],
                            },
                        },
                    },
                    { quoted: m }
                );
            } catch (e) {
                return m.reply(`❌ Gagal kirim konfirmasi: ${e.message}`);
            }
        }

        // ===== Eksekusi blokir =====
        if (buttonId.startsWith('blockgc_do_block_')) {
            const jid = buttonId.replace('blockgc_do_block_', '');
            await blockGroup(jid);
            return m.reply(`✅ Grup berhasil diblokir.\n\`${jid}\``);
        }

        // ===== Eksekusi unblock =====
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