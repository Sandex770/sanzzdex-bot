import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const DATA_PATH = path.resolve('data/accgrup.json');
const DEFAULT = { enabled: true, groups: [] };

let cache = null;
let writeQueue = Promise.resolve();

const load = async () => {
    if (cache) return cache;
    try {
        const raw = await readFile(DATA_PATH, 'utf8');
        cache = { ...DEFAULT, ...JSON.parse(raw) };
    } catch {
        cache = structuredClone(DEFAULT);
        await save();
    }
    return cache;
};

const save = async () => {
    if (!cache) return;
    writeQueue = writeQueue.then(async () => {
        await mkdir(path.dirname(DATA_PATH), { recursive: true });
        await writeFile(DATA_PATH, JSON.stringify(cache, null, 2), 'utf8');
    });
    return writeQueue;
};

export const isFilterEnabled = async () => (await load()).enabled;

export const setFilterEnabled = async (val) => {
    const data = await load();
    data.enabled = !!val;
    await save();
    return data.enabled;
};

export const getAccGroups = async () => (await load()).groups;

export const isGroupAcc = async (jid) => {
    const data = await load();
    return data.groups.includes(jid);
};

export const addAccGroup = async (jid) => {
    const data = await load();
    if (!data.groups.includes(jid)) {
        data.groups.push(jid);
        await save();
    }
    return data.groups;
};

export const removeAccGroup = async (jid) => {
    const data = await load();
    data.groups = data.groups.filter((g) => g !== jid);
    await save();
    return data.groups;
};

/**
 * Cek apakah command boleh dieksekusi.
 * Hanya berlaku untuk COMMAND (prefix), bukan pesan biasa / button.
 * @param {string} chatJid
 * @param {boolean} isOwner
 * @returns {Promise<boolean>}
 */
export const canRunCommand = async (chatJid, isOwner) => {
    if (isOwner) return true;
    const data = await load();
    if (!data.enabled) return true;
    if (!chatJid.endsWith('@g.us')) return true;  // DM user biasa → drop
    return data.groups.includes(chatJid);
};