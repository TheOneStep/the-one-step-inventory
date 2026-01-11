document.addEventListener("DOMContentLoaded", () => {
  // =========================
  // 0) 상태값 (period + anchor + timeline visible)
  // =========================
  let currentPeriod = localStorage.getItem("dashboard_period") || "day";
  let anchorISO = localStorage.getItem("dashboard_anchor") || todayISO();
  let timelineVisible = localStorage.getItem("dashboard_timeline_visible");
  timelineVisible = timelineVisible === null ? true : (timelineVisible === "1");

  // ✅ 미래 anchor 방지 (현재보다 미래면 오늘로)
  if (toDate(anchorISO).getTime() > toDate(todayISO()).getTime()) {
    anchorISO = todayISO();
    localStorage.setItem("dashboard_anchor", anchorISO);
  }

  // =========================
  // 1) 데이터 로드
  // =========================
  const purchases = safeJSON(localStorage.getItem("purchase_list"));
  const sales = safeJSON(localStorage.getItem("sales_list"));

  // =========================
  // 2) DOM
  // =========================
  const periodButtons = document.querySelectorAll(".period-btn");
  const timelineEl = document.getElementById("timeline");

  const elPurchase = document.getElementById("kpi-purchase");
  const elSale = document.getElementById("kpi-sale");
  const elProfit = document.getElementById("kpi-profit");
  const elCount = document.getElementById("kpi-count");
  const elBaseTime = document.getElementById("base-time");

  const top5Container = document.getElementById("top5-sale");

  // =========================
  // 3) 유틸
  // =========================
  function safeJSON(raw) {
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
  }

  function pad2(n) { return String(n).padStart(2, "0"); }

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function toDate(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return new Date("2000-01-01");
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function fmtBaseText() {
    const now = new Date();
    return `기준: ${anchorISO.replaceAll("-", ".")} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  }

  function getAmount(item) {
    const price = Number(String(item.price).replace(/,/g, "")) || 0;
    const qty = Number(String(item.qty).replace(/,/g, "")) || 0;
    return price * qty;
  }

  function getKoreanWeekday(d) {
    return ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  }

  // =========================
  // 🔹 해당 기간에 거래 데이터 존재 여부
  // =========================
  function hasDataForISO(iso) {
    const target = toDate(iso);

    for (const p of purchases) {
      if (!p.purchaseDate) continue;
      const d = toDate(p.purchaseDate);
      if (d.getTime() === target.getTime()) return true;
    }

    for (const s of sales) {
      if (!s.saleDate) continue;
      const d = toDate(s.saleDate);
      if (d.getTime() === target.getTime()) return true;
    }

    return false;
  }

  // =========================
  // 4) 기간 판단 (anchor 기준)
  // =========================
  function isInPeriod(dateStr, period) {
    if (!dateStr) return false;

    const target = new Date(dateStr);
    if (isNaN(target)) return false;
    target.setHours(0, 0, 0, 0);

    const anchor = toDate(anchorISO);

    if (period === "day") {
      return target.getTime() === anchor.getTime();
    }

    if (period === "week") {
      // ✅ 월요일 시작
      const start = new Date(anchor);
      const day = start.getDay(); // 0=일 ... 1=월
      const diffToMon = (day === 0) ? -6 : (1 - day);
      start.setDate(start.getDate() + diffToMon);
      start.setHours(0, 0, 0, 0);

      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);

      return target >= start && target <= end;
    }

    if (period === "month") {
      return target.getFullYear() === anchor.getFullYear() &&
             target.getMonth() === anchor.getMonth();
    }

    return true;
  }

  function sameMonthAnchor(monthISO) {
    return anchorISO.slice(0, 7) === monthISO.slice(0, 7);
  }

  function sameWeekAnchor(weekMonISO) {
    const a = toDate(anchorISO);
    const day = a.getDay();
    const diffToMon = (day === 0) ? -6 : (1 - day);
    a.setDate(a.getDate() + diffToMon);
    const aMonISO = `${a.getFullYear()}-${pad2(a.getMonth() + 1)}-${pad2(a.getDate())}`;
    return aMonISO === weekMonISO;
  }

  // =========================
  // 🔹 해당 "주(월요일 기준)"에 데이터 존재 여부
  // =========================
  function hasDataForWeek(weekMonISO) {
    const start = toDate(weekMonISO);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    for (const p of purchases) {
      if (!p.purchaseDate) continue;
      const d = toDate(p.purchaseDate);
      if (d >= start && d <= end) return true;
    }

    for (const s of sales) {
      if (!s.saleDate) continue;
      const d = toDate(s.saleDate);
      if (d >= start && d <= end) return true;
    }

    return false;
  }

  // =========================
  // 🔹 해당 "월"에 데이터 존재 여부
  // =========================
  function hasDataForMonth(monthISO) {
    // monthISO: YYYY-MM-01
    const start = toDate(monthISO);
    const end = new Date(start);
    end.setMonth(start.getMonth() + 1);
    end.setDate(0); // 말일
    end.setHours(23, 59, 59, 999);

    for (const p of purchases) {
      if (!p.purchaseDate) continue;
      const d = toDate(p.purchaseDate);
      if (d >= start && d <= end) return true;
    }

    for (const s of sales) {
      if (!s.saleDate) continue;
      const d = toDate(s.saleDate);
      if (d >= start && d <= end) return true;
    }

    return false;
  }

  // =========================
  // 5) KPI 렌더
  // =========================
  function renderKPI() {
    let sumPurchase = 0;
    let sumSale = 0;
    let count = 0;

    purchases.forEach(item => {
      if (!isInPeriod(item.purchaseDate, currentPeriod)) return;
      sumPurchase += getAmount(item);
      count++;
    });

    sales.forEach(item => {
      if (!isInPeriod(item.saleDate, currentPeriod)) return;
      sumSale += getAmount(item);
      count++;
    });

    const profit = sumSale - sumPurchase;

    if (elPurchase) elPurchase.textContent = `${sumPurchase.toLocaleString()}원`;
    if (elSale) elSale.textContent = `${sumSale.toLocaleString()}원`;

    if (elProfit) {
      elProfit.textContent = `${profit.toLocaleString()}원`;
      elProfit.className = "value " + (profit >= 0 ? "profit" : "loss");
    }

    if (elCount) elCount.textContent = `${count}건`;
    if (elBaseTime) elBaseTime.textContent = fmtBaseText();
  }

  // =========================
  // 6) Top5 (매출만 / ✅ 건수 기준 / 이름+건수+금액)
  // =========================
  function calcTop5Sales() {
    const map = {};

    sales.forEach(item => {
      if (!isInPeriod(item.saleDate, currentPeriod)) return;

      const name = item.productName || "(상품명 없음)";
      const amount = getAmount(item);

      if (!map[name]) map[name] = { count: 0, amount: 0 };
      map[name].count += 1;
      map[name].amount += amount;
    });

    return Object.entries(map)
      .sort((a, b) => b[1].count - a[1].count) // ✅ 건수 기준
      .slice(0, 5);
  }

  function renderTop5Sales() {
    if (!top5Container) return;

    const data = calcTop5Sales();
    top5Container.innerHTML = "";

    if (data.length === 0) {
      top5Container.innerHTML = `
        <div style="
          grid-column: 1 / -1;
          text-align: center;
          padding: 24px 0;
          color: #999;
          font-size: 14px;
        ">
          매출 데이터 없음
        </div>
      `;
      return;
    }

    data.forEach((row, idx) => {
      const name = row[0];
      const cnt = row[1].count;
      const amt = row[1].amount;

      const card = document.createElement("div");
      card.className = "top5-card";
      card.innerHTML = `
        <div class="top5-rank">${idx + 1}위</div>
        <div class="top5-name">${name}</div>
        <div style="font-size:12px; color:#777; margin-top:4px;">
          <b>${cnt}건</b> · ${amt.toLocaleString()}원
        </div>
      `;
      top5Container.appendChild(card);
    });
  }

  // =========================
  // 7) 기간 버튼 UI + 동작
  // =========================
  function applyPeriodUI() {
    periodButtons.forEach(btn => {
      btn.classList.remove("active");
      if (btn.dataset.period === currentPeriod) btn.classList.add("active");
    });
  }

  periodButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const nextPeriod = btn.dataset.period;

      // ✅ 같은 버튼 다시 클릭하면 타임라인만 토글 (사라졌다/나왔다)
      if (nextPeriod === currentPeriod) {
        timelineVisible = !timelineVisible;
        localStorage.setItem("dashboard_timeline_visible", timelineVisible ? "1" : "0");
        renderTimeline(true);
        return;
      }

      // ✅ 다른 기간으로 변경
      currentPeriod = nextPeriod;
      localStorage.setItem("dashboard_period", currentPeriod);

      // ✅ 기간 변경 시 anchor는 "그 기간에 맞게" 유지하려면 그대로 두고,
      // 혹시 미래면 오늘로만 보정
      if (toDate(anchorISO).getTime() > toDate(todayISO()).getTime()) {
        anchorISO = todayISO();
        localStorage.setItem("dashboard_anchor", anchorISO);
      }

      timelineVisible = true;
      localStorage.setItem("dashboard_timeline_visible", "1");

      applyPeriodUI();
      renderTimeline(true);
      renderAll();
    });
  });

  // =========================
  // 8) 타임라인 렌더 (과거 -> 오늘, 오른쪽이 오늘)
  // =========================
  function renderTimeline(scrollToActive = false) {
    if (!timelineEl) return;

    if (!timelineVisible) {
      timelineEl.innerHTML = "";
      timelineEl.style.display = "none";
      return;
    }

    timelineEl.style.display = "flex";
    timelineEl.innerHTML = "";

    const now = toDate(todayISO());

    if (currentPeriod === "day") {
      // 최근 14일: 과거 -> 오늘 (오른쪽이 오늘)
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);

        const iso = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

        const item = document.createElement("div");
        const hasData = hasDataForISO(iso);

        item.className =
          "ti day" +
          (hasData ? " has-data" : "") +
          (iso === anchorISO ? " active" : "");
        item.innerHTML = `
          <div class="d">${d.getDate()}</div>
          <div class="w">${getKoreanWeekday(d)}</div>
        `;

        item.addEventListener("click", () => {
          anchorISO = iso;
          localStorage.setItem("dashboard_anchor", anchorISO);
          renderTimeline(true);
          renderAll();
        });

        timelineEl.appendChild(item);
      }

    } else if (currentPeriod === "week") {
      // 최근 12주, 월요일만 표시
      const base = new Date(now);
      const day = base.getDay();
      const diffToMon = (day === 0) ? -6 : (1 - day);
      base.setDate(base.getDate() + diffToMon);
      base.setHours(0, 0, 0, 0);

      for (let i = 11; i >= 0; i--) {
        const d = new Date(base);
        d.setDate(base.getDate() - (i * 7));

        const iso = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

        const item = document.createElement("div");
        const hasData = hasDataForWeek(iso);

        item.className =
          "ti week" +
          (hasData ? " has-data" : "") +
          (sameWeekAnchor(iso) ? " active" : "");
        item.innerHTML = `
          <div class="d">${d.getMonth() + 1}.${d.getDate()}</div>
          <div class="w">월</div>
        `;

        item.addEventListener("click", () => {
          anchorISO = iso; // 그 주의 월요일
          localStorage.setItem("dashboard_anchor", anchorISO);
          renderTimeline(true);
          renderAll();
        });

        timelineEl.appendChild(item);
      }

    } else if (currentPeriod === "month") {
      // 최근 12개월
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now);
        d.setMonth(now.getMonth() - i);
        d.setDate(1);

        const iso = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`;

        const item = document.createElement("div");
        const hasData = hasDataForMonth(iso);

        item.className =
          "ti month" +
          (hasData ? " has-data" : "") +
          (sameMonthAnchor(iso) ? " active" : "");
        item.innerHTML = `
          <div class="d">${d.getMonth() + 1}월</div>
          <div class="w">${String(d.getFullYear()).slice(2)}년</div>
        `;

        item.addEventListener("click", () => {
          anchorISO = iso;
          localStorage.setItem("dashboard_anchor", anchorISO);
          renderTimeline(true);
          renderAll();
        });

        timelineEl.appendChild(item);
      }
    }

    // ✅ 새로고침/클릭 후에도 “선택된 칸”이 화면 중앙에 오도록
    if (scrollToActive) {
      requestAnimationFrame(() => {
        const active = timelineEl.querySelector(".ti.active");
        if (active) {
          active.scrollIntoView({ behavior: "auto", inline: "center", block: "nearest" });
        } else {
          // active가 없으면 오른쪽(오늘) 쪽으로
          timelineEl.scrollLeft = timelineEl.scrollWidth;
        }
      });
    }
  }

  // =========================
  // 9) 전체 렌더
  // =========================
  function renderAll() {
    renderKPI();
    renderTop5Sales();
  }

  // =========================
  // 10) 초기 실행 (✅ 새로고침 시 선택 위치 고정)
  // =========================
  applyPeriodUI();
  renderTimeline(true); // ⭐ 무조건 active 위치로 스크롤
  renderAll();
});

 // =========================
// 🔗 페이지 이동
// =========================

function goPurchase() {
  location.href = "view/barcode/purchase_barcode.html";
}

function goSale() {
  location.href = "view/barcode/sales_barcode.html";
}

function goList() {
  location.href = "view/barcode/purchase_list.html";
}
