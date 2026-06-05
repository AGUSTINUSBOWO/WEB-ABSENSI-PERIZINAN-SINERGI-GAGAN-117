const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwYxD4LdYf9WGF7jsRetYC5fgNuw_vmX4KiYLLRDaEu_cl_6ZX9LTP7IJKYOzHkOOkgRw/exec'; 
const databaseAnggota = [
    "Agustinus Wahyu Wibowo_124230028_Sistem Informasi.jpg",
    "Aldi Ardianto_134230121_Agroteknologi.jpg",
    "Cintya Laura Riyanto_153230222_Ilmu Komunikasi.jpg",
    "Gea Sheila Regita Paramita_143230157_Ekonomi Pembangunan.jpg",
    "Lailatul Karimah_135230052_Agribisnis.jpg",
    "Muhammad Azzam Afif_142230351_Akuntansi.jpg",
    "Puspita Wati Hapsari_ 141230647_Manajemen.jpg",
    "Reina Anggraeni Tsany_121230190_Teknik Kimia (S1).jpg",
    "Stefanie Nadya Kusumaningrum_112220176_Teknik Pertambangan.jpg",
    "Taqy Athaya Dzakwan Mungin_113230211_Teknik Perminyakan.jpg"
];

let loadedFaceDescriptors = [];
let isDatabaseReady = false; 

// --- 1. SINKRONISASI INITIALIZATION & SPLASH SCREEN ---
document.addEventListener("DOMContentLoaded", async () => {
    try {
        console.log("1. Memuat Model AI Inti...");
        await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri('./models'),
            faceapi.nets.faceLandmark68Net.loadFromUri('./models'),
            faceapi.nets.faceRecognitionNet.loadFromUri('./models')
        ]);
        console.log("Model AI Berhasil Dimuat.");

        // LANGSUNG HILANGKAN SPLASH SCREEN
        setTimeout(() => {
            document.getElementById('splash-screen').classList.add('fade-out');
            const mainContent = document.getElementById('main-content');
            mainContent.classList.remove('hidden');
            mainContent.classList.add('fade-in');
        }, 1000); 

        // Jalankan pemrosesan foto di latar belakang
        loadReferenceImagesInBackground();

    } catch (error) {
        console.error("Inisialisasi Gagal:", error);
        alert("Gagal memuat file sistem utama. Periksa koneksi internet.");
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
        alert("Gagal mengakses kamera. Pastikan izin kamera diberikan saat pop-up muncul.");
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

// --- 3. BACKGROUND FACE RECOGNITION LOGIC ---
async function loadReferenceImagesInBackground() {
    console.log("2. Memproses Database Gambar di Latar Belakang...");
    const btnScan = document.getElementById('btn-scan');
    const scanText = document.getElementById('scan-text');
    let successCount = 0;

    btnScan.disabled = true;
    btnScan.classList.add('opacity-60', 'cursor-not-allowed');
    scanText.innerText = "Mempersiapkan AI Wajah...";

    for (const filename of databaseAnggota) {
        try {
            // Menggunakan ./ agar konsisten dengan folder models
            const path = encodeURI(`./database_wajah/${filename}`);
            const img = await faceapi.fetchImage(path);
            const detections = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
            
            if (detections) {
                const labelData = filename.replace('.jpg', '').replace('.jpeg', '').replace('.png', '');
                loadedFaceDescriptors.push(new faceapi.LabeledFaceDescriptors(labelData, [detections.descriptor]));
                successCount++;
                console.log(`✅ Berhasil mendata wajah: ${filename}`);
                scanText.innerText = `Memproses AI (${successCount}/${databaseAnggota.length})...`;
            } else {
                console.warn(`⚠️ Wajah tidak terdeteksi di dalam file foto: ${filename}`);
            }
        } catch (e) {
            console.error(`❌ Gagal memuat file foto: ${filename}`, e);
        }
    }
    
    console.log(`Selesai mendata wajah. Berhasil mendaftarkan ${successCount} dari ${databaseAnggota.length} anggota.`);
    
    if (successCount > 0) {
        isDatabaseReady = true;
        btnScan.disabled = false;
        btnScan.classList.remove('opacity-60', 'cursor-not-allowed');
        scanText.innerText = "Mulai Scan Wajah";
    } else {
        isDatabaseReady = false;
        scanText.innerText = "Database Wajah Gagal Dimuat";
        btnScan.disabled = true;
    }
}

document.getElementById('btn-scan').addEventListener('click', async () => {
    if(!isDatabaseReady) return; 

    const statusText = document.getElementById('status-absen');
    const btnText = document.getElementById('scan-text');
    const spinner = document.getElementById('scan-spinner');
    
    statusText.innerText = "Mendeteksi wajah dan lokasi...";
    statusText.className = "mt-3 text-sm font-semibold text-center text-blue-600";
    btnText.innerText = "Memproses...";
    spinner.classList.remove('hidden');

    navigator.geolocation.getCurrentPosition(async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        let lokasi = `${lat}, ${lng}`; 

        try {
            statusText.innerText = "Menerjemahkan lokasi koordinat...";
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
            const data = await response.json();
            if (data && data.display_name) { lokasi = data.display_name; }
        } catch (error) {
            console.warn("Gagal mengambil alamat teks.", error);
        }

        statusText.innerText = "Mencocokkan wajah kamera...";

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        const imageBase64 = canvas.toDataURL('image/jpeg', 0.8);

        const detection = await faceapi.detectSingleFace(video).withFaceLandmarks().withFaceDescriptor();

        if (!detection) {
            resetButton(statusText, btnText, spinner, "Wajah tidak terdeteksi oleh kamera. Coba terang/tegakkan wajah.", "text-red-600");
            return;
        }

        const faceMatcher = new faceapi.FaceMatcher(loadedFaceDescriptors, 0.6); 
        const match = faceMatcher.findBestMatch(detection.descriptor);

        if (match.label === "unknown") {
            resetButton(statusText, btnText, spinner, "Wajah tidak dikenali di database KKN.", "text-red-600");
            return;
        }

        const [nama, nim, prodi] = match.label.split('_');
        statusText.innerText = `Halo ${nama.trim()}! Mengirim data ke server...`;

        fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'absen',
                nama: nama.trim(),
                nim: nim.trim(),
                prodi: prodi.trim(),
                lokasi: lokasi,
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
        resetButton(statusText, btnText, spinner, "Gagal mendapatkan lokasi GPS. Izinkan akses lokasi di pengaturan browser.", "text-red-600");
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
            alert("Data perizinan berhasil direkam ke dalam sistem!");
            document.getElementById('form-izin').reset();
            btnSubmit.innerText = "Kirim Perizinan";
        }
    });
});