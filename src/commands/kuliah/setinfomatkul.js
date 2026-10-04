import { setNoteMatkul } from '../../services/jadwalService.js';

export default {
    name: 'setinfomatkul',
    aliases: ['setnote', 'infomatkul'],
    description: 'Set/edit note matkul. Format: .setinfomatkul <nama matkul> | <note>',
    category: 'Kuliah',
    execute: async (sock, m, args, text) => {
        if (!text || !text.includes('|')) {
            return m.reply(
                '📝 *Format:*\n' +
                '`.setinfomatkul <nama matkul> | <note>`\n\n' +
                '*Contoh:*\n' +
                '`.setinfomatkul dasar pemograman | daring`\n' +
                '`.setinfomatkul basis data | dosen sakit, diganti minggu depan`\n' +
                '`.setinfomatkul dasar pemograman | clear` (hapus note)'
            );
        }

        const [namaQuery, ...noteParts] = text.split('|');
        const note = noteParts.join('|').trim();
        if (!note) return m.reply('Note tidak boleh kosong. Pakai `clear` untuk hapus.');

        const found = await setNoteMatkul(namaQuery.trim(), note);
        if (!found) return m.reply(`❌ Matkul *${namaQuery.trim()}* tidak ditemukan di jadwal.`);

        if (note === 'clear') {
            return m.reply(`✅ Note *${found.nama}* berhasil dihapus.`);
        }
        m.reply(`✅ Note *${found.nama}* diupdate:\n📝 _${note}_`);
    },
};