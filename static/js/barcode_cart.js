// ===============================
// 📦 Barcode Cart Engine (공통)
// ===============================

const barcodeCart = {
  items: [],

  // 바코드 기준 중복 누적
  add(item) {
    const idx = this.items.findIndex(i => i.barcode === item.barcode);
    if (idx !== -1) {
      this.items[idx].qty += item.qty;
    } else {
      this.items.push({ ...item });
    }
    this.render();
  },

  remove(barcode) {
    this.items = this.items.filter(i => i.barcode !== barcode);
    this.render();
  },

  clear() {
    this.items = [];
    this.render();
  },

  getItems() {
    return this.items;
  },

  render() {
    const box = document.getElementById("cart-list");
    if (!box) return;

    box.innerHTML = "";

    if (this.items.length === 0) {
      box.innerHTML = `<div style="color:#777; text-align:center;">추가된 상품 없음</div>`;
      return;
    }

    this.items.forEach(item => {
      const row = document.createElement("div");
      row.style.borderBottom = "1px solid #eee";
      row.style.padding = "6px 0";

      row.innerHTML = `
        <div><b>${item.name}</b></div>
        <div style="font-size:13px;">
          ${item.qty}개 × ${item.price.toLocaleString()}원
        </div>
        <button data-barcode="${item.barcode}" style="margin-top:4px;">삭제</button>
      `;

      row.querySelector("button").onclick = () => {
        this.remove(item.barcode);
      };

      box.appendChild(row);
    });
  }
};
