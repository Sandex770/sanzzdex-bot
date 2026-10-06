import { getNotifTime, setNotifTime } from '../../services/jadwalService.js';

export default {
    name: 'setnotif',
    aliases: ['setjamnotif', 'notiftime'],
    description: 'Set jam notif jadwal malam',
    category: 'Kuliah',
    execute: async (sock, m, args, text) => {
        // Cek akses: owner atau admin grup
        const isOwner = m.isOwner;
        let isAdmin = false;
        if (m.isGroup && m.metadata?.participants) {
            const sender = m.sender;
            const found = m.metadata.participants.find((p) => {
                const pid = typeof p === 'string' ? p : p.id || p.jid;
                return pid === sender;
            });
            if (found && (found.admin === 'admin' || found.admin === 'superadmin')) {
                isAdmin = true;
            }
        }

        if (!isOwner && !isAdmin) {
            return m.reply('❌ Akses ditolak. Hanya *owner* atau *admin grup*.');
        }

        // Tanpa argumen → tampilkan jam saat ini
        const input = (args[0] || '').trim();
        if (!input) {
            const now = await getNotifTime();
            return m.reply(
                `⏰ *JAM NOTIF JADWAL*\n\n` +
                    `Jam saat ini: *${now} WIB*\n\n` +
                    `*Ubah:*\n` +
                    `\`.setnotif <jam>\`\n\n` +
                    `*Contoh:*\n` +
                    `\`.setnotif 20.00\`\n` +
                    `\`.setnotif 20:30\`\n` +
                    `\`.setnotif 8\``
            );
        }

        // Parse jam: terima "20.00", "20:00", "2000", "8"
        const normalized = (() => {
            const s = input.replace('.', ':').trim();
            if (/^\d{1,2}:\d{2}$/.test(s)) {
                const [h, mm] = s.split(':');
                return `${String(h).padStart(2, '0')}:${mm.padStart(2, '0')}`;
            }
            if (/^\d{3,4}$/.test(s)) {
                const h = s.slice(0, s.length - 2);
                const mm = s.slice(-2);
                return `${String(h).padStart(2, '0')}:${mm}`;
            }
            if (/^\d{1,2}$/.test(s)) {
                return `${String(s).padStart(2, '0')}:00`;
            }
            return null;
        })();

        if (!normalized) {
            return m.reply(
                `❌ Format jam salah.\n\n` +
                    `*Contoh:*\n` +
                    `\`.setnotif 20.00\`\n` +
                    `\`.setnotif 20:30\`\n` +
                    `\`.setnotif 8\``
            );
        }

        const [h, mm] = normalized.split(':').map(Number);
        if (h < 0 || h > 23 || mm < 0 || mm > 59) {
            return m.reply('❌ Jam tidak valid. Range: `00:00` - `23:59`');
        }

        await setNotifTime(normalized);

        return m.reply(
            `✅ Jam notif jadwal berhasil diubah.\n\n` +
                `⏰ Jam baru: *${normalized} WIB*\n\n` +
                `_Notif bakal dikirim setiap hari jam ${normalized} WIB._`
        );
    },
};