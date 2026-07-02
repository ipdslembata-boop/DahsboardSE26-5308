/* ============================================================================
 *  SKRIP B — DASHBOARD SE2026  ->  anomali.json
 * ----------------------------------------------------------------------------
 *  Menarik data MIKRO ANOMALI (Usaha + Keluarga) dari dashboard SE2026,
 *  lalu mengunduh anomali.json untuk di-upload ke GitHub (repo monitoringSE2026_5308).
 *
 *  CARA PAKAI (BARU — lebih andal, tidak perlu klik widget):
 *   1) Buka https://dashboard-se2026.apps.bps.go.id/se2026  (PASTIKAN SUDAH LOGIN)
 *   2) MUAT ULANG halaman (F5) & tunggu termuat penuh. <-- PENTING agar token segar.
 *   3) SEGERA tekan F12 -> Console -> tempel SELURUH skrip ini -> Enter.
 *   4) Tunggu ~30-60 detik (skrip memindai indikator). Muncul "SELESAI".
 *   5) Terunduh: anomali.json (1 file). Upload ke GitHub.
 *
 *  CATATAN PENTING: dashboard punya proteksi anti-bot yang token-nya CEPAT
 *  KEDALUWARSA (beberapa menit). Karena itu skrip HARUS dijalankan SEGERA
 *  setelah halaman dimuat ulang. Kalau muncul pesan "token TIDAK SEGAR",
 *  cukup F5 lalu jalankan skrip lagi. Skrip menarik data LANGSUNG via API
 *  (tidak perlu klik widget "Indikator Anomali" lebih dulu).
 * ========================================================================== */
(async () => {
  "use strict";
  const KODE_KAB = "5308";
  const NAMA_KAB = "LEMBATA";
  const BASE = "/api/mikro/anomali-case-kab";
  const SLEEP = (ms) => new Promise(r => setTimeout(r, ms));

  console.log("%c[Skrip B] Mulai menarik anomali SE2026...", "color:#4f46e5;font-weight:bold");

  // ---- 1) Cek sesi: harus di halaman dashboard & sudah login -------------
  if (!/dashboard-se2026\.apps\.bps\.go\.id/.test(location.host)) {
    console.error("[Skrip B] Jalankan DI HALAMAN dashboard-se2026.apps.bps.go.id (yang sudah login).");
    return;
  }

  // ---- 2) Helper fetch JSON (lewat sesi halaman) -------------------------
  async function getJSON(url) {
    const r = await fetch(url, { credentials: "include", headers: { "Accept": "application/json" } });
    const ct = r.headers.get("content-type") || "";
    if (!r.ok) throw new Error(`HTTP ${r.status} @ ${url}`);
    if (!ct.includes("json")) throw new Error(`Bukan JSON (kemungkinan sesi/bot-guard) @ ${url}`);
    return r.json();
  }

  // ---- 3) Temukan daftar indikator anomali (usaha + keluarga) ------------
  //  Strategi: ambil konfigurasi widget "Kualitas Data" untuk menemukan
  //  indikator anomali. Bila tak ketemu, fallback ke daftar manual.
  //  Endpoint mikro butuh: kode_kabupaten, indikator(id), type, anomali_no.
  //
  //  Karena setiap indikator anomali bisa punya beberapa "anomali_no",
  //  kita iterasi anomali_no 1..MAX dan berhenti saat kosong.

  //  === STRATEGI BARU (ANDAL): SCAN indikator langsung via API ===
  //  Struktur asli: tiap anomali_no punya ID indikator sendiri (mis. 128->no1, 129->no2, ...).
  //  Kita SCAN rentang ID indikator utk usaha & keluarga, simpan yang mengembalikan data.
  //  Tidak perlu klik widget / deteksi — jalan langsung asalkan sudah login di dashboard.
  const SCAN_IND_MIN = 120;   // batas bawah pemindaian ID indikator
  const SCAN_IND_MAX = 160;   // batas atas (cukup lebar utk semua jenis)
  const MAX_NO = 10;          // anomali_no yg dicoba per indikator
  //  Catatan: pemindaian bisa makan ~30-60 detik. Biarkan berjalan sampai "SELESAI".

  async function ambilCase(type, indikator, anomali_no) {
    const qs = new URLSearchParams({
      kode_kabupaten: KODE_KAB, indikator: String(indikator),
      sudah_indikator: "0", type, anomali_no: String(anomali_no)
    }).toString();
    try {
      const json = await getJSON(`${BASE}?${qs}`);
      return Array.isArray(json) ? json : (json.data || []);
    } catch (e) { return null; }   // null = gagal/non-JSON (mis. ID tak valid)
  }

  // ---- 3b) CEK TOKEN: pastikan endpoint balas JSON (bukan halaman bot-guard) ----
  //  Token anti-bot dashboard cepat kedaluwarsa. Kalau balasannya HTML,
  //  minta user MUAT ULANG halaman lalu jalankan skrip lagi (token jadi segar).
  try {
    const probe = await fetch(`${BASE}?kode_kabupaten=${KODE_KAB}&indikator=128&sudah_indikator=0&type=usaha&anomali_no=1`, { credentials: "include" });
    const pct = probe.headers.get("content-type") || "";
    if (!pct.includes("json")) {
      console.error("%c[Skrip B] Sesi/token dashboard TIDAK SEGAR (balasan bukan JSON).", "color:#dc2626;font-weight:bold;font-size:13px");
      console.error("SOLUSI: MUAT ULANG halaman dashboard (tekan F5), tunggu termuat penuh, lalu tempel & jalankan skrip ini LAGI segera.");
      return;
    }
  } catch (e) {
    console.error("[Skrip B] Gagal cek token:", e.message, "— muat ulang halaman & ulangi.");
    return;
  }

  console.log("%c[Skrip B] Memindai indikator anomali (langsung via API)... mohon tunggu ~30-60 detik.", "color:#4f46e5;font-weight:bold");
  const all = [];
  const ringkasIndikator = [];
  let totalScan = 0;

  for (const type of ["usaha", "keluarga"]) {
    let ketemuUtkType = 0;
    for (let ind = SCAN_IND_MIN; ind <= SCAN_IND_MAX; ind++) {
      // untuk tiap indikator, cari anomali_no yang berisi (coba pola ind-127 dulu, lalu 1..MAX)
      let didFind = false;
      const urutan = [];
      const tebak = ind - 127;                 // pola umum: ID = 127 + anomali_no
      if (tebak >= 1 && tebak <= MAX_NO) urutan.push(tebak);
      for (let n = 1; n <= MAX_NO; n++) if (!urutan.includes(n)) urutan.push(n);

      for (const no of urutan) {
        totalScan++;
        const list = await ambilCase(type, ind, no);
        if (list === null) continue;           // ID/no tak valid
        if (!list.length) continue;            // valid tapi 0 kasus utk kombinasi ini
        // ADA data -> simpan
        didFind = true; ketemuUtkType += list.length;
        list.forEach(x => all.push({
          jenis: type, anomali_no: no, indikator: ind,
          anomali: x.anomali_title || "",
          nama: x.nama_tercantum || "",
          provinsi: x.nama_provinsi || "",
          kabupaten: x.nama_kabupaten || NAMA_KAB,
          kecamatan: x.nama_kecamatan || "",
          desa: x.nama_desa || "",
          kode_wilayah: x.kode_wilayah || x.level_6_code || "",
          email: (x.email && x.email !== "-") ? x.email : "",
          id_petugas: (x.id_petugas && x.id_petugas !== "-") ? x.id_petugas : "",
          is_resolved: x.is_resolved === true || x.is_resolved === "true",
          assignment_id: x.assignment_id || "",
          link_fasih: x.link_fasih || ""
        }));
        ringkasIndikator.push({ type, indikator: ind, anomali_no: no, total: list.length,
          judul: [...new Set(list.map(r => r.anomali_title))][0] || "" });
        console.log(`  [${type}] ind ${ind} / no ${no}: ${list.length} kasus`);
        break;   // 1 indikator = 1 jenis anomali; lanjut ke ID berikutnya
      }
      await SLEEP(60);
    }
    console.log(`[Skrip B] ${type}: ${ketemuUtkType} kasus`);
  }

  console.log(`[Skrip B] Selesai memindai (${totalScan} percobaan).`);

  if (!all.length) {
    console.error("%c[Skrip B] Tidak ada data anomali ditemukan.", "color:#dc2626;font-weight:bold;font-size:13px");
    console.error("Kemungkinan: (1) belum login di dashboard SE2026, atau (2) sesi/token bot-guard belum aktif.");
    console.error("Coba: buka menu Kualitas Data (biarkan halaman termuat penuh) lalu JALANKAN ULANG skrip ini.");
    return;
  }

  // ---- 5) Susun summary ---------------------------------------------------
  const usaha = all.filter(r => r.jenis === "usaha");
  const keluarga = all.filter(r => r.jenis === "keluarga");
  const resolved = all.filter(r => r.is_resolved);
  const tanpaPetugas = all.filter(r => !r.email && !r.id_petugas);
  const byKec = {};
  all.forEach(r => { const k = r.kecamatan || "(kosong)"; byKec[k] = (byKec[k] || 0) + 1; });
  const kecTerbanyak = Object.entries(byKec).sort((a, b) => b[1] - a[1])[0] || ["-", 0];

  const out = {
    generated_at: new Date().toISOString(),
    generated_label: new Date().toLocaleString("id-ID", {
      day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
    }) + " WITA",
    kode_kabupaten: KODE_KAB,
    nama_kabupaten: NAMA_KAB,
    summary: {
      total: all.length,
      usaha: usaha.length,
      keluarga: keluarga.length,
      belum_tindak_lanjut: all.length - resolved.length,
      sudah_tindak_lanjut: resolved.length,
      tanpa_petugas: tanpaPetugas.length,
      kecamatan_terbanyak: { nama: kecTerbanyak[0], jumlah: kecTerbanyak[1] }
    },
    indikator: ringkasIndikator,
    data: all
  };


  function unduh(nama, isi, mime){
    const blob = new Blob([isi], { type: mime });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nama;
    document.body.appendChild(a); a.click(); a.remove();
  }

  // ---- 6) Unduh anomali.json (potret terkini) ----------------------------
  //  (Tren harian dihilangkan dari dashboard -> anomali_history.json tidak dibuat lagi.)
  unduh("anomali.json", JSON.stringify(out, null, 2), "application/json;charset=utf-8");

  console.log("%c[Skrip B] SELESAI", "color:#16a34a;font-weight:bold;font-size:14px");
  console.table(out.summary);
  console.log(`Terunduh: anomali.json (total ${all.length} kasus). Upload 1 file ini ke GitHub repo monitoringSE2026_5308 (drag-drop).`);
})();
