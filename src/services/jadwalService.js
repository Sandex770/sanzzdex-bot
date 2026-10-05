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

// ====== Util normalisasi ======
const normalizeJam = (jam) => {
    // Terima "08.00", "08:00", "0800", "8" → "08:00"
    const s = String(jam).trim().replace('.', ':');
    if (s.includes(':')) {
        const [h, m] = s.split(':');
        return `${String(h).padStart(2, '0')}:${String(m || '00').padStart(2, '0')}`;
    }
    if (/^\d{3,4}$/.test(s)) {
        const h = s.slice(0, s.length - 2);
        const m = s.slice(-2);
        return `${String(h).padStart(2, '0')}:${m}`;
    }
    if (/^\d{1,2}$/.test(s)) {
        return `${String(s).padStart(2, '0')}:00`;
    }
    return null;
};

const slugify = (str) =>
    str
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');

const sortByJam = (arr) =>
    arr.sort((a, b) => jamKeMenit(a.jam_masuk) - jamKeMenit(b.jam_masuk));

// ====== CRUD Matkul ======

/**
 * Tambah matkul baru.
 * @returns {Promise<{ok: boolean, msg: string, data?: object}>}
 */
export const addMatkul = async (hari, nama, jamMasuk, jamKeluar, ruangan, dosen) => {
    const h = hari.toLowerCase().trim();
    if (!HARI.includes(h)) {
        return { ok: false, msg: `Hari tidak valid. Pilihan: ${HARI.join(', ')}` };
    }

    const jm = normalizeJam(jamMasuk);
    const jk = normalizeJam(jamKeluar);
    if (!jm || !jk) {
        return { ok: false, msg: 'Format jam tidak valid. Contoh: `08.00 - 09.30`' };
    }
    if (jamKeMenit(jm) >= jamKeMenit(jk)) {
        return { ok: false, msg: 'Jam masuk harus lebih awal dari jam keluar.' };
    }

    const data = await loadJadwal();
    const list = data.jadwal[h];

    const namaClean = nama.trim();
    const dup = list.some((mk) => mk.nama.toLowerCase() === namaClean.toLowerCase());
    if (dup) {
        return { ok: false, msg: `Matkul *${namaClean}* sudah ada di hari *${h}*.` };
    }

    const newMatkul = {
        id: slugify(namaClean),
        nama: namaClean,
        jam_masuk: jm,
        jam_keluar: jk,
        ruangan: ruangan.trim(),
        dosen: dosen.trim(),
        note: '',
    };

    list.push(newMatkul);
    sortByJam(list);
    await saveJadwal();

    return { ok: true, msg: `Matkul *${namaClean}* ditambahkan ke hari *${h}*.`, data: newMatkul };
};

/**
 * Update field tertentu dari matkul.
 * Field: nama, jam_masuk, jam_keluar, ruangan, dosen, note
 */
export const updateMatkul = async (hari, namaQuery, field, nilai) => {
    const h = hari.toLowerCase().trim();
    if (!HARI.includes(h)) {
        return { ok: false, msg: `Hari tidak valid. Pilihan: ${HARI.join(', ')}` };
    }

    const allowedFields = ['nama', 'jam_masuk', 'jam_keluar', 'ruangan', 'dosen', 'note'];
    const f = field.toLowerCase().trim();
    if (!allowedFields.includes(f)) {
        return { ok: false, msg: `Field tidak valid. Pilihan: ${allowedFields.join(', ')}` };
    }

    const data = await loadJadwal();
    const list = data.jadwal[h];
    const q = namaQuery.toLowerCase().trim();

    const target = list.find((mk) => mk.nama.toLowerCase() === q) ||
                   list.find((mk) => mk.nama.toLowerCase().includes(q)) ||
                   list.find((mk) => mk.id === q);

    if (!target) {
        return { ok: false, msg: `Matkul *${namaQuery}* tidak ditemukan di hari *${h}*.` };
    }

    let newVal = nilai.trim();

    if (f === 'jam_masuk' || f === 'jam_keluar') {
        const n = normalizeJam(newVal);
        if (!n) return { ok: false, msg: 'Format jam tidak valid.' };
        newVal = n;

        // Cek jam masuk < jam keluar
        const jm = f === 'jam_masuk' ? jamKeMenit(n) : jamKeMenit(target.jam_masuk);
        const jk = f === 'jam_keluar' ? jamKeMenit(n) : jamKeMenit(target.jam_keluar);
        if (jm >= jk) return { ok: false, msg: 'Jam masuk harus lebih awal dari jam keluar.' };
    }

    if (f === 'nama') {
        const dup = list.some(
            (mk) => mk !== target && mk.nama.toLowerCase() === newVal.toLowerCase()
        );
        if (dup) return { ok: false, msg: `Nama *${newVal}* sudah dipakai matkul lain.` };
        target.id = slugify(newVal);
    }

    target[f] = newVal;

    if (f === 'jam_masuk' || f === 'jam_keluar') {
        sortByJam(list);
    }

    await saveJadwal();
    return { ok: true, msg: `Field *${f}* matkul *${target.nama}* berhasil diupdate.`, data: target };
};

/**
 * Hapus matkul.
 */
export const deleteMatkul = async (hari, namaQuery) => {
    const h = hari.toLowerCase().trim();
    if (!HARI.includes(h)) {
        return { ok: false, msg: `Hari tidak valid. Pilihan: ${HARI.join(', ')}` };
    }

    const data = await loadJadwal();
    const list = data.jadwal[h];
    const q = namaQuery.toLowerCase().trim();

    const idx = list.findIndex(
        (mk) => mk.nama.toLowerCase() === q || mk.nama.toLowerCase().includes(q) || mk.id === q
    );

    if (idx === -1) {
        return { ok: false, msg: `Matkul *${namaQuery}* tidak ditemukan di hari *${h}*.` };
    }

    const removed = list.splice(idx, 1)[0];
    await saveJadwal();
    return { ok: true, msg: `Matkul *${removed.nama}* dihapus dari hari *${h}*.`, data: removed };
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