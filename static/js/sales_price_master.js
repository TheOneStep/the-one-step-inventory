// 📦 납품 가격 마스터
// 기준: 거래처 + 바코드
// 용도: 납품 화면에서 "이 거래처에 이 상품을 얼마에 납품했는지" 기억
// ⚠️ 매입 가격과 완전 분리

(function () {

  const STORAGE_KEY = "sales_price_master";

  function load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) {
      console.error("SalesPriceMaster load error", e);
      return {};
    }
  }

  function save(map) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  }

  function makeKey(storeName, barcode) {
    if (!storeName || !barcode) return null;
    return `${storeName.trim()}|${barcode}`;
  }

  window.SalesPriceMaster = {

    /**
     * 거래처 + 바코드 기준 가격 조회
     * @param {string} storeName
     * @param {string} barcode
     * @returns {number|null}
     */
    get(storeName, barcode) {
      const key = makeKey(storeName, barcode);
      if (!key) return null;

      const map = load();
      const row = map[key];
      if (!row) return null;

      return Number(row.price) || null;
    },

    /**
     * 납품 가격 저장 (전체 등록 시 호출)
     * @param {string} storeName
     * @param {string} barcode
     * @param {number} price
     */
    set(storeName, barcode, price) {
      const key = makeKey(storeName, barcode);
      if (!key) return;
      const p = Number(String(price).replace(/,/g, ""));
      if (isNaN(p) || p <= 0) return;

      price = p;

      const map = load();

      map[key] = {
        price: Number(price),
        lastUsedAt: new Date().toISOString()
      };

      save(map);
    },

    /**
     * (선택) 디버깅용: 전체 데이터 확인
     */
    _dump() {
      return load();
    }
  };

  console.log("✅ SalesPriceMaster loaded");

})();
