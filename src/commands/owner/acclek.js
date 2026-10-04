import {
    getAccGroups, addAccGroup, removeAccGroup,
    isFilterEnabled, setFilterEnabled,
} from '../../services/accGrupService.js';

export default {
    name: 'acclek',
    aliases: ['accgrup', 'accgrub'],
    description: 'Kelola grup yang di-acc untuk bot berjalan',
    category: 'Owner',
    execute: async (sock, m, args) => {
        const sub = (args[0] || '').toLowerCase();

        if (sub === 'add') {
            if (!m.chat.endsWith('@g.us')) return m.reply('❌ Command ini hanya di grup.');
            const list = await addAccGroup(m.chat);
            return m.reply(`✅ Grup ini di-acc.\nTotal: *${list.length}* grup.`);
        }

        if (sub === 'remove' || sub === 'del') {
            if (!m.chat.endsWith('@g.us')) return m.reply('❌ Command ini hanya di grup.');
            const list = await removeAccGroup(m.chat);
            return m.reply(`✅ Grup ini dilepas dari acc.\nTotal: *${list.length}* grup.`);
        }

        if (sub === 'on') {
            await setFilterEnabled(true);
            return m.reply('🔒 Filter acc grup: *ON*\nBot hanya jalan di grup yang di-acc.');
        }

        if (sub === 'off') {
            await setFilterEnabled(false);
            return m.reply('🔓 Filter acc grup: *OFF*\nBot jalan di mana saja.');
        }

        const enabled = await isFilterEnabled();
        const list = await getAccGroups();

        const lines = [
            `📋 *DAFTAR GRUP TER-ACC*`,
            `Status filter: ${enabled ? '🔒 ON' : '🔓 OFF'}`,
            `Total: *${list.length}* grup`,
            '',
        ];

        if (!list.length) {
            lines.push('_Belum ada grup ter-acc._');
        } else {
            list.forEach((jid, i) => lines.push(`${i + 1}. \`${jid}\``));
        }

        lines.push('');
        lines.push('*Perintah:*');
        lines.push('`.acclek add` — acc grup ini');
        lines.push('`.acclek remove` — lepas acc grup ini');
        lines.push('`.acclek on` / `off` — filter on/off');
        lines.push('`.acclek` — lihat daftar');

        m.reply(lines.join('\n'));
    },
};