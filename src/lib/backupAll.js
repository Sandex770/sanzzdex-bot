import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ================== KONFIGURASI ==================
const PROJECTS = [
    {
        name: 'zapota',
        path: '/root/zapota',
        exclude: [
            'node_modules',
            '.git',
            'data/zapo-auth.sqlite*',
            'auth_info_baileys',
            'sessions_jadibot',
            'backups',
            '*.log',
            'logs',
            'data/bot.db-wal',
            'data/bot.db-shm',
        ],
    },
    {
        name: 'productkuu',
        path: '/root/productkuu',
        exclude: [
            'node_modules',
            '.git',
            'backups',
            '*.log',
            'logs',
        ],
    },
];

const BACKUP_DIR = '/root/backups';
const MAX_BACKUP_AGE_DAYS = 7;

// ================== UTILS ==================
const ensureDir = (dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const timestamp = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
};

const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / k ** i).toFixed(2)} ${sizes[i]}`;
};

// ================== CORE ==================
/**
 * Backup satu project ke ZIP
 */
export const backupProject = async (project) => {
    const { name, path: projectPath, exclude } = project;

    if (!fs.existsSync(projectPath)) {
        return { success: false, error: `Folder tidak ada: ${projectPath}` };
    }

    ensureDir(BACKUP_DIR);

    const zipName = `${name}-${timestamp()}.zip`;
    const zipPath = path.join(BACKUP_DIR, zipName);

    // Build exclude args untuk zip
    const excludeArgs = exclude.map((e) => `--exclude='${e}'`).join(' ');

    // Command zip (dari dalam folder project)
    const cmd = `cd "${projectPath}" && zip -r "${zipPath}" . ${excludeArgs} -q`;

    try {
        await execAsync(cmd);
        const stats = fs.statSync(zipPath);
        return {
            success: true,
            name,
            file: zipPath,
            fileName: zipName,
            size: formatBytes(stats.size),
            sizeBytes: stats.size,
        };
    } catch (e) {
        return { success: false, error: e.message };
    }
};

/**
 * Backup semua project
 */
export const backupAll = async () => {
    const results = [];
    for (const project of PROJECTS) {
        const r = await backupProject(project);
        results.push(r);
    }
    return results;
};

/**
 * Hapus backup lama > N hari
 */
export const cleanupOldBackups = () => {
    ensureDir(BACKUP_DIR);
    const now = Date.now();
    const maxAgeMs = MAX_BACKUP_AGE_DAYS * 24 * 60 * 60 * 1000;
    let deleted = 0;

    try {
        const files = fs.readdirSync(BACKUP_DIR);
        for (const file of files) {
            if (!file.endsWith('.zip')) continue;
            const filePath = path.join(BACKUP_DIR, file);
            const stats = fs.statSync(filePath);
            if (now - stats.mtimeMs > maxAgeMs) {
                fs.unlinkSync(filePath);
                deleted++;
            }
        }
    } catch (e) {
        console.error('[cleanup] Error:', e.message);
    }

    return deleted;
};

/**
 * Kirim backup ke WhatsApp owner (dipakai cron otomatis)
 */
export const sendBackupToOwner = async (sock) => {
    const { settings } = await import('../config/settings.js');
    const ownerJid = `${settings.ownerNumber}@s.whatsapp.net`;

    const results = await backupAll();

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

    const cleaned = cleanupOldBackups();
    return { results, cleaned };
};

export default { backupAll, backupProject, cleanupOldBackups, sendBackupToOwner };