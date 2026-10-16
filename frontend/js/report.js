/* =========================================================
   YUGEM REPORTS — LIVE DATA
   Connected with Yugem Flask Backend
   ========================================================= */

(function () {
  "use strict";

  /* =====================================================
       CONFIG
       ===================================================== */

  var CONFIG = {
    reportUrl: "/api/reports/summary",
    exportUrl: "/api/reports/export",
  };

  /* =====================================================
       ELEMENTS
       ===================================================== */

  var sidebar = document.getElementById("sidebar");
  var overlay = document.getElementById("sidebarOverlay");
  var menuToggle = document.getElementById("menuToggle");
  var logoutBtn = document.getElementById("logoutBtn");

  var presetRow = document.getElementById("presetRow");

  var rFrom = document.getElementById("rFrom");
  var rTo = document.getElementById("rTo");

  var applyBtn = document.getElementById("applyBtn");
  var resetBtn = document.getElementById("resetBtn");
  var exportBtn = document.getElementById("exportBtn");

  var sEntries = document.getElementById("sEntries");
  var sDeal = document.getElementById("sDeal");
  var sReceived = document.getElementById("sReceived");
  var sBalance = document.getElementById("sBalance");
  var sGst = document.getElementById("sGst");

  var gstCaption = document.getElementById("gstCaption");
  var generatedChip = document.getElementById("generatedChip");

  var byBde = document.getElementById("byBde");
  var byBdeTotals = document.getElementById("byBdeTotals");

  var byService = document.getElementById("byService");
  var byStatus = document.getElementById("byStatus");

  var toastStack = document.getElementById("toastStack");

  var appliedFrom = "";
  var appliedTo = "";

  /* =====================================================
       SAFETY CHECK
       ===================================================== */

  if (!byBde || !byService || !byStatus) {
    console.error("Report page elements are missing.");
    return;
  }

  /* =====================================================
       HELPERS
       ===================================================== */

  function escapeHtml(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatMoney(value) {
    var number = Number(value || 0);

    if (!Number.isFinite(number)) {
      number = 0;
    }

    return (
      "₹" +
      number.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }

  function formatCount(value) {
    var number = Number(value || 0);

    if (!Number.isFinite(number)) {
      number = 0;
    }

    return number.toLocaleString("en-IN");
  }

  function formatDMY(iso) {
    if (!iso) {
      return "";
    }

    var value = String(iso).substring(0, 10);
    var parts = value.split("-");

    if (parts.length !== 3) {
      return value;
    }

    return parts[2] + "-" + parts[1] + "-" + parts[0];
  }

  function pad2(value) {
    return value < 10 ? "0" + value : String(value);
  }

  function isoOf(date) {
    return (
      date.getFullYear() +
      "-" +
      pad2(date.getMonth() + 1) +
      "-" +
      pad2(date.getDate())
    );
  }

  function addDays(date, days) {
    var result = new Date(date.getTime());

    result.setDate(result.getDate() + days);

    return result;
  }

  function statusClass(status) {
    var value = String(status || "")
      .trim()
      .toUpperCase();

    if (value === "PAID") {
      return "completed";
    }

    if (value === "PARTIAL" || value === "PENDING") {
      return "pending";
    }

    if (value === "CANCELLED" || value === "REJECTED") {
      return "cancelled";
    }

    return "default";
  }

  function toast(message, type) {
    if (!toastStack) {
      return;
    }

    var element = document.createElement("div");

    element.className = "toast" + (type ? " " + type : "");

    element.textContent = message;

    toastStack.appendChild(element);

    setTimeout(function () {
      element.style.transition = "opacity .3s ease, transform .3s ease";

      element.style.opacity = "0";
      element.style.transform = "translateY(10px)";

      setTimeout(function () {
        if (element.parentNode) {
          element.remove();
        }
      }, 320);
    }, 3200);
  }

  /* =====================================================
       COUNT UP ANIMATION
       ===================================================== */

  function animateValue(element, target, formatter) {
    if (!element) {
      return;
    }

    target = Number(target || 0);

    if (!Number.isFinite(target)) {
      target = 0;
    }

    var fromValue = Number(element.dataset.current || 0);

    if (!Number.isFinite(fromValue)) {
      fromValue = 0;
    }

    var start = null;
    var duration = 700;

    function frame(now) {
      if (start === null) {
        start = now;
      }

      var progress = Math.min((now - start) / duration, 1);

      var eased = 1 - Math.pow(1 - progress, 3);

      var value = fromValue + (target - fromValue) * eased;

      element.textContent = formatter(value);

      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        element.dataset.current = String(target);

        element.textContent = formatter(target);
      }
    }

    requestAnimationFrame(frame);
  }

  /* =====================================================
       SKELETON / EMPTY ROWS
       ===================================================== */

  function skeletonRows(columns) {
    var html = "";

    for (var row = 0; row < 4; row++) {
      html += "<tr>";

      for (var col = 0; col < columns; col++) {
        var width = 55 + ((row * 13 + col * 7) % 35);

        html +=
          "<td>" +
          '<div class="skeleton" style="width:' +
          width +
          '%"></div>' +
          "</td>";
      }

      html += "</tr>";
    }

    return html;
  }

  function messageRow(columns, icon, title, hint) {
    return (
      "<tr>" +
      '<td colspan="' +
      columns +
      '">' +
      '<div class="empty-state">' +
      '<div class="empty-state-icon">' +
      icon +
      "</div>" +
      "<h3>" +
      escapeHtml(title) +
      "</h3>" +
      "<p>" +
      escapeHtml(hint) +
      "</p>" +
      "</div>" +
      "</td>" +
      "</tr>"
    );
  }

  /* =====================================================
       PRESETS
       ===================================================== */

  function buildPresets(anchorIso) {
    var today = new Date(anchorIso + "T00:00:00");

    if (isNaN(today.getTime())) {
      today = new Date();
    }

    var yesterday = addDays(today, -1);

    var weekStart = addDays(today, -((today.getDay() + 6) % 7));

    var monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    var lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);

    var lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

    var fyStart;

    if (today.getMonth() + 1 >= 4) {
      fyStart = new Date(today.getFullYear(), 3, 1);
    } else {
      fyStart = new Date(today.getFullYear() - 1, 3, 1);
    }

    return [
      {
        label: "Today",
        from: isoOf(today),
        to: isoOf(today),
      },

      {
        label: "Yesterday",
        from: isoOf(yesterday),
        to: isoOf(yesterday),
      },

      {
        label: "This Week",
        from: isoOf(weekStart),
        to: isoOf(today),
      },

      {
        label: "This Month",
        from: isoOf(monthStart),
        to: isoOf(today),
      },

      {
        label: "Last Month",
        from: isoOf(lastMonthStart),
        to: isoOf(lastMonthEnd),
      },

      {
        label: "This FY",
        from: isoOf(fyStart),
        to: isoOf(today),
      },
    ];
  }
  function renderPresets(presets) {
    if (!presetRow) {
      return;
    }

    presetRow.innerHTML = "";

    presets.forEach(function (preset) {
      var button = document.createElement("button");

      button.type = "button";
      button.className = "preset-pill";
      button.textContent = preset.label;

      button.dataset.from = preset.from;
      button.dataset.to = preset.to;

      button.addEventListener("click", function () {
        if (rFrom) {
          rFrom.value = preset.from;
        }

        if (rTo) {
          rTo.value = preset.to;
        }

        appliedFrom = preset.from;
        appliedTo = preset.to;

        markActivePreset();

        loadReport();

        toast(preset.label + " preset applied — report updated.", "success");
      });

      presetRow.appendChild(button);
    });

    markActivePreset();
  }

  function markActivePreset() {
    if (!presetRow) {
      return;
    }

    var pills = presetRow.querySelectorAll(".preset-pill");

    pills.forEach(function (pill) {
      var active =
        appliedFrom !== "" &&
        pill.dataset.from === appliedFrom &&
        pill.dataset.to === appliedTo;

      pill.classList.toggle("active", active);
    });
  }

  /* =====================================================
       RENDER SUMMARY
       ===================================================== */

  function renderSummary(report) {
    report = report || {};

    /*
     * Backend currently returns:
     *
     * totals.entries
     * totals.deal
     * totals.received
     * totals.gst
     * totals.balance
     */

    var totals = report.totals || report.summary || {};

    var entries =
      totals.entries !== undefined ? totals.entries : totals.total_entries;

    var deal = totals.deal !== undefined ? totals.deal : totals.total_deal;

    var received =
      totals.received !== undefined ? totals.received : totals.received_amount;

    var balance =
      totals.balance !== undefined ? totals.balance : totals.balance_amount;

    var gst = totals.gst !== undefined ? totals.gst : totals.gst_amount;

    animateValue(sEntries, Number(entries || 0), formatCount);

    animateValue(sDeal, Number(deal || 0), formatMoney);

    animateValue(sReceived, Number(received || 0), formatMoney);

    animateValue(sBalance, Number(balance || 0), formatMoney);

    /*
     * GST card displays:
     * GST ₹0.00
     */

    animateValue(sGst, Number(gst || 0), function (value) {
      return "GST " + formatMoney(value);
    });

    if (gstCaption) {
      var count = Number(entries || 0);

      gstCaption.textContent =
        "Across " +
        formatCount(count) +
        " payment " +
        (count === 1 ? "entry" : "entries");
    }

    if (generatedChip) {
      var generated = report.generated_on || report.generated_at || "";

      if (generated) {
        generatedChip.textContent = "Generated on " + formatDMY(generated);

        generatedChip.hidden = false;
      } else {
        generatedChip.hidden = true;
      }
    }
  }

  /* =====================================================
       RENDER BDE
       ===================================================== */

  function renderBde(rows, state) {
    if (state === "loading") {
      if (byBde) {
        byBde.innerHTML = skeletonRows(5);
      }

      if (byBdeTotals) {
        byBdeTotals.style.display = "none";
      }

      return;
    }

    if (state === "error") {
      if (byBde) {
        byBde.innerHTML = messageRow(
          5,
          "⚠",
          "Unable to load report",
          "Please check the server connection.",
        );
      }

      if (byBdeTotals) {
        byBdeTotals.style.display = "none";
      }

      return;
    }

    if (!rows || !rows.length) {
      if (byBde) {
        byBde.innerHTML = messageRow(
          5,
          "▤",
          "No BDE performance rows found",
          "Try widening the selected date range.",
        );
      }

      if (byBdeTotals) {
        byBdeTotals.style.display = "none";
      }

      return;
    }

    var html = "";

    var totals = {
      entries: 0,
      deal: 0,
      received: 0,
      balance: 0,
    };

    rows.forEach(function (row) {
      var entries = Number(row.entries || row.count || 0);

      var deal = Number(row.total_deal || row.deal || 0);

      var received = Number(row.received_amount || row.received || 0);

      var balance = Number(row.balance_amount || row.balance || 0);

      totals.entries += entries;
      totals.deal += deal;
      totals.received += received;
      totals.balance += balance;

      html +=
        "<tr>" +
        '<td class="bde-name">' +
        escapeHtml(row.bde_name || row.name || "") +
        "</td>" +
        '<td class="num">' +
        formatCount(entries) +
        "</td>" +
        '<td class="num money-strong">' +
        formatMoney(deal) +
        "</td>" +
        '<td class="num received-val">' +
        formatMoney(received) +
        "</td>" +
        '<td class="num balance-val">' +
        formatMoney(balance) +
        "</td>" +
        "</tr>";
    });

    if (byBde) {
      byBde.innerHTML = html;
    }

    if (byBdeTotals) {
      byBdeTotals.style.display = "";

      byBdeTotals.innerHTML =
        '<tr class="total-row">' +
        "<td>Total</td>" +
        '<td class="num">' +
        formatCount(totals.entries) +
        "</td>" +
        '<td class="num">' +
        formatMoney(totals.deal) +
        "</td>" +
        '<td class="num">' +
        formatMoney(totals.received) +
        "</td>" +
        '<td class="num">' +
        formatMoney(totals.balance) +
        "</td>" +
        "</tr>";
    }
  }

  /* =====================================================
       RENDER SERVICE
       ===================================================== */

  function renderService(rows, state) {
    if (state === "loading") {
      byService.innerHTML = skeletonRows(2);

      return;
    }

    if (state === "error") {
      byService.innerHTML = messageRow(
        2,
        "⚠",
        "Unable to load report",
        "Please check the server connection.",
      );

      return;
    }

    if (!rows || !rows.length) {
      byService.innerHTML = messageRow(
        2,
        "▤",
        "No service entries found",
        "Try widening the selected date range.",
      );

      return;
    }

    var max = 1;

    rows.forEach(function (row) {
      var count = Number(row.count || row.entries || 0);

      if (count > max) {
        max = count;
      }
    });

    var html = "";

    rows.forEach(function (row) {
      var count = Number(row.count || row.entries || 0);

      var percent = Math.max(Math.round((count / max) * 100), 8);

      html +=
        "<tr>" +
        "<td>" +
        '<div class="service-cell">' +
        "<b>" +
        escapeHtml(row.service || row.service_name || row.name || "") +
        "</b>" +
        '<span class="service-bar">' +
        '<i style="width:' +
        percent +
        '%">' +
        "</i>" +
        "</span>" +
        "</div>" +
        "</td>" +
        '<td class="num money-strong">' +
        formatCount(count) +
        "</td>" +
        "</tr>";
    });

    byService.innerHTML = html;
  }

  /* =====================================================
       RENDER STATUS
       ===================================================== */

  function renderStatus(rows, state) {
    if (state === "loading") {
      byStatus.innerHTML = skeletonRows(2);

      return;
    }

    if (state === "error") {
      byStatus.innerHTML = messageRow(
        2,
        "⚠",
        "Unable to load report",
        "Please check the server connection.",
      );

      return;
    }

    if (!rows || !rows.length) {
      byStatus.innerHTML = messageRow(
        2,
        "▤",
        "No status entries found",
        "Try widening the selected date range.",
      );

      return;
    }

    var html = "";

    rows.forEach(function (row) {
      var status = row.name || row.status || "";

      var count = Number(row.count || row.entries || 0);

      html +=
        "<tr>" +
        "<td>" +
        '<span class="status-pill ' +
        statusClass(status) +
        '">' +
        escapeHtml(status) +
        "</span>" +
        "</td>" +
        '<td class="num money-strong">' +
        formatCount(count) +
        "</td>" +
        "</tr>";
    });

    byStatus.innerHTML = html;
  }

  /* =====================================================
       QUERY STRING
       ===================================================== */

  function queryString() {
    var parts = [];

    if (appliedFrom) {
      parts.push("from=" + encodeURIComponent(appliedFrom));
    }

    if (appliedTo) {
      parts.push("to=" + encodeURIComponent(appliedTo));
    }

    return parts.length ? "?" + parts.join("&") : "";
  }

  /* =====================================================
       LOAD REPORT
       ===================================================== */

  function loadReport() {
    renderBde(null, "loading");
    renderService(null, "loading");
    renderStatus(null, "loading");

    var url = CONFIG.reportUrl + queryString();

    console.log("Loading Yugem report:", url);

    fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    })
      .then(function (response) {
        return response.json().then(function (data) {
          if (!response.ok) {
            var message = data && (data.message || data.detail || data.error);

            throw new Error(message || "Unable to load report.");
          }

          if (data && data.status && data.status !== "success") {
            throw new Error(data.message || "Unable to load report.");
          }

          return data;
        });
      })

      .then(function (report) {
        console.log("Yugem report response:", report);

        /*
         * Backend response is:
         *
         * {
         *   status: "success",
         *   totals: {...},
         *   by_bde: [...],
         *   by_service: [...],
         *   by_status: [...]
         * }
         */

        renderSummary(report);

        renderBde(report.by_bde || [], "ready");

        renderService(report.by_service || [], "ready");

        renderStatus(report.by_status || [], "ready");

        /*
         * Backend does not need to send
         * generated_on for presets.
         *
         * Use today's date for preset creation.
         */

        if (presetRow && !presetRow.childElementCount) {
          var anchor =
            report.generated_on || report.generated_at || isoOf(new Date());

          renderPresets(buildPresets(String(anchor).substring(0, 10)));
        }
      })

      .catch(function (error) {
        console.error("Yugem report error:", error);

        renderBde(null, "error");

        renderService(null, "error");

        renderStatus(null, "error");

        toast(error.message || "Unable to load report.", "error");
      });
  }

  /* =====================================================
       FILTER EVENTS
       ===================================================== */

  if (applyBtn) {
    applyBtn.addEventListener("click", function () {
      var from = rFrom ? rFrom.value : "";

      var to = rTo ? rTo.value : "";

      if (from && to && from > to) {
        toast("From date must be on or before To date.", "error");

        return;
      }

      appliedFrom = from;
      appliedTo = to;

      markActivePreset();

      loadReport();

      toast("Filter applied — report updated.", "success");
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      if (rFrom) {
        rFrom.value = "";
      }

      if (rTo) {
        rTo.value = "";
      }

      appliedFrom = "";
      appliedTo = "";

      markActivePreset();

      loadReport();

      toast("Filters reset — showing all entries.", "success");
    });
  }

  /* =====================================================
       EXPORT EXCEL
       ===================================================== */

  if (exportBtn) {
    exportBtn.addEventListener("click", function () {
      var url = CONFIG.exportUrl + queryString();

      console.log("Exporting Yugem report:", url);

      toast("Preparing Excel export...", "success");

      exportBtn.disabled = true;

      /*
       * Direct browser navigation allows
       * Flask send_file() to download XLSX.
       */

      window.location.href = url;

      setTimeout(function () {
        exportBtn.disabled = false;
      }, 1800);
    });
  }

  /* =====================================================
       MOBILE SIDEBAR
       ===================================================== */

  function closeDrawer() {
    if (sidebar) {
      sidebar.classList.remove("active");
    }

    if (overlay) {
      overlay.classList.remove("show");
    }
  }

  if (menuToggle) {
    menuToggle.addEventListener("click", function () {
      if (sidebar) {
        sidebar.classList.toggle("active");
      }

      if (overlay) {
        overlay.classList.toggle("show");
      }
    });
  }

  if (overlay) {
    overlay.addEventListener("click", closeDrawer);
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      closeDrawer();
    }
  });

  /* =====================================================
       SIDEBAR NAVIGATION
       ===================================================== */

  /*
   * Actual Yugem CSS uses .sidebar-menu,
   * not .sidebar-nav.
   */

  var navLinks = document.querySelectorAll(".sidebar-menu a");

  navLinks.forEach(function (link) {
    link.addEventListener("click", function () {
      /*
       * Close mobile sidebar
       * after navigation.
       */

      closeDrawer();
    });
  });

  /* =====================================================
       LOGOUT
       ===================================================== */

  if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
      /*
       * common.js already contains
       * Yugem logout functionality.
       *
       * This handler only closes
       * mobile drawer.
       */

      closeDrawer();
    });
  }

  /* =====================================================
       INITIAL LOAD
       ===================================================== */

  loadReport();
})();
