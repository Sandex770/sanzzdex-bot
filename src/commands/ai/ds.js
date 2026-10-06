// ============================================================
// ds.js — DIMATIKAN SEMENTARA
// AI (DeepSeek) tidak aktif. Tidak ada panggilan ke external API.
// Untuk mengaktifkan kembali, restore dari ds.js.bak
// ============================================================

export const handleDsChat = async (sock, m) => {
    // Stub — tidak melakukan apa-apa
    return false;
};

export const getDsSession = () => [];
export const appendDsSession = () => {};
export const clearDsSession = () => {};

export default {
    name: 'ds',
    aliases: ['deepseek', 'dseeker', 'ai', 'gpt'],
    description: '(disabled) AI dimatikan sementara',
    category: 'AI',
    execute: async (sock, m) => {
        return m.reply('⚠️ Fitur AI sedang *dimatikan* oleh admin.');
    },
};