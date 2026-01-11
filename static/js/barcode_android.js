window.initBarcodeAndroid = async function () {
  const btnStart = document.getElementById("btnStart");
  const reader = document.getElementById("reader");
  const form = document.getElementById("product-form");
  const resultSpan = document.getElementById("barcode-value");
  const inputBarcode = document.getElementById("input-barcode");

  if (!btnStart || !reader || !form || !inputBarcode || !resultSpan) {
    return;
  }

  // BarcodeDetector 지원 체크
  if (!("BarcodeDetector" in window)) {
    alert("이 기기는 바코드 스캔을 지원하지 않습니다.");
    return;
  }

  const detector = new BarcodeDetector({
    formats: [
      "ean_13",
      "ean_8",
      "code_128",
      "code_39",
      "upc_a",
      "upc_e"
    ]
  });

  let stream = null;
  let scanning = false;
  let lastCode = null;
  let sameCount = 0;
  const REQUIRED_COUNT = 4; // ⭐ 3~5 추천

  btnStart.onclick = async () => {
    if (scanning) return;

    lastCode = null;
    sameCount = 0;
    
    scanning = true;

    const wrapper = document.getElementById("scan-wrapper");
    wrapper.style.display = "block";

    // 카메라 시작
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" }
      }
    });

    reader.innerHTML = "";
    const video = document.createElement("video");
    video.setAttribute("playsinline", true);
    video.srcObject = stream;
    video.autoplay = true;
    reader.appendChild(video);

    const scanLoop = async () => {
      if (!scanning) return;

      try {
        const barcodes = await detector.detect(video);
        if (barcodes.length > 0) {
          const code = barcodes[0].rawValue;

          if (code === lastCode) {
            sameCount++;
          } else {
            lastCode = code;
            sameCount = 1;
          }

          console.log("DETECTED:", code, sameCount);

          // ⭐ 연속 인식 조건
          if (sameCount >= REQUIRED_COUNT) {
            console.log("CONFIRMED SCAN:", code);

            resultSpan.textContent = code;
            inputBarcode.value = code;

            scanning = false;
            stream.getTracks().forEach(t => t.stop());

            const wrapper = document.getElementById("scan-wrapper");
            wrapper.style.display = "none";

            form.style.display = "block";
            const topBtn = document.getElementById("btnGoListTop");
            if (topBtn) {
              topBtn.style.display = "none";
            }
            return;
          }
        }
      } catch (e) {
        console.error(e);
      }

      requestAnimationFrame(scanLoop);
    };

    requestAnimationFrame(scanLoop);
  };
};
