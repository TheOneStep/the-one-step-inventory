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
          <div class="store-left">
            <span class="store-name">🏬 ${storeName}</span>
            <button
              class="btn-edit"
              data-store="${escapeAttr(store.storeName)}"
            >수정</button>
          </div>

          <div class="store-right">
            <div class="row">
              납품 총액 <span class="money">${delivery.toLocaleString()}원</span>
            </div>
            <div class="row">
              수금 금액 <span class="money green">${paid.toLocaleString()}원</span>
            </div>
            <div class="row">
              미수금 <span class="money red">${unpaid.toLocaleString()}원</span>
            </div>
            ${store.returnNote ? `
              <div class="return-note">반품 ${escapeHtml(store.returnNote)}</div>
            ` : ``}
          </div>
        </div>

        ${store.storeMemo ? `
          <div class="store-memo">
            메모: ${escapeHtml(store.storeMemo)}
          </div>
        ` : ``}

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

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".edit-store");
    if (!btn) return;

    const oldStoreName = btn.dataset.store;
    const newStoreName = prompt("거래처명을 수정하세요", oldStoreName);
    if (!newStoreName) return;

    const newPaid = prompt("수금 금액을 입력하세요 (숫자)", "");
    if (newPaid === null) return;

    const paidValue = Number(newPaid.replace(/,/g,"")) || 0;

    // 🔥 sales_list 직접 수정
    let changed = false;
    let first = true;

    sales.forEach(s => {
      if ((s.partner || s.storeName || "") === oldStoreName) {
        s.partner = newStoreName;

        if (first) {
          s.paid = paidValue; // ✅ 딱 한 번만 저장
          first = false;
        } else {
          s.paid = 0;         // ✅ 나머지는 0
        }

        changed = true;
      }
    });

    if (!changed) {
      alert("수정할 데이터가 없습니다.");
      return;
    }

    localStorage.setItem("sales_list", JSON.stringify(sales));

    // 🔁 재계산 후 다시 렌더
    storeData = buildStoreSummary(sales, avgCostMap);
    renderStoreView();

    alert("거래처 정보가 수정되었습니다.");
  });

  function renderStoreRows(store) {
    const items = Object.values(store.items || {});
    if (items.length === 0) {
      return `<div class="empty" style="padding:22px 0;">납품 내역이 없습니다.</div>`;
    }

    // 납품 수량 많은 순
    items.sort((a, b) => Number(b.qty || 0) - Number(a.qty || 0));

    let html = "";

    // 1️⃣ 상품 목록
    items.forEach(it => {
      const name = escapeHtml(it.productName || "-");
      const bc = escapeHtml(it.barcode || "-");
      const qty = Number(it.qty || 0);
      const amount = Math.round(Number(it.total || 0));
      const price = qty > 0 ? Math.round(amount / qty) : 0;
      const memo = (it.memo || "").trim();
      const memoId = `memo_${bc}_${Math.random().toString(36).slice(2,8)}`;

      html += `
        <div class="store-row">
          <div class="pname">${name}</div>
          <div class="pcode">${bc}</div>

          <div class="pqty">
            가격 ${price.toLocaleString()}원 ·
            납품 ${qty.toLocaleString()}개 ·
            납품금액 ${amount.toLocaleString()}원
          </div>

          ${memo ? (() => {
            const lines = memo.split("\n").filter(l => l.trim()).length;
            const needToggle = lines >= 2;

            return `
              <div
                id="${memoId}"
                class="product-memo ${needToggle ? "collapsed" : ""}"
                style="
                  white-space: pre-wrap;
                  font-size:12px;
                  color:#666;
                  margin-top:6px;
                "
              >
                ${escapeHtml(memo)}
              </div>

              ${needToggle ? `
                <div
                  class="memo-toggle"
                  data-target="${memoId}"
                  style="
                    font-size:12px;
                    color:#007aff;
                    margin-top:4px;
                    cursor:pointer;
                    user-select:none;
                  "
                >
                  더보기
                </div>
              ` : ``}
            `;
          })() : ``}
        </div>
      `;
    });

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
    const toggle = e.target.closest(".memo-toggle");
    if (!toggle) return;

    const targetId = toggle.dataset.target;
    const memoBox = document.getElementById(targetId);
    if (!memoBox) return;

    const collapsed = memoBox.classList.toggle("collapsed");
    toggle.textContent = collapsed ? "더보기" : "접기";
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
    const memo = (s.memo || "").trim();
    const storeMemo = (s.storeMemo || "").trim();
    const returnNote = (s.returnNote || "").trim();
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

        deliveryTotal: 0,
        paidTotal: 0,

        // ✅ 거래처 기준 메모
        storeMemo: "",
        returnNote: "",

        items: {}
      };
    }
    // ✅ 납품 금액 누적
    stores[store].deliveryTotal += total;
    // ✅ 수금 금액 누적

      stores[store].paidTotal += paid;
    // ✅ 약국 메모(storeMemo) 누적
    if (storeMemo) {
      if (!stores[store].storeMemo.includes(storeMemo)) {
        stores[store].storeMemo +=
          (stores[store].storeMemo ? "\n" : "") + storeMemo;
      }
    }

    // ✅ 반품 메모(returnNote) 누적
    if (returnNote) {
      if (!stores[store].returnNote.includes(returnNote)) {
        stores[store].returnNote +=
          (stores[store].returnNote ? "\n" : "") + returnNote;
      }
    }

    // 아이템 묶기
    if (!stores[store].items[barcode]) {
      stores[store].items[barcode] = {
        productName: name,
        barcode,
        qty: 0,
        total: 0,
        paid: 0,
        memo: ""
        
      };
    }
    stores[store].items[barcode].qty += qty;
    stores[store].items[barcode].total += total;
    stores[store].items[barcode].paid += paid;
    if (memo) {
      const current = stores[store].items[barcode].memo;
      const lines = current ? current.split("\n") : [];

      if (!lines.includes(memo)) {
        stores[store].items[barcode].memo =
          current ? current + "\n" + memo : memo;
      }
    }
  });

  // 잔고 큰 순
  return Object.values(stores).sort(
    (a, b) => (b.deliveryTotal - b.paidTotal) - (a.deliveryTotal - a.paidTotal)
  );
}
