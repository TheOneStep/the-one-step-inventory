// 🔥 반드시 파일 최상단 (DOMContentLoaded 위)
let editingStoreName = null;
let editingItemStore = null;
let editingItemBarcode = null;
document.addEventListener("DOMContentLoaded", () => {
  // =========================
  // 0) DOM (이 파일이 의존하는 id)
  // =========================
  const tabProduct = document.getElementById("tab-product");
  const tabStore = document.getElementById("tab-store");
  const searchLabel = document.getElementById("search-label");
  const searchInput = document.getElementById("search-input");
  const btnClear = document.getElementById("btn-clear");
  const listBox = document.getElementById("list-box");
  const emptyBox = document.getElementById("empty");

  if (!tabProduct || !tabStore || !searchLabel || !searchInput || !btnClear || !listBox || !emptyBox) {
    alert("필수 DOM 누락: stock_list.html의 id가 변경되었거나 일부가 없습니다.");
    return;
  }

  // =========================
  // 1) 데이터 로드
  // =========================
  const purchases = safeJSON(localStorage.getItem("purchase_list"));
  const sales = safeJSON(localStorage.getItem("sales_list"));
  const hiddenList = JSON.parse(localStorage.getItem("product_hidden_list") || "[]");

  const btnExcel = document.getElementById("btn-excel");

  // 상품 재고 계산(매입 - 납품)
  const stockList = calculateStock([
    ...purchases.map(p => ({ ...p, type: "매입" })),
    ...sales.map(s => ({ ...s, type: "매출" }))
  ]);

  // 재고 0인데 숨김 등록된 상품은 제외(단, 재고가 다시 생기면 보여줌)
  const visibleStockList = stockList.filter(item => {
    if (Number(item.qty || 0) > 0) return true;
    return !hiddenList.includes(item.barcode);
  });

  // 거래처(매장) 요약
  const avgCostMap = buildAvgCostMap(purchases);
  let storeData = buildStoreSummary(sales, avgCostMap);

  // =========================
  // 2) 상태
  // =========================
  let viewMode = "product"; // product | store

  // =========================
  // 3) 렌더
  // =========================
  function setEmpty(text) {
    listBox.innerHTML = "";
    emptyBox.textContent = text || "표시할 데이터가 없습니다.";
    emptyBox.style.display = "block";
  }

  function clearEmpty() {
    emptyBox.style.display = "none";
  }

  function keyword() {
    return (searchInput.value || "").trim().toLowerCase();
  }

  function renderProductView() {
    clearEmpty();
    listBox.innerHTML = "";

    const kw = keyword();
    const filtered = !kw
      ? visibleStockList
      : visibleStockList.filter(i => {
          const name = (i.productName || "").toLowerCase();
          const bc = (i.barcode || "").toLowerCase();
          return name.includes(kw) || bc.includes(kw);
        });

    if (!filtered || filtered.length === 0) {
      setEmpty("표시할 상품이 없습니다.");
      return;
    }

    filtered.forEach(item => {
      const qty = Number(item.qty || 0);

      // 배지(재고 위험도)
      let badgeClass = "";
      let badgeText = `${qty.toLocaleString()}개`;

      if (qty <= 5) {
        badgeClass = "low";
        badgeText = `부족 ${qty.toLocaleString()}개`;
      } else if (qty < 10) {
        badgeClass = "warn";
        badgeText = `주의 ${qty.toLocaleString()}개`;
      }

      const card = document.createElement("div");
      card.className = "card";

      const title = escapeHtml(item.productName || "-");
      const bc = escapeHtml(item.barcode || "-");

      const hideBtn = qty === 0
        ? `<button class="mini danger" type="button" data-action="hide" data-barcode="${escapeAttr(item.barcode || "")}">숨김</button>`
        : "";

      card.innerHTML = `
        <div class="card-top">
          <div>
            <div class="card-title">${title}</div>
            <div class="card-meta">바코드: ${bc}</div>
          </div>
          <div class="badge ${badgeClass}">${badgeText}</div>
        </div>
        ${qty === 0 ? `<div class="row-actions">${hideBtn}</div>` : ""}
      `;

      listBox.appendChild(card);
    });
  }

  function renderStoreView() {
    clearEmpty();
    listBox.innerHTML = "";

    const kw = keyword();
    const targetList = !kw
      ? storeData
      : storeData.filter(s => (s.storeName || "").toLowerCase().includes(kw));

    if (!targetList || targetList.length === 0) {
      setEmpty("표시할 거래처가 없습니다.");
      return;
    }

    targetList.forEach(store => {
      const card = document.createElement("div");
      card.className = "card";

      const storeName = escapeHtml(store.storeName || "-");
      const delivery = Math.round(store.deliveryTotal || 0);
      const paid = Math.round(store.paidTotal || 0);
      const unpaid = delivery - paid;
      

      card.innerHTML = `
        <div class="store-head" data-action="toggle">
          <div class="store-name">🏬 ${storeName}</div>
          <div class="store-right">
            <div>납품 총액 <span class="money">${delivery.toLocaleString()}원</span></div>
            <div>수금 금액 <span class="money green">${paid.toLocaleString()}원</span></div>
            <div>미수금 <span class="money red">${unpaid.toLocaleString()}원</span></div>
          </div>
        </div>
        <div class="store-body">
          ${renderStoreRows(store)}
        </div>
      `;

      // 토글
      const head = card.querySelector(".store-head");
      const body = card.querySelector(".store-body");
      if (head && body) {
        head.addEventListener("click", () => {
          body.style.display = body.style.display === "block" ? "none" : "block";
        });
      }

      listBox.appendChild(card);
    });
  }

  function renderStoreRows(store) {
    const items = Object.values(store.items || {});
    if (!items.length) {
      return `<div class="empty" style="padding:22px 0;">납품 내역이 없습니다.</div>`;
    }

    // 납품 수량 많은 순
    items.sort((a, b) => Number(b.qty || 0) - Number(a.qty || 0));

    let html = "";

    // =========================
    // 1️⃣ 상품 리스트
    // =========================
    items.forEach(it => {
      const name = escapeHtml(it.productName || "-");
      const bc = escapeHtml(it.barcode || "-");
      const qty = Number(it.qty || 0);
      const price = qty > 0 ? Math.round(it.total / qty) : 0;
      const total = Math.round(it.total || 0);

      html += `
        <div class="store-row">
          <div class="pname">${name}</div>
          <div class="pcode">${bc}</div>
          <div class="pqty">
            수량 ${qty.toLocaleString()}개 ·
            단가 ${price.toLocaleString()}원 ·
            총액 ${total.toLocaleString()}원
          </div>

          ${it.memos && it.memos.length ? `
            <div class="pcode">
              메모:
              <ul style="margin:4px 0 0 14px; padding:0;">
                ${it.memos.map(m => `<li>${escapeHtml(m)}</li>`).join("")}
              </ul>
            </div>
          ` : ""}

          <div style="margin-top:8px;">
            <button
              class="mini edit"
              type="button"
              data-action="edit-item"
              data-store="${escapeAttr(store.storeName)}"
              data-barcode="${escapeAttr(it.barcode)}"
            >
              상품 수정
            </button>
          </div>
        </div>
      `;
    });

    // =========================
    // 2️⃣ 거래처 정보 + 수정 버튼
    // =========================
    html += `
      <div style="margin-top:16px; padding-top:14px; border-top:1px solid #eee;">
        <div style="font-size:13px; margin-bottom:6px;">
          반품: ${store.returnNote ? escapeHtml(store.returnNote) : "-"}
        </div>
        ${store.storeMemo ? `
          <div style="font-size:13px; margin-bottom:10px;">
            메모: ${escapeHtml(store.storeMemo)}
          </div>
        ` : ""}
        <button
          class="mini edit"
          type="button"
          data-action="edit-store"
          data-store="${escapeAttr(store.storeName)}"
        >
          수정
        </button>
      </div>
    `;

    return html;
  }

  // =========================
  // 4) 이벤트
  // =========================
  function setMode(mode) {
    viewMode = mode;

    // 탭 UI
    if (mode === "product") {
      tabProduct.classList.add("active");
      tabStore.classList.remove("active");
      searchLabel.textContent = "상품명 또는 바코드 검색";
      searchInput.placeholder = "상품명 또는 바코드를 입력하세요";
      renderProductView();
    } else {
      tabStore.classList.add("active");
      tabProduct.classList.remove("active");
      searchLabel.textContent = "거래처명 검색";
      searchInput.placeholder = "거래처명을 입력하세요";
      // 데이터는 화면 진입 시 재생성(수정/삭제 반영)
      storeData = buildStoreSummary(sales, avgCostMap);
      renderStoreView();
    }
  }

  btnExcel.addEventListener("click", () => {
    if (viewMode === "product") {
      downloadProductExcel();
    } else {
      downloadStoreExcel();
    }
  });

  function downloadProductExcel(){
    if(!visibleStockList.length){
      alert("내보낼 상품 재고가 없습니다.");
      return;
    }

    let csv = "\uFEFF상품명,바코드,재고수량\n";
    visibleStockList.forEach(i=>{
      csv += `${i.productName},${i.barcode},${i.qty}\n`;
    });

    downloadCSV(csv, "stock_product_list.csv");
  }

  function downloadStoreExcel(){
    if(!storeData.length){
      alert("내보낼 거래처 데이터가 없습니다.");
      return;
    }

    let csv = "\uFEFF거래처,상품명,바코드,납품수량,납품금액,수금액,잔고\n";

    storeData.forEach(store=>{
      Object.values(store.items).forEach(it=>{
        const balance = (it.total||0) - (it.paid||0);
        csv += `${store.storeName},${it.productName},${it.barcode},${it.qty},${it.total},${it.paid},${balance}\n`;
      });
    });

    downloadCSV(csv, "stock_store_list.csv");
  }

  function downloadCSV(csv, filename){
    const blob = new Blob([csv], { type:"text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // =========================
  // 🧾 거래처 수정 버튼 클릭
  // =========================

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action='edit-store']");
    if (!btn) return;

    editingStoreName = btn.dataset.store;

    const sales = safeJSON(localStorage.getItem("sales_list"));
    const target = sales.find(s => (s.partner || "") === editingStoreName);
    if (!target) {
      alert("거래처 데이터를 찾을 수 없습니다.");
      return;
    }

    document.getElementById("edit-store-name").value = editingStoreName;
    document.getElementById("edit-paid").value = target.paid || "";
    document.getElementById("edit-return").value = target.returnNote || "";
    document.getElementById("edit-memo").value = target.storeMemo || "";

    storeEditModal.style.display = "flex";
  });

  tabProduct.addEventListener("click", () => setMode("product"));
  tabStore.addEventListener("click", () => setMode("store"));

  searchInput.addEventListener("input", () => {
    if (viewMode === "product") renderProductView();
    else renderStoreView();
  });

  btnClear.addEventListener("click", () => {
    searchInput.value = "";
    if (viewMode === "product") renderProductView();
    else renderStoreView();
  });

  // 상품 숨김 버튼(재고 0만 제공)
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action='hide']");
    if (!btn) return;
    const bc = btn.getAttribute("data-barcode") || "";
    if (!bc) return;

    const list = JSON.parse(localStorage.getItem("product_hidden_list") || "[]");
    if (!list.includes(bc)) list.push(bc);
    localStorage.setItem("product_hidden_list", JSON.stringify(list));
    location.reload();
  });

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action='edit-item']");
    if (!btn) return;

    editingItemStore = btn.dataset.store;
    editingItemBarcode = btn.dataset.barcode;

    const sales = safeJSON(localStorage.getItem("sales_list"));

    const target = sales.find(
      s => (s.partner || "") === editingItemStore && s.barcode === editingItemBarcode
    );

    if (!target) {
      alert("상품 데이터를 찾을 수 없습니다.");
      return;
    }

    document.getElementById("edit-item-name").value = target.productName || "";
    document.getElementById("edit-item-qty").value = target.qty || "";
    document.getElementById("edit-item-price").value = target.price || "";
    document.getElementById("edit-item-memo").value = target.memo || "";

    itemEditModal.style.display = "flex";
  });

  // =========================
  // 5) 초기 화면
  // =========================
  setMode("product");
});

// =========================
// 유틸
// =========================
function safeJSON(raw) {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(str) {
  // 속성값에만 쓸 최소 치환
  return String(str).replaceAll('"', "&quot;");
}

// =========================
// 📦 재고 계산 (단일 기준)
// =========================
function calculateStock(list) {
  const map = {};

  list.forEach(item => {
    const barcode = item.barcode;
    if (!barcode) return;

    if (!map[barcode]) {
      map[barcode] = {
        barcode,
        productName: item.productName || item.name || "",
        inQty: 0,
        outQty: 0,
        qty: 0
      };
    }

    const qty = Number(item.qty || 0);
    if (item.type === "매입") map[barcode].inQty += qty;
    if (item.type === "매출") map[barcode].outQty += qty;

    map[barcode].qty = map[barcode].inQty - map[barcode].outQty;
  });

  // 재고 많은 순
  return Object.values(map).sort((a, b) => Number(b.qty || 0) - Number(a.qty || 0));
}

// =========================
// 💰 평균 원가 맵: barcode -> avgCost
// =========================
function buildAvgCostMap(purchases) {
  const map = {};
  purchases.forEach(p => {
    const barcode = p.barcode;
    if (!barcode) return;
    const qty = Number(p.qty || 0);
    const total = Number(
      (p.total !== undefined && p.total !== null)
        ? p.total
        : (Number(p.price || 0) * qty)
    );
    if (!map[barcode]) map[barcode] = { qty: 0, total: 0 };
    map[barcode].qty += qty;
    map[barcode].total += total;
  });

  const avg = {};
  Object.keys(map).forEach(bc => {
    avg[bc] = map[bc].qty > 0 ? (map[bc].total / map[bc].qty) : 0;
  });
  return avg;
}

// =========================
// 🏪 거래처별 요약
// - sales_list(납품)을 거래처로 묶어서
//   잔고 = 납품총액 - 수금총액
//   손익 = 납품총액 - (납품수량 * 평균원가)
// =========================
function buildStoreSummary(sales, avgCostMap) {
  const stores = {};

  sales.forEach(s => {
    const store = (s.partner || s.storeName || s.customer || "").trim();
    if (!store) return;

    const barcode = s.barcode || "";
    const name = s.productName || s.name || "-";
    const qty = Number(s.qty || 0);
    const total = Number(
      (s.total !== undefined && s.total !== null)
        ? s.total
        : (Number(s.price || 0) * qty)
    );
    const paid = Number(
      (s.paid !== undefined && s.paid !== null)
        ? s.paid
        : (s.receivedAmount !== undefined && s.receivedAmount !== null)
          ? s.receivedAmount
          : 0
    );

    if (!stores[store]) {
      stores[store] = {
        storeName: store,

        // 🔽 새 기준
        deliveryTotal: 0, // 납품 금액 (가격 × 수량)
        paidTotal: 0,     // 수금 금액
        items: {}
      };
    }
    // ✅ 납품 금액 누적
    stores[store].deliveryTotal += total;
    // ✅ 수금 금액 누적
    stores[store].paidTotal += paid;

    // 아이템 묶기
    if (!stores[store].items[barcode]) {
      stores[store].items[barcode] = {
        productName: name,
        barcode,
        qty: 0,
        total: 0,
        paid: 0,
        memos: []   // 🔥 상품별 메모 누적
      };
    }
    stores[store].items[barcode].qty += qty;
    stores[store].items[barcode].total += total;
    stores[store].items[barcode].paid += paid;
    if (s.memo) {
      stores[store].items[barcode].memos.push(s.memo);
    }
  });

  // 잔고 큰 순
  return Object.values(stores).sort(
    (a, b) => (b.deliveryTotal - b.paidTotal) - (a.deliveryTotal - a.paidTotal)
  );
}
// =========================
// 🧾 거래처 수정 모달
// =========================
const storeEditModal = document.createElement("div");
storeEditModal.style.cssText = `
  position:fixed;
  inset:0;
  background:rgba(0,0,0,.35);
  display:none;
  align-items:center;
  justify-content:center;
  z-index:9999;
`;
storeEditModal.innerHTML = `
  <div style="
    width:90%;
    max-width:360px;
    background:#fff;
    border-radius:16px;
    padding:18px;
  ">
    <h3 style="margin:0 0 12px; text-align:center;">거래처 수정</h3>

    <div class="field">
      <label>거래처명</label>
      <input id="edit-store-name" />
    </div>

    <div class="field">
      <label>수금액</label>
      <input id="edit-paid" inputmode="numeric" />
    </div>

    <div class="field">
      <label>반품</label>
      <input id="edit-return" />
    </div>

    <div class="field">
      <label>메모</label>
      <textarea id="edit-memo"></textarea>
    </div>

    <button id="btn-store-save" class="btn btn-blue">저장</button>
    <button id="btn-store-cancel" class="btn btn-gray">취소</button>
  </div>
`;

// =========================
// 📦 상품 수정 모달
// =========================
const itemEditModal = document.createElement("div");
itemEditModal.style.cssText = `
  position:fixed;
  inset:0;
  background:rgba(0,0,0,.35);
  display:none;
  align-items:center;
  justify-content:center;
  z-index:10000;
`;
itemEditModal.innerHTML = `
  <div style="
    width:90%;
    max-width:360px;
    background:#fff;
    border-radius:16px;
    padding:18px;
  ">
    <h3 style="margin:0 0 12px; text-align:center;">상품 수정</h3>

    <div class="field">
      <label>상품명</label>
      <input id="edit-item-name" />
    </div>

    <div class="field">
      <label>수량</label>
      <input id="edit-item-qty" inputmode="numeric" />
    </div>

    <div class="field">
      <label>단가</label>
      <input id="edit-item-price" inputmode="numeric" />
    </div>

    <div class="field">
      <label>메모</label>
      <textarea id="edit-item-memo"></textarea>
    </div>

    <button id="btn-item-save" class="btn btn-blue">저장</button>
    <button id="btn-item-cancel" class="btn btn-gray">취소</button>
  </div>
`;
document.getElementById("btn-item-save").addEventListener("click", () => {
  const name = document.getElementById("edit-item-name").value.trim();
  const qty = Number(document.getElementById("edit-item-qty").value);
  const price = Number(document.getElementById("edit-item-price").value);
  const memo = document.getElementById("edit-item-memo").value.trim();

  if (!name || qty <= 0 || price < 0) {
    alert("상품명, 수량, 단가를 올바르게 입력하세요.");
    return;
  }

  const sales = safeJSON(localStorage.getItem("sales_list"));

  sales.forEach(s => {
    if (
      (s.partner || "") === editingItemStore &&
      s.barcode === editingItemBarcode
    ) {
      s.productName = name;
      s.qty = qty;
      s.price = price;
      s.memo = memo;
      s.total = qty * price;
    }
  });

  localStorage.setItem("sales_list", JSON.stringify(sales));

  editingItemStore = null;
  editingItemBarcode = null;
  itemEditModal.style.display = "none";

  location.reload();
});
document.getElementById("btn-item-cancel").addEventListener("click", () => {
  itemEditModal.style.display = "none";
  editingItemStore = null;
  editingItemBarcode = null;
});
document.body.appendChild(itemEditModal);
document.body.appendChild(storeEditModal);

document.getElementById("btn-store-save").addEventListener("click", () => {
  const newName = document.getElementById("edit-store-name").value.trim();
  const paid = Number(
    String(document.getElementById("edit-paid").value).replace(/,/g,"")
  ) || 0;
  const returnNote = document.getElementById("edit-return").value.trim();
  const memo = document.getElementById("edit-memo").value.trim();

  if (!newName) {
    alert("거래처명은 필수입니다.");
    return;
  }

  const sales = safeJSON(localStorage.getItem("sales_list"));

  sales.forEach(s => {
    if ((s.partner || "") === editingStoreName) {
      s.partner = newName;
      s.paid = paid;
      s.returnNote = returnNote;
      s.storeMemo = memo;
    }
  });

  localStorage.setItem("sales_list", JSON.stringify(sales));

  editingStoreName = null;
  storeEditModal.style.display = "none";

  location.reload(); // 즉시 반영
});

document.getElementById("btn-store-cancel").addEventListener("click", () => {
  storeEditModal.style.display = "none";
  editingStoreName = null;
});