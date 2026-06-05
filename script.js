const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwYxD4LdYf9WGF7jsRetYC5fgNuw_vmX4KiYLLRDaEu_cl_6ZX9LTP7IJKYOzHkOOkgRw/exec'; 
const databaseAnggota = [
    "Agustinus Wahyu Wibowo_124230028_Sistem Informasi.JPG",
    "Aldi Ardianto_134230121_Agroteknologi.JPG",
    "Cintya Laura Riyanto_153230222_Ilmu Komunikasi.JPG",
    "Gea Sheila Regita Paramita_143230157_Ekonomi Pembangunan.JPG",
    "Lailatul Karimah_135230052_Agribisnis.JPG",
    "Muhammad Azzam Afif_142230351_Akuntansi.JPG",
    "Puspita Wati Hapsari_141230647_Manajemen.JPG",
    "Reina Anggraeni Tsany_121230190_Teknik Kimia (S1).JPG",
    "Stefanie Nadya Kusumaningrum_112220176_Teknik Pertambangan.JPG",
    "Taqy Athaya Dzakwan Mungin_113230211_Teknik Perminyakan.JPG"
];

let loadedFaceDescriptors = [];

// --- 1. SINKRONISASI INITIALIZATION & SPLASH SCREEN ---
document.addEventListener("DOMContentLoaded", async () => {
    const statusText = document.getElementById('status-absen');
    
    try {
        console.log("1. Memuat Model AI...");
        // Jalankan loading model secara paralel
        await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri('./models'),
            faceapi.nets.faceLandmark68Net.loadFromUri('./models'),
            faceapi.nets.faceRecognitionNet.loadFromUri('./models')
        ]);
        console.log("Model AI Berhasil Dimuat.");

        // Load gambar referensi sampai selesai
        await loadReferenceImages();

        // JIKA SEMUA SUDAH SIAP, HILANGKAN SPLASH SCREEN
        console.log("Semua sistem siap! Membuka Dashboard.");
        document.getElementById('splash-screen').classList.add('fade-out');
        const mainContent = document.getElementById('main-content');
        mainContent.classList.remove('hidden');
        mainContent.classList.add('fade-in');

    } catch (error) {
        console.error("Inisialisasi Gagal:", error);
        alert("Gagal memuat sistem absensi. Silakan buka Inspect Element (F12) untuk melihat error.");
    }
});

// --- 2. MENU NAVIGATION ---
const btnAbsen = document.getElementById('btn-absen');
const btnIzin = document.getElementById('btn-izin');
const areaAbsen = document.getElementById('area-absen');
const areaIzin = document.getElementById('area-izin');
const video = document.getElementById('kamera');

btnAbsen.addEventListener('click', async () => {
    areaAbsen.classList.remove('hidden');
    areaIzin.classList.add('hidden');
    areaAbsen.classList.add('fade-in');
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        video.srcObject = stream;
    } catch (err) {
        alert("Gagal mengakses kamera. Pastikan izin kamera diberikan.");
    }
});

btnIzin.addEventListener('click', () => {
    areaIzin.classList.remove('hidden');
    areaAbsen.classList.add('hidden');
    areaIzin.classList.add('fade-in');
    if(video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
    }
});

// --- 3. FACE RECOGNITION LOGIC ---
async function loadReferenceImages() {
    console.log("2. Memproses Database Gambar...");
    let successCount = 0;

    for (const filename of databaseAnggota) {
        try {
            const img = await faceapi.fetchImage(encodeURI(`./database_wajah/${filename}`));
            const detections = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
            
            if (detections) {
                const labelData = filename.replace('.jpg', '').replace('.jpeg', '').replace('.png', '');
                loadedFaceDescriptors.push(new faceapi.LabeledFaceDescriptors(labelData, [detections.descriptor]));
                successCount++;
                console.log(`[SUKSES] Terdaftar: ${labelData}`);
            } else {
                console.warn(`[GAGAL DETEKSI] Wajah tidak terbaca di file: ${filename}. Pastikan muka menghadap depan dan jelas.`);
            }
        } catch (e) {
            console.error(`[ERROR 404 / FILE RUSAK] Tidak bisa memuat file: ${filename}. Periksa nama/ekstensi file!`);
        }
    }
    console.log(`Selesai mendata wajah. Berhasil mendaftarkan ${successCount} dari ${databaseAnggota.length} anggota.`);
    
    if(successCount === 0) {
        throw new Error("Tidak ada satu pun wajah anggota yang berhasil didaftarkan ke database AI.");
    }
}

document.getElementById('btn-scan').addEventListener('click', async () => {
    const statusText = document.getElementById('status-absen');
    const btnText = document.getElementById('scan-text');
    const spinner = document.getElementById('scan-spinner');
    
    statusText.innerText = "Mendeteksi wajah dan lokasi...";
    statusText.className = "mt-3 text-sm font-semibold text-center text-blue-600";
    btnText.innerText = "Memproses...";
    spinner.classList.remove('hidden');

    // 1. Ambil Lokasi GPS
    navigator.geolocation.getCurrentPosition(async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        let lokasi = `${lat}, ${lng}`; // Nilai default jika API Alamat gagal

        // --- PERUBAHAN: Reverse Geocoding ke OpenStreetMap ---
        try {
            statusText.innerText = "Menerjemahkan lokasi koordinat...";
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
            const data = await response.json();
            
            if (data && data.display_name) {
                lokasi = data.display_name; // Mengisi variabel lokasi dengan alamat teks lengkap
            }
        } catch (error) {
            console.warn("Gagal mengambil alamat teks. Menggunakan koordinat default (lat, lng).", error);
        }

        statusText.innerText = "Memproses wajah kamera...";

        // 2. Ambil snapshot wajah dari kamera
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        const imageBase64 = canvas.toDataURL('image/jpeg', 0.8);

        const detection = await faceapi.detectSingleFace(video).withFaceLandmarks().withFaceDescriptor();

        if (!detection) {
            resetButton(statusText, btnText, spinner, "Wajah tidak terdeteksi oleh kamera. Coba tegakkan posisi wajah.", "text-red-600");
            return;
        }

        // 3. Cocokkan Wajah (Threshold diubah ke 0.6 agar lebih fleksibel)
        const faceMatcher = new faceapi.FaceMatcher(loadedFaceDescriptors, 0.6); 
        const match = faceMatcher.findBestMatch(detection.descriptor);

        if (match.label === "unknown") {
            resetButton(statusText, btnText, spinner, "Wajah tidak dikenali di database.", "text-red-600");
            return;
        }

        // 4. Jika Cocok, pisahkan data berdasarkan format nama_nim_prodi
        const [nama, nim, prodi] = match.label.split('_');
        statusText.innerText = `Halo ${nama.trim()}! Menyimpan data kehadiran...`;

        // 5. Kirim Data ke Spreadsheet
        fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'absen',
                nama: nama.trim(),
                nim: nim.trim(),
                prodi: prodi.trim(),
                lokasi: lokasi, // Data berupa nama jalan/desa/kecamatan/provinsi lengkap
                image: imageBase64
            })
        }).then(response => response.json())
          .then(data => {
              if(data.status === 'success') {
                  resetButton(statusText, btnText, spinner, "Absensi Berhasil Disimpan!", "text-green-600");
              }
          }).catch(err => {
              resetButton(statusText, btnText, spinner, "Gagal koneksi ke server Google Sheets.", "text-red-600");
          });

    }, (error) => {
        resetButton(statusText, btnText, spinner, "Gagal mendapatkan lokasi GPS. Izinkan akses lokasi.", "text-red-600");
    });
});

function resetButton(statusEl, btnTextEl, spinnerEl, msg, colorClass) {
    statusEl.innerText = msg;
    statusEl.className = `mt-3 text-sm font-semibold text-center ${colorClass}`;
    btnTextEl.innerText = "Mulai Scan Wajah";
    spinnerEl.classList.add('hidden');
}

// --- 4. FORM PERIZINAN LOGIC ---
document.getElementById('form-izin').addEventListener('submit', (e) => {
    e.preventDefault();
    const btnSubmit = e.target.querySelector('button');
    btnSubmit.innerText = "Mengirim...";

    const payload = {
        type: 'izin',
        nama: document.getElementById('izin-nama').value,
        nim: document.getElementById('izin-nim').value,
        prodi: document.getElementById('izin-prodi').value,
        alasan: document.getElementById('izin-alasan').value,
    };

    fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify(payload)
    }).then(res => res.json()).then(data => {
        if(data.status === 'success') {
            alert("Perizinan berhasil dikirim!");
            document.getElementById('form-izin').reset();
            btnSubmit.innerText = "Kirim Perizinan";
        }
    });
});