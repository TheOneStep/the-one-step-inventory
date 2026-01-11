// static/js/barcode_ios.js
// ✅ iOS Safari 전용 바코드 스캔 (html5-qrcode)
// 핵심: "버튼 클릭" 안에서 시작 + display:none -> block 렌더링 2프레임 대기

(function () {
  let html5QrCode = null;
  let isRunning = false;

  function $(id) {
    return document.getElementById(id);
  }

  // iOS 렌더링 반영 대기 (display:none -> block 직후 바로 start 하면 iOS가 종종 실패함)
  function waitTwoFrames() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  }

  async function startScan() {
    const scanWrapper = $("scan-wrapper");
    const resultSpan = $("barcode-value");

    if (!scanWrapper) {
      alert("스캔 영역(scan-wrapper)을 찾을 수 없습니다.");
      return;
    }

    // ✅ 스캔 영역 표시
    scanWrapper.style.display = "block";

    // ✅ iOS Safari 버그 우회: 렌더링이 실제로 그려진 후 카메라 시작
    await waitTwoFrames();

    if (!html5QrCode) {
      html5QrCode = new Html5Qrcode("reader");
    }

    // 이미 실행 중이면 재실행 방지
    if (isRunning) return;

    try {
      isRunning = true;

      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 240, height: 120 },
          experimentalFeatures: { useBarCodeDetectorIfSupported: true }
        },
        async (decodedText) => {
          // ✅ 인식 성공
          if (resultSpan) resultSpan.textContent = decodedText;

          // ✅ 스캔 멈춤 (멈추지 않으면 카메라 계속 잡고 있어서 다음 동작 꼬일 수 있음)
          try {
            await html5QrCode.stop();
          } catch (e) {
            // stop 실패는 무시
          }
          isRunning = false;
        },
        (err) => {
          // 인식 실패 로그는 조용히 무시 (너무 많이 발생)
          // console.log(err);
        }
      );
    } catch (e) {
      isRunning = false;
      console.error(e);
      alert(
        "아이폰에서 카메라를 열 수 없습니다.\n" +
        "1) HTTPS 접속인지\n" +
        "2) Safari 카메라 권한이 허용인지\n" +
        "3) 다른 앱이 카메라를 사용 중인지 확인해 주세요."
      );
    }
  }

  // 외부에서 호출되는 초기화 함수
  window.initBarcodeIOS = function () {
    const btnStart = $("btnStart");
    if (!btnStart) {
      console.error("btnStart 버튼을 찾을 수 없습니다.");
      return;
    }

    // 중복 바인딩 방지: 한번만 연결
    if (btnStart.dataset.bound === "1") return;
    btnStart.dataset.bound = "1";

    // ✅ iOS는 반드시 "사용자 클릭" 이벤트 안에서 카메라 시작해야 함
    btnStart.addEventListener("click", startScan);
  };
})();
