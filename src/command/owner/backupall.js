import { settings } from '../../config/settings.js';
import { backupAll, cleanupOldBackups } from '../../lib/backupAll.js';

const normalizeNumber = (jid) => {
    if (!jid) return '';
    return String(jid).split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
};

export default {
    name: 'backupall',
    aliases: ['backup', 'bk', 'backupvps'],
    description: 'Backup semua project di VPS (zapota + productkuu)',
    category: 'Owner',
    execute: async (sock, m, args, text) => {
        // ================== INFO DEBUG ==================
        const senderJid = m.sender || m.key?.participant || m.key?.remoteJid || '';
        const senderNum = normalizeNumber(senderJid);
        const chatJid = m.chat || m.key?.remoteJid || '';
        const isGroup = chatJid.endsWith('@g.us');

        // Ambil owner dari semua sumber
        const ownerNum = normalizeNumber(settings.ownerNumber);
        const botNum = normalizeNumber(process.env.BOT_NUMBER);
        const ownerLid = normalizeNumber(process.env.OWNER_LID);

        let dbOwners = [];
        try {
            const Settings = (await import('../../database/models/Settings.js')).default;
            const s = await Settings.findOne({ id: 'bot_settings' });
            dbOwners = (s?.owners || []).map(normalizeNumber);
        } catch (e) {}

        const ownerNums = [ownerNum, botNum, ownerLid, ...dbOwners].filter(Boolean);
        const isOwner = ownerNums.includes(senderNum);

        // Log debug
        console.log('========== [backupall DEBUG] ==========');
        console.log('Sender JID  :', senderJid);
        console.log('Sender Num  :', senderNum);
        console.log('Chat JID    :', chatJid);
        console.log('Is Group?   :', isGroup);
        console.log('Owner Nums  :', ownerNums.join(', '));
        console.log('Is Owner?   :', isOwner);
        console.log('========================================');

        if (!isOwner) {
            return m.reply(
                `❌ *Akses Ditolak*\n\n` +
                `🔹 Nomor kamu: \`${senderNum}\`\n` +
                `🔹 JID: \`${senderJid}\`\n` +
                `🔹 Chat: \`${chatJid}\`\n` +
                `🔹 Owner: \`${ownerNums.join(', ')}\`\n\n` +
                `_Kalau kamu owner, kirim dari private chat, bukan grup._`
            );
        }

        // ================== PROSES BACKUP ==================
        await m.reply('⏳ *Memproses backup...*\nMohon tunggu 10-30 detik.');

        try {
            const results = await backupAll();
            const cleaned = cleanupOldBackups();

            const ownerJid = `${settings.ownerNumber.split('@')[0]}@s.whatsapp.net`;
            const fs = await import('fs');

            for (const r of results) {
                if (r.success) {
                    await sock.sendMessage(ownerJid, {
                        document: fs.readFileSync(r.file),
                        fileName: r.fileName,
                        mimetype: 'application/zip',
                        caption: `✅ *Backup ${r.name}*\n\n📦 File: ${r.fileName}\n📊 Ukuran: ${r.size}\n🕐 Waktu: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`,
                    });
                } else {
                    await sock.sendMessage(ownerJid, {
                        text: `❌ *Backup ${r.name} gagal:* ${r.error}`,
                    });
                }
            }

            const summary = results
                .map((r) =>
                    r.success
                        ? `✅ *${r.name}*: ${r.fileName} (${r.size})`
                        : `❌ *${r.name}*: ${r.error}`
                )
                .join('\n');

            await sock.sendMessage(m.chat, {
                text: `📦 *BACKUP SELESAI*\n\n${summary}\n\n🗑️ File lama dihapus: ${cleaned}\n📁 Lokasi: /root/backups/\n\n📩 File backup telah dikirim ke private chat owner.`,
            });
        } catch (e) {
            console.error('[backupall] Error:', e);
            m.reply(`❌ Error saat backup: ${e.message}`);
        }
    },
};