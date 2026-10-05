import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const DATA_PATH = path.resolve('data/blockgc.json');
const DEFAULT = { blocked: [] };

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

export const isGroupBlocked = async (jid) => {
    const data = await load();
    return data.blocked.includes(jid);
};

export const getBlockedGroups = async () => (await load()).blocked;

export const blockGroup = async (jid) => {
    const data = await load();
    if (!data.blocked.includes(jid)) {
        data.blocked.push(jid);
        await save();
    }
    return data.blocked;
};

export const unblockGroup = async (jid) => {
    const data = await load();
    data.blocked = data.blocked.filter((g) => g !== jid);
    await save();
    return data.blocked;
};

export const clearBlocked = async () => {
    const data = await load();
    data.blocked = [];
    await save();
    return data.blocked;
};