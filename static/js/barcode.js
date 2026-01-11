const resultSpan = document.getElementById("barcode-value");
const btnStart = document.getElementById("btnStart");
const btnStop = document.getElementById("btnStop");
const cameraSelect = document.getElementById("cameraSelect");

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const isAndroid = /Android/.test(navigator.userAgent);

let html5QrCode = null;
let scanLocked = false;

/* =========================
   공통: 스캔 성공
========================= */
function onScanSuccess(text) {
  if (scanLocked) return;
  scanLocked = true;

  console.log("SCAN SUCCESS:", text);
  resultSpan.textContent = text;
  localStorage.setItem("last_barcode", text);

  // 스캔 즉시 종료 (모바일 안정)
  setTimeout(stopScan, 300);
}

function onScanFailure(_) {
  // 일부러 아무것도 안 함 (로그만)
}

/* =========================
   카메라 시작 (분기 처리)
========================= */
async function startScan() {
  scanLocked = false;

  if (!html5QrCode) {
    html5QrCode = new Html5Qrcode("reader");
  }

  const config = {
    fps: 10,
    qrbox: { width: 260, height: 160 }
  };

  if (isIOS) {
    // 🍎 iOS 전용 (가장 안정적인 방식)
    await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" }
    });

    await html5QrCode.start(
      { facingMode: "environment" }, // ❗ exact 쓰지 마
      config,
      onScanSuccess,
      onScanFailure
    );

  } else {
    // 🤖 Android / PC
    const cameras = await Html5Qrcode.getCameras();
    if (!cameras.length) throw new Error("No camera");

    cameraSelect.innerHTML = "";
    cameras.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.label || "Camera";
      cameraSelect.appendChild(opt);
    });

    await html5QrCode.start(
      cameras[0].id,
      config,
      onScanSuccess,
      onScanFailure
    );
  }

  btnStart.disabled = true;
  btnStop.disabled = false;
}

/* =========================
   스캔 중지
========================= */
async function stopScan() {
  if (!html5QrCode) return;

  try {
    if (html5QrCode.isScanning) {
      await html5QrCode.stop();
      await html5QrCode.clear();
    }
  } catch (_) {}

  btnStart.disabled = false;
  btnStop.disabled = true;
}

/* =========================
   버튼 이벤트
========================= */
btnStart.addEventListener("click", async () => {
  try {
    await startScan();
  } catch (e) {
    console.error(e);
    resultSpan.textContent = "카메라 인식 실패";
  }
});

btnStop.addEventListener("click", stopScan);

// ================================
// 공통 거래 데이터 정규화 (READ ONLY)
// ================================
function normalizeDeal(item) {
  const price = Number(String(item.price || 0).replace(/,/g, "")) || 0;
  const qty   = Number(String(item.qty || 0).replace(/,/g, "")) || 0;

  let total = Number(String(item.total || "").replace(/,/g, ""));
  if (!total) {
    total = price * qty;
  }

  return {
    ...item,
    price,
    qty,
    total
  };
}