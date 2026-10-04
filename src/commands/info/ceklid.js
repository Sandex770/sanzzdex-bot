import { settings } from '../../config/settings.js';

export default {
    name: 'ceklid',
    aliases: ['lid', 'getlid', 'whoami'],
    description: 'Menampilkan LID (Linked ID) dan JID WhatsApp',
    category: 'Info',
    execute: async (sock, m, args, text) => {
        try {
            // ================== AMBIL DATA PENGIRIM ==================
            const senderJid = m.sender || m.key?.participant || m.key?.remoteJid;
            const chatJid = m.chat || m.key?.remoteJid;
            const isGroup = chatJid?.endsWith('@g.us');
            const pushName = m.pushName || '(tidak ada nama)';

            // ================== AMBIL DATA DARI SOCKET ==================
            const botJid = sock.user?.id || '(unknown)';
            const botLid = sock.user?.lid || '(tidak ada LID)';
            const botName = sock.user?.name || settings.botName;

            // ================== KALAU REPLY, AMBIL DATA TARGET ==================
            let targetInfo = null;
            if (m.quoted || m.mentionedJid?.length > 0) {
                const targetJid = m.mentionedJid?.[0] || m.quoted?.sender;
                if (targetJid) {
                    // Coba ambil LID dari metadata grup kalau di grup
                    let targetLid = null;
                    if (isGroup) {
                        try {
                            const groupMeta = await sock.groupMetadata(chatJid);
                            const participant = groupMeta.participants.find(
                                (p) => p.id === targetJid || p.jid === targetJid
                            );
                            targetLid = participant?.lid || participant?.id?.split('@')[0];
                        } catch (e) {
                            // Ignore error ambil metadata
                        }
                    }

                    targetInfo = {
                        jid: targetJid,
                        lid: targetLid,
                        phone: targetJid?.split('@')[0]?.split(':')[0] || '-',
                    };
                }
            }

            // ================== SUSUN PESAN ==================
            let info = `*── 「 CEK LID WHATSAPP 」 ──*\n\n`;

            info += `*🤖 INFORMASI BOT*\n`;
            info += `➛ *Nama Bot :* ${botName}\n`;
            info += `➛ *Bot JID :* ${botJid}\n`;
            info += `➛ *Bot LID :* ${botLid}\n\n`;

            info += `*👤 INFORMASI PENGIRIM*\n`;
            info += `➛ *Nama :* ${pushName}\n`;
            info += `➛ *JID :* ${senderJid || '-'}\n`;
            info += `➛ *Nomor :* ${senderJid?.split('@')[0]?.split(':')[0] || '-'}\n`;
            info += `➛ *Tipe Chat :* ${isGroup ? 'Grup' : 'Pribadi'}\n`;
            info += `➛ *Chat JID :* ${chatJid || '-'}\n\n`;

            if (targetInfo) {
                info += `*🎯 INFORMASI TARGET (reply/mention)*\n`;
                info += `➛ *JID :* ${targetInfo.jid}\n`;
                info += `➛ *Nomor :* ${targetInfo.phone}\n`;
                info += `➛ *LID :* ${targetInfo.lid || '(tidak tersedia)'}\n\n`;
            }

            // ================== KALAU DI GRUP, TAMPILKAN INFO GRUP ==================
            if (isGroup) {
                try {
                    const groupMeta = await sock.groupMetadata(chatJid);
                    info += `*👥 INFORMASI GRUP*\n`;
                    info += `➛ *Nama :* ${groupMeta.subject || '-'}\n`;
                    info += `➛ *Grup ID :* ${groupMeta.id || '-'}\n`;
                    info += `➛ *Total Member :* ${groupMeta.participants?.length || 0}\n`;
                    info += `➛ *Pembuat :* ${groupMeta.owner?.split('@')[0] || '-'}\n\n`;
                } catch (e) {
                    info += `_Gagal ambil info grup: ${e.message}_\n\n`;
                }
            }

            info += `*© ${settings.botName}*`;

            // ================== KIRIM PESAN ==================
            await sock.sendMessage(
                m.chat,
                {
                    text: info,
                    contextInfo: {
                        externalAdReply: {
                            title: `Cek LID — ${settings.botName}`,
                            body: `Bot: ${botJid}`,
                            mediaType: 1,
                            renderLargerThumbnail: false,
                            showAdAttribution: true,
                            thumbnailUrl: 'https://s3.ireng.uk/13800c0f064f58af8d97c5ce065c00b4.png',
                            sourceUrl: 'https://github.com/idlanyor/zapota',
                        },
                    },
                },
                { quoted: m }
            );
        } catch (err) {
            console.error('[ceklid] Error:', err);
            await sock.sendMessage(
                m.chat,
                { text: `❌ Error saat cek LID:\n${err.message}` },
                { quoted: m }
            );
        }
    },
};