// 📦 상품 마스터 (바코드 → 마지막 입력 상품 정보 기억)

(function () {

  const STORAGE_KEY = "product_master";

  function load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) {
      console.error("ProductMaster load error", e);
      return {};
    }
  }

  function save(map) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  }

  window.ProductMaster = {
    get(barcode) {
      if (!barcode) return null;
      const map = load();
      return map[barcode] || null;
    },

    set(barcode, data) {
      if (!barcode || !data) return;
      const map = load();
      map[barcode] = {
        name: data.name || "",
        price: Number(data.price) || 0
      };
      save(map);
    }
  };

  console.log("✅ ProductMaster loaded");

})();
