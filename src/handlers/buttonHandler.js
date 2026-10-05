import { buttonHandlers } from '../lib/commands.js';

/**
 * Dynamic Universal Button Dispatcher
 * Menangani semua interaksi tombol berdasarkan pendaftaran otomatis dari plugin
 * Support: buttonsResponseMessage, listResponseMessage, templateButtonReplyMessage,
 *          dan interactiveResponseMessage (native flow / zapo).
 */
export const handleButtons = async (sock, m, isOwner) => {
    let buttonId = '';

    // 1. Tombol klasik (Baileys)
    buttonId =
        m.message?.buttonsResponseMessage?.selectedButtonId ||
        m.message?.templateButtonReplyMessage?.selectedId ||
        m.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
        '';

    // 2. Tombol interactive / native flow (zapo-js, WA Beta)
    if (!buttonId) {
        const interactive = m.message?.interactiveResponseMessage;
        if (interactive) {
            const paramsRaw =
                interactive?.nativeFlowResponseMessage?.paramsJson ||
                interactive?.nativeFlowResponseMessage?.paramsJSON ||
                interactive?.nativeFlowResponseMessage?.params ||
                '';
            try {
                const params =
                    typeof paramsRaw === 'string' ? JSON.parse(paramsRaw) : paramsRaw || {};
                buttonId = params?.id || params?.selectedId || params?.selectedRowId || '';
            } catch {
                buttonId = '';
            }
        }
    }

    // 3. Fallback: dari m.msg (kadang zapo taruh di sini)
    if (!buttonId) {
        const rawText =
            m.msg?.nativeFlowResponseMessage?.paramsJson ||
            m.msg?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson ||
            '';
        try {
            const params = typeof rawText === 'string' ? JSON.parse(rawText) : rawText || {};
            buttonId = params?.id || '';
        } catch {
            buttonId = '';
        }
    }

    // 4. Debug log (bisa dihapus nanti)
    if (!buttonId && (m.message?.interactiveResponseMessage || m.message?.buttonsResponseMessage || m.message?.listResponseMessage)) {
        console.log('[BUTTON DEBUG] Tidak ada buttonId yang kebaca.');
        console.log('[BUTTON DEBUG] m.message keys:', Object.keys(m.message || {}));
        console.log('[BUTTON DEBUG] raw message:', JSON.stringify(m.message, null, 2).slice(0, 2000));
        return false;
    }

    if (!buttonId) return false;

    // Ambil prefix (bagian sebelum underscore pertama)
    // Contoh: 'blockgc_menu_block' -> prefix: 'blockgc'
    const prefix = buttonId.split('_')[0].toLowerCase();

    // Cari handler yang cocok di Map buttonHandlers
    const handler = buttonHandlers.get(prefix);

    if (handler) {
        try {
            return await handler(sock, m, isOwner);
        } catch (err) {
            console.error(`Error in Button Handler for prefix ${prefix}:`, err);
            await m.reply(`❌ Terjadi kesalahan saat memproses tombol: ${err.message}`);
            return true;
        }
    }

    return false;
};