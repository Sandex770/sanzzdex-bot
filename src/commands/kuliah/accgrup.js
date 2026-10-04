import { addAccGroup, removeAccGroup, getAccGroups } from '../../services/jadwalService.js';

export default {
    name: 'accgrup',
    aliases: ['accgroup'],
    description: 'Acc grup untuk menerima notifikasi jadwal',
    category: 'Kuliah',
    execute: async (sock, m, args, text) => {
        const isGroup = m.chat.endsWith('@g.us');
        if (!isGroup) return m.reply('Command ini hanya bisa dijalankan di dalam grup.');

        if (args[0] === 'remove' || args[0] === 'del') {
            const list = await removeAccGroup(m.chat);
            return m.reply(`✅ Grup ini dihapus dari acc jadwal.\nTotal acc: ${list.length}`);
        }

        if (args[0] === 'list') {
            const list = await getAccGroups();
            if (!list.length) return m.reply('Belum ada grup ter-acc.');
            return m.reply(`📋 *Grup ter-acc (${list.length}):*\n${list.map((g, i) => `${i + 1}. ${g}`).join('\n')}`);
        }

        const list = await addAccGroup(m.chat);
        m.reply(`✅ Grup ini berhasil di-acc untuk notifikasi jadwal.\nTotal acc: ${list.length}`);
    },
};