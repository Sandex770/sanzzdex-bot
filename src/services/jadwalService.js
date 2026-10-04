import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const DATA_PATH = path.resolve('data/jadwal.json');

const DEFAULT_DATA = {
    accGroups: [],
    jadwal: {
        senin: [], selasa: [], rabu: [], kamis: [],
        jumat: [], sabtu: [], minggu: [],
    },
    jamPengganti: {},
};

export const HARI = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];

let cache = null;
let writeQueue = Promise.resolve();

export const loadJadwal = async () => {
    if (cache) return cache;
    try {
        const raw = await readFile(DATA_PATH, 'utf8');
        cache = { ...DEFAULT_DATA, ...JSON.parse(raw) };
    } catch {
        cache = structuredClone(DEFAULT_DATA);
        await saveJadwal();
    }
    return cache;
};

export const saveJadwal = async () => {
    if (!cache) return;
    writeQueue = writeQueue.then(async () => {
        await mkdir(path.dirname(DATA_PATH), { recursive: true });
        await writeFile(DATA_PATH, JSON.stringify(cache, null, 2), 'utf8');
    });
    return writeQueue;
};

export const getJadwalHari = async (hari) => {
    const data = await loadJadwal();
    return data.jadwal[hari.toLowerCase()] || [];
};

export const getJamPengganti = async (tanggalISO) => {
    const data = await loadJadwal();
    return data.jamPengganti[tanggalISO] || null;
};

export const setNoteMatkul = async (namaQuery, note) => {
    const data = await loadJadwal();
    const q = namaQuery.toLowerCase().trim();
    let found = null;
    for (const hari of HARI) {
        for (const mk of data.jadwal[hari]) {
            if (mk.nama.toLowerCase().includes(q) || mk.id === q) {
                found = mk;
                break;
            }
        }
        if (found) break;
    }
    if (!found) return null;
    found.note = note === 'clear' ? '' : note;
    await saveJadwal();
    return found;
};

export const addAccGroup = async (jid) => {
    const data = await loadJadwal();
    if (!data.accGroups.includes(jid)) {
        data.accGroups.push(jid);
        await saveJadwal();
    }
    return data.accGroups;
};

export const removeAccGroup = async (jid) => {
    const data = await loadJadwal();
    data.accGroups = data.accGroups.filter((g) => g !== jid);
    await saveJadwal();
    return data.accGroups;
};

export const getAccGroups = async () => {
    const data = await loadJadwal();
    return data.accGroups;
};

// ====== Util tanggal WIB ======
export const getNowWIB = () => {
    const now = new Date();
    const wibMs = now.getTime() + 7 * 60 * 60 * 1000;
    return new Date(wibMs);
};

export const getHariIniWIB = () => HARI[getNowWIB().getUTCDay()];

export const getHariBesokWIB = () => HARI[(getNowWIB().getUTCDay() + 1) % 7];

export const getTanggalBesokISO = () => {
    const besok = new Date(getNowWIB().getTime() + 24 * 60 * 60 * 1000);
    return besok.toISOString().slice(0, 10);
};

export const getTanggalHariIniISO = () => getNowWIB().toISOString().slice(0, 10);

export const menitSekarangWIB = () => {
    const n = getNowWIB();
    return n.getUTCHours() * 60 + n.getUTCMinutes();
};

export const jamKeMenit = (jam) => {
    const [h, m] = jam.split(':').map(Number);
    return h * 60 + m;
};

export const formatTanggalIndo = (isoDate) => {
    const [y, m, d] = isoDate.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('id-ID', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        timeZone: 'UTC',
    });
};