// iOS barcode scanning integration using html5-qrcode.
// This module defines an initialization function that can be invoked on iOS
// devices to enable scanning in a similar manner to the Android implementation.

console.log("IOS JS LOADED");

// Define an initializer on the global object so that the hosting page can call
// `initBarcodeIOS()` when needed (e.g. after the script finishes loading).
window.initBarcodeIOS = function () {
  const btnStart = document.getElementById("btnStart");
  const resultSpan = document.getElementById("barcode-value");
  const wrapper = document.getElementById("scan-wrapper");
  let html5QrCode = null;
  let scanning = false;

  // Reset the scanner and hide the video when scanning is complete.
  function handleScanComplete(code) {
    scanning = false;
    // Update the displayed barcode value.
    resultSpan.textContent = code;
    // Pause the scanner (pause is recommended over stop on iOS).
    if (html5QrCode) {
      try {
        html5QrCode.pause(true);
      } catch (e) {
        console.warn("Error pausing scanner:", e);
      }
    }
    // Hide the scanning UI.
    if (wrapper) wrapper.style.display = "none";
  }

  // Success callback passed to html5-qrcode library.
  function onScanSuccess(decodedText /* decodedText */, decodedResult) {
    if (!scanning) return;
    console.log("IOS SCAN:", decodedText);
    handleScanComplete(decodedText);
  }

  // Start scanning when the user taps the scan button.
  btnStart.onclick = async () => {
    if (scanning) return;
    scanning = true;
    // Reset the result display before scanning.
    resultSpan.textContent = "없음";
    if (wrapper) wrapper.style.display = "block";

    // If a previous scanner exists, try to pause/stop it first.
    if (html5QrCode) {
      try {
        html5QrCode.stop();
      } catch (e) {
        // ignore if stop isn't available or fails
      }
    }

    html5QrCode = new Html5Qrcode("reader");
    try {
      // Configure supported barcode formats for Html5Qrcode. This improves
      // recognition performance on linear codes used in retail (EAN, UPC, CODE).
      const formats = [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E
      ];
      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: 250,
          formatsToSupport: formats,
          // Use native BarcodeDetector if available on the platform for better performance.
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true
          }
        },
        onScanSuccess,
        (errorMessage) => {
          // Scan failure callback; ignore continuous errors.
          console.debug("Scan error:", errorMessage);
        }
      );
    } catch (err) {
      console.error("Failed to start iOS scanner:", err);
      scanning = false;
      if (wrapper) wrapper.style.display = "none";
    }
  };
};