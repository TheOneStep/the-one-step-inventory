document.addEventListener("DOMContentLoaded", () => {
  const listBox = document.getElementById("list");
  const emptyBox = document.getElementById("empty");

  const purchaseRaw = localStorage.getItem("purchase_list");
  const salesRaw = localStorage.getItem("sales_list");

  const purchases = purchaseRaw ? JSON.parse(purchaseRaw) : [];
  const sales = salesRaw ? JSON.parse(salesRaw) : [];

  // 🔑 id 없는 기존 데이터 자동 보정 (삭제/수정 기준 통일)
  let changed = false;

  purchases.forEach(item => {
    if (!item.id) {
      item.id = "p_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
      changed = true;
    }
  });

  sales.forEach(item => {
    if (!item.id) {
      item.id = "s_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
      changed = true;
    }
  });

  if (changed) {
    localStorage.setItem("purchase_list", JSON.stringify(purchases));
    localStorage.setItem("sales_list", JSON.stringify(sales));
  }

  // 하나로 합침 (⚠️ 원본 수정 금지)
  const list = [
    ...purchases.map(item => ({ ...item, type: "매입" })),
    ...sales.map(item => ({ ...item, type: "매출" }))
  ];

  // 날짜 기준 정렬 (최신순)
  list.sort((a, b) => {
    const da = a.purchaseDate || a.saleDate;
    const db = b.purchaseDate || b.saleDate;
    return new Date(db) - new Date(da);
  });

  // 🔧 데이터 정규화 (기존 깨진 데이터 보정)
const normalizedList = list.map(item => normalizeDeal(item));

function calcSum(list) {
  return list.reduce((sum, item) => {
    if (item.type === "매출") return sum + item.total;
    if (item.type === "매입") return sum - item.total;
    return sum;
  }, 0);
}

function filterByDate(list, start, end) {
  return list.filter(item => {
    const d = new Date(item.purchaseDate || item.saleDate);
    return d >= start && d <= end;
  });
}

  let currentFilter = "all"; // all | month | today | date
  let rangeStart = "";
  let rangeEnd = "";
  let selectedMonth = "";
  let selectedDate = "";

  const todayStr = (() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  })();

  // ======================
// 🔁 조회 상태 저장 / 복원 (전역)
// ======================
function saveViewState() {
  const state = {
    currentFilter,
    rangeStart,
    rangeEnd,
    selectedMonth,
    keyword: document.getElementById("search-keyword")?.value || "",
    chkPurchase: document.getElementById("chk-purchase")?.checked ?? true,
    chkSale: document.getElementById("chk-sale")?.checked ?? true
  };

  localStorage.setItem("list_view_state", JSON.stringify(state));
}

function loadViewState() {
  const raw = localStorage.getItem("list_view_state");
  if (!raw) return;

  try {
    const state = JSON.parse(raw);

    currentFilter = state.currentFilter || "all";
    rangeStart = state.rangeStart || "";
    rangeEnd = state.rangeEnd || "";
    selectedMonth = state.selectedMonth || "";

    const keywordInput = document.getElementById("search-keyword");
    if (keywordInput) keywordInput.value = state.keyword || "";

    const chkPurchaseEl = document.getElementById("chk-purchase");
    const chkSaleEl = document.getElementById("chk-sale");

    if (chkPurchaseEl) chkPurchaseEl.checked = state.chkPurchase ?? true;
    if (chkSaleEl) chkSaleEl.checked = state.chkSale ?? true;

  } catch (e) {
    console.error("조회 상태 복원 실패", e);
  }
}

  function getFilteredList() {
    let result = [...normalizedList];

    if (currentFilter === "today") {
      result = result.filter(item => {
        const d = item.purchaseDate || item.saleDate;
        return d?.slice(0, 10) === todayStr;
      });

    } else if (currentFilter === "month" && selectedMonth) {
      result = result.filter(item => {
        const d = item.purchaseDate || item.saleDate;
        return d?.startsWith(selectedMonth);
      });

    } else if (currentFilter === "range" && rangeStart && rangeEnd) {
      const start = new Date(rangeStart);
      const end = new Date(rangeEnd);
      end.setHours(23, 59, 59, 999);

      result = result.filter(item => {
        const d = item.purchaseDate || item.saleDate;
        if (!d) return false;
        const dateObj = new Date(d);
        return dateObj >= start && dateObj <= end;
      });
    }

    // 🔍 키워드 검색
    const keyword = document.getElementById("search-keyword")?.value?.trim().toLowerCase();
    if (keyword) {
      result = result.filter(item => {
        return (
          (item.productName || item.name || "").toLowerCase().includes(keyword) ||
          (item.partner || "").toLowerCase().includes(keyword) ||
          (item.barcode || "").toLowerCase().includes(keyword)
        );
      });
    }
    

    // ✅ 체크박스 기본 true 처리 (없어도 전체 보이게)
    const chkPurchase = document.getElementById("chk-purchase")?.checked ?? true;
    const chkSale = document.getElementById("chk-sale")?.checked ?? true;

    result = result.filter(item => {
      if (item.type === "매입" && chkPurchase) return true;
      if (item.type === "매출" && chkSale) return true;
      return false;
    });

    // ⭐ 오름차순
    return result.sort((a, b) => {
      const da = new Date(a.purchaseDate || a.saleDate || 0);
      const db = new Date(b.purchaseDate || b.saleDate || 0);
      return da - db;
    });
  }


  function updateSummary(data) {
    const summaryBox = document.getElementById("today-summary");
    if (!summaryBox) return;

    let purchaseCount = 0;
    let saleCount = 0;
    let purchaseSum = 0;
    let saleSum = 0;

    data.forEach(item => {
      const amount = item.total ?? (item.price * item.qty);

      if (item.type === "매입") {
        purchaseCount++;
        purchaseSum += amount;
      }

      if (item.type === "매출") {
        saleCount++;
        saleSum += amount;
      }
    });

    const profit = saleSum - purchaseSum;

    summaryBox.innerHTML = `
    
      <div style="font-weight:bold; margin-bottom:8px;">
        현재 조회 요약
      </div>

      <div style="display:flex; gap:8px; margin-bottom:8px;">
        
        <div style="
          flex:1;
          padding:10px;
          border-radius:8px;
          background:#eef5ff;
          text-align:center;
        ">
          <div style="font-size:13px; color:#007aff;">매입</div>
          <div style="font-weight:bold;">
            ${purchaseCount}건
          </div>
          <div style="font-size:13px;">
            ${purchaseSum.toLocaleString()}원
          </div>
        </div>

        <div style="
          flex:1;
          padding:10px;
          border-radius:8px;
          background:#fff0f0;
          text-align:center;
        ">
          <div style="font-size:13px; color:#d64545;">매출</div>
          <div style="font-weight:bold;">
            ${saleCount}건
          </div>
          <div style="font-size:13px;">
            ${saleSum.toLocaleString()}원
          </div>
        </div>

      </div>

      <div style="
        text-align:center;
        font-weight:bold;
        color:${profit >= 0 ? "#0a7d00" : "#d64545"};
      ">
        손익: ${profit >= 0 ? "+" : ""}
        ${profit.toLocaleString()}원
      </div>
    `;
    
    summaryBox.style.display = "block";
  }

  function updateCurrentFilterLabel() {
    const box = document.getElementById("current-filter");
    if (!box) return;

    const labels = [];

    // 날짜 필터
    if (currentFilter === "today") {
      labels.push("오늘");

    } else if (currentFilter === "month" && selectedMonth) {
      labels.push(`월(${selectedMonth})`);

    } else if (currentFilter === "range" && rangeStart && rangeEnd) {
      labels.push(`기간(${rangeStart} ~ ${rangeEnd})`);
    }

    // 키워드
    const keyword = document.getElementById("search-keyword")?.value?.trim();
    if (keyword) {
      labels.push(`키워드(${keyword})`);
    }

    // 매입 / 매출
    const chkPurchase = document.getElementById("chk-purchase")?.checked ?? true;
    const chkSale = document.getElementById("chk-sale")?.checked ?? true;

    if (chkPurchase && chkSale) {
      labels.push("매입·매출");
    } else if (chkPurchase) {
      labels.push("매입");
    } else if (chkSale) {
      labels.push("매출");
    }

    if (labels.length === 0) {
      box.style.display = "none";
      return;
    }

    box.innerHTML = `조회 조건: <b>${labels.join(" · ")}</b>`;
    box.style.display = "block";
  }

  document.addEventListener("click", e => {
    const btn = e.target.closest(".delete-btn");
    if (!btn) return;

    const id = btn.dataset.id;
    const type = btn.dataset.type;

    if (!id || !type) {
      alert("삭제 대상 정보가 없습니다.");
      return;
    }

    if (!confirm("정말 삭제하시겠습니까?")) return;

    if (type === "매입") {
      const purchaseList = JSON.parse(localStorage.getItem("purchase_list") || "[]");
      const idx = purchaseList.findIndex(i => i.id === id);
      if (idx !== -1) {
        purchaseList.splice(idx, 1);
        localStorage.setItem("purchase_list", JSON.stringify(purchaseList));
      }
    }

    if (type === "매출") {
      const salesList = JSON.parse(localStorage.getItem("sales_list") || "[]");
      const idx = salesList.findIndex(i => i.id === id);
      if (idx !== -1) {
        salesList.splice(idx, 1);
        localStorage.setItem("sales_list", JSON.stringify(salesList));
      }
    }

    // 🔄 안전한 전체 리프레시 (모든 상태 정상 복구)
    location.reload();
  });

  // ======================
  // 리스트 렌더링
  // ======================
  function renderList(data) {
    listBox.innerHTML = "";

    if (data.length === 0) {
      emptyBox.style.display = "block";
      return;
    }

    emptyBox.style.display = "none";

    data.forEach((item, index) => {
      const div = document.createElement("div");
      div.className = "item";
      div.style.background =
        item.type === "매입" ? "#eef5ff" : "#fff0f0";

      const date = item.purchaseDate || item.saleDate;

      div.innerHTML = `
        <div style="display:flex; justify-content:space-between;">
          <b>${item.type}</b>
          <button type="button"
                  class="delete-btn"
                  data-id="${item.id}"
                  data-type="${item.type}">
            삭제
          </button>
        </div>

        <div>날짜: ${date || "-"}</div>
        <div>바코드: ${item.barcode || "-"}</div>

        ${
          item.type === "매출"
            ? `<div>거래처: ${item.partner || item.customer || "-"}</div>`
            : ""
        }

        <div>상품명: ${item.productName || item.name || "-"}</div>

        <div>단가: ${(item.price ?? 0).toLocaleString()}원</div>
        <div>수량: ${(item.qty ?? 0).toLocaleString()}개</div>

        <div style="font-weight:bold; color:${item.type === "매입" ? "#007aff" : "#d64545"};">
          총액: ${(item.total ?? 0).toLocaleString()}원
        </div>

        ${
          item.type === "매출"
            ? `
              <div>수금액: ${(item.paid ?? item.receivedAmount ?? 0).toLocaleString()}원</div>
              <div>잔고: ${((item.total ?? 0) - (item.paid ?? item.receivedAmount ?? 0)).toLocaleString()}원</div>
            `
            : ""
        }

        ${item.memo ? `
        <div style="
          margin-top:6px;
          padding:6px 8px;
          font-size:13px;
          background:#f7f7f7;
          border-radius:6px;
          color:#444;
        ">
          📝 메모: ${item.memo}
        </div>
        ` : ""}
      `;

        div.addEventListener("click", (e) => {
          // 🔒 삭제 버튼 클릭이면 카드 이동 막기
          if (e.target.closest(".delete-btn")) return;

          location.href = "deal_view.html?id=" + item.id;
        });

      listBox.appendChild(div);
    });
      
  }


  // ======================
  // 초기 렌더
  // ======================
  loadViewState(); // ⭐ 먼저 상태 복원

  const initData = getFilteredList();
  renderList(initData);
  updateSummary(initData);

  // ======================
  // 필터 버튼
  // ======================
  document.getElementById("filter-all").onclick = () => {
    currentFilter = "all";
    saveViewState();
    const data = getFilteredList();
    renderList(data);
    updateSummary(data);
    updateCurrentFilterLabel(); // ⭐ 추가
  };

  // 월 버튼 → 월 선택 UI 토글
  document.getElementById("filter-month").onclick = () => {
    const box = document.getElementById("month-box");
    box.style.display = box.style.display === "none" ? "block" : "none";
  };

  // 월 선택 시 → 해당 월 조회
  const monthPicker = document.getElementById("month-picker");
  if (monthPicker) {
    monthPicker.addEventListener("input", () => {
      if (!monthPicker.value) return;
      selectedMonth = monthPicker.value;
      currentFilter = "month";
      saveViewState();
      const data = getFilteredList();
      renderList(data);
      updateSummary(data);
    });
  }

  // 오늘
  document.getElementById("filter-today").onclick = () => {
    currentFilter = "today";
    saveViewState();
    const data = getFilteredList();
    renderList(data);
    updateSummary(data);
    updateCurrentFilterLabel(); // ⭐ 추가
  };

  // ======================
  // 기간 검색 적용 (⭐ 여기)
  // ======================
  document.getElementById("filter-range").onclick = () => {
    rangeStart = document.getElementById("range-start").value;
    rangeEnd = document.getElementById("range-end").value;

    if (!rangeStart || !rangeEnd) {
      alert("시작일과 종료일을 모두 선택하세요");
      return;
    }

    currentFilter = "range";
    saveViewState();
    const data = getFilteredList();
    renderList(data);
    updateSummary(data);
    updateCurrentFilterLabel(); // ⭐ 추가
  };

   // ======================
  // 🔍 검색 버튼 / 엔터 / 초기화
  // ======================
  const searchInput = document.getElementById("search-keyword");

  document.getElementById("btn-search").onclick = () => {
    saveViewState();
    const data = getFilteredList();
    renderList(data);
    updateSummary(data);
    updateCurrentFilterLabel(); // ⭐ 추가
  };

  document.getElementById("btn-reset").onclick = () => {
    // 검색 초기화
    document.getElementById("search-keyword").value = "";
    document.getElementById("chk-purchase").checked = true;
    document.getElementById("chk-sale").checked = true;

    currentFilter = "all";
    rangeStart = "";
    rangeEnd = "";
    selectedMonth = "";

    saveViewState();
    const data = getFilteredList();
    renderList(data);
    updateSummary(data);
  };

  // 엔터키 검색
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      saveViewState();
      const data = getFilteredList();
      renderList(data);
      updateSummary(data);
    }

   
  });
  // ======================
  // ⬇ 엑셀(CSV) 내보내기
  // ======================
  const btnStock = document.getElementById("btn-stock");

  if (btnStock) {
    btnStock.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();   // ⭐ 이게 핵심
      location.href = "stock_list.html";
    });
  }

  const exportBtn = document.getElementById("btn-export-excel");
  if (exportBtn) {
    exportBtn.onclick = () => {
      // 엑셀 다운로드 로직
    };
  }

  

  document.getElementById("btn-export-excel").onclick = () => {
    
    const data = getFilteredList();

    if (!data || data.length === 0) {
      alert("내보낼 데이터가 없습니다.");
      return;
    }

    const headers = [
      "구분",
      "날짜",
      "상품명",
      "바코드",
      "거래처",
      "단가",
      "수량",
      "총액",
      "수금액",
      "잔고",
      "메모"
    ];

    const rows = data.map(item => {
      const total = item.total || 0;
      const received = item.receivedAmount || 0;

      return [
        item.type,
        item.purchaseDate || item.saleDate || "",
        item.productName || item.name || "",
        item.barcode || "",
        item.partner || item.customer || "",
        item.price || 0,
        item.qty || 0,
        total,
        received,
        total - received,
        item.memo || ""
      ];
    });

    const csvContent =
      "\uFEFF" +
      [headers, ...rows]
        .map(row =>
          row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")
        )
        .join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");

    a.href = url;
    a.download = `거래목록_${yyyy}-${mm}-${dd}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }; 

});

function normalizeDeal(item) {
  const price = Number(String(item.price).replace(/,/g, "")) || 0;
  const qty   = Number(String(item.qty).replace(/,/g, "")) || 0;
  const total = price * qty;
  const receivedAmount = Number(item.paid ?? item.receivedAmount) || 0;

  return {
    ...item,
    price,
    qty,
    total,
    receivedAmount
  };
}

// ======================
// 📦 재고 계산
// ======================
function calculateStock(list) {
  const stockMap = {};

  list.forEach(item => {
    const key = item.barcode || item.productName || item.name;
    if (!key) return;

    if (!stockMap[key]) {
      stockMap[key] = {
        barcode: item.barcode || "",
        productName: item.productName || item.name || "",
        qty: 0
      };
    }

    if (item.type === "매입") {
      stockMap[key].qty += item.qty;
    }

    if (item.type === "매출") {
      stockMap[key].qty -= item.qty;
    }
  });

  // 재고가 0 이상인 것만 반환
  return Object.values(stockMap).filter(item => item.qty > 0);
}



