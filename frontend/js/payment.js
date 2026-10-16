// =========================================================
// YUGEM - PAYMENT.JS
// =========================================================

const $ = (id) => document.getElementById(id);

let payments = [];
let editingPaymentId = null;
let selectedPaymentIds = new Set();

// =========================================================
// COMMON HELPERS
// =========================================================

function showMessage(message, type = "success") {
  const box = $("paymentMessage");

  if (!box) {
    alert(message);
    return;
  }

  box.textContent = message;
  box.className = type;

  setTimeout(() => {
    box.textContent = "";
    box.className = "";
  }, 4000);
}

function money(value) {
  const num = Number(value || 0);

  return (
    "₹ " +
    num.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// =========================================================
// PAGE INITIALIZATION
// =========================================================

document.addEventListener("DOMContentLoaded", function () {
  if ($("paymentForm")) {
    initializePaymentEntry();
  }

  if ($("paymentTableBody")) {
    initializePaymentHistory();
  }
});

// =========================================================
// PAYMENT ENTRY INITIALIZATION
// =========================================================

function initializePaymentEntry() {
  loadUser();
  loadServices();
  setDateTime();

  setInterval(setDateTime, 1000);

  setupGST();
  setupPaymentPercentage();
  setupPaymentStatus();
  setupFileNames();
  setupServiceModal();
  setupOtherService();
  setupPAN();
  setupReset();
  loadEditPayment();

  const form = $("paymentForm");

  if (form) {
    form.addEventListener("submit", submitPayment);
  }
}

// =========================================================
// LOAD LOGGED-IN USER
// =========================================================

function loadUser() {
  try {
    const savedUser = JSON.parse(sessionStorage.getItem("yugemUser") || "null");

    if (!savedUser || !savedUser.bde_user_id) {
      console.error("No valid logged-in BDE user found:", savedUser);
      return;
    }

    if ($("bdeName")) {
      $("bdeName").value = "";
      $("bdeName").removeAttribute("readonly");
    }

    if ($("bdeContact")) {
      $("bdeContact").value = savedUser.contact || "";
    }

    if ($("headerUserName")) {
      $("headerUserName").textContent = savedUser.name || "BDE User";
    }

    console.log("Logged-in BDE:", savedUser);
  } catch (error) {
    console.error("loadUser error:", error);
  }
}

// =========================================================
// PAN CARD
// =========================================================

function setupPAN() {
  const pan = $("panCard");

  if (!pan) {
    return;
  }

  pan.addEventListener("input", function () {
    this.value = this.value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 10);
  });
}

// =========================================================
// DATE & TIME
// =========================================================

function setDateTime() {
  if (!$("paymentDate") || !$("paymentTime")) {
    return;
  }

  const now = new Date();

  const date =
    String(now.getDate()).padStart(2, "0") +
    "/" +
    String(now.getMonth() + 1).padStart(2, "0") +
    "/" +
    now.getFullYear();

  const time =
    String(now.getHours()).padStart(2, "0") +
    ":" +
    String(now.getMinutes()).padStart(2, "0") +
    ":" +
    String(now.getSeconds()).padStart(2, "0");

  $("paymentDate").value = date;
  $("paymentTime").value = time;
}

// =========================================================
// SERVICES
// =========================================================

const REFERENCE_SERVICES = [
  {
    title: "",
    items: [
      {
        name: "Company Incorporation",
        icon: "🏢",
      },
      {
        name: "GST Certification",
        icon: "📋",
      },
      {
        name: "Start-up Certification",
        icon: "🚀",
      },
      {
        name: "ISO Certification",
        icon: "🏭",
      },
      {
        name: "MSME Certificate",
        icon: "📜",
      },
    ],
  },

  {
    title: "LOANS & FUNDING",
    items: [
      {
        name: "MSME Loan",
        icon: "💼",
      },
      {
        name: "PMEGP Loan",
        icon: "🏛️",
      },
      {
        name: "Mudra Loan",
        icon: "💰",
      },
      {
        name: "NAIFF Loan",
        icon: "🌿",
      },
    ],
  },

  {
    title: "SCHEMES & SUPPORT",
    items: [
      {
        name: "Seed Fund",
        icon: "🌱",
      },
      {
        name: "Seed Support Scheme",
        icon: "🌱",
      },
      {
        name: "Nidhi Prayas",
        icon: "🤝",
      },
      {
        name: "RKVY Raftaar",
        icon: "🌻",
      },
      {
        name: "Others",
        icon: "➕",
        other: true,
      },
    ],
  },
];

// =========================================================
// LOAD SERVICES
// =========================================================

function loadServices() {
  const serviceList = $("serviceList");

  if (!serviceList) {
    return;
  }

  serviceList.innerHTML = "";

  REFERENCE_SERVICES.forEach(function (group) {
    if (group.title) {
      const heading = document.createElement("div");

      heading.className = "pe-service-category";

      heading.innerHTML = `
        <span>${escapeHtml(group.title)}</span>
      `;

      serviceList.appendChild(heading);
    }

    const grid = document.createElement("div");

    grid.className = "pe-svc-grid";

    group.items.forEach(function (service) {
      const wrapper = document.createElement("label");

      wrapper.className = "pe-svc";

      if (service.other) {
        wrapper.setAttribute("data-other-service", "true");
      }

      const otherAttribute = service.other ? 'data-other-service="true"' : "";

      wrapper.innerHTML = `
        <input
          type="checkbox"
          value="${escapeHtml(service.name)}"
          data-service-name="${escapeHtml(service.name)}"
          ${otherAttribute}
        >

        <span class="pe-svc-icon">
          ${service.icon}
        </span>

        <span class="pe-svc-name">
          ${escapeHtml(service.name)}
        </span>
      `;

      grid.appendChild(wrapper);
    });

    serviceList.appendChild(grid);
  });

  const otherCheckbox = document.querySelector(
    'input[data-other-service="true"]',
  );

  if (otherCheckbox) {
    otherCheckbox.addEventListener("change", function () {
      toggleOtherService();
      updateSelectedServices();
    });
  }

  toggleOtherService();
  updateSelectedServices();
}

// =========================================================
// OTHER SERVICE
// =========================================================

function setupOtherService() {
  const otherInput = $("otherService");
  const otherGroup = $("otherServiceGroup");

  if (!otherInput || !otherGroup) {
    return;
  }

  otherInput.addEventListener("input", function () {
    this.value = this.value.trimStart();
    updateSelectedServices();
  });

  toggleOtherService();
}

function toggleOtherService() {
  const checkbox = document.querySelector('input[data-other-service="true"]');

  const group = $("otherServiceGroup");
  const input = $("otherService");

  if (!checkbox || !group || !input) {
    return;
  }

  if (checkbox.checked) {
    group.style.display = "block";
  } else {
    group.style.display = "none";
    input.value = "";
  }
}

// =========================================================
// GST
// =========================================================

function setupGST() {
  const toggle = $("gstToggle");

  if (!toggle) {
    return;
  }

  toggle.addEventListener("click", function (event) {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const label = target.closest(".pe-opt");

    if (!label) {
      return;
    }

    toggle.querySelectorAll(".pe-opt").forEach(function (opt) {
      opt.classList.remove("active");
    });

    label.classList.add("active");

    const radio = label.querySelector("input");

    if (radio) {
      radio.checked = true;
    }

    updateGST();
  });

  ["dealAmount", "receivedAmount", "gstRate"].forEach(function (id) {
    const element = $(id);

    if (element) {
      element.addEventListener("input", updateGST);
      element.addEventListener("change", updateGST);
    }
  });

  updateGST();
}

function updateGST() {
  if (!$("receivedAmount") || !$("gstRate")) {
    return;
  }

  const received = Number($("receivedAmount").value || 0);

  const rate = Number($("gstRate").value || 0);

  const gstStatus =
    document.querySelector('input[name="gst_status"]:checked')?.value ||
    "included";

  let excl = 0;
  let gst = 0;
  let incl = received;

  if (gstStatus === "included") {
    incl = received;

    excl = rate === 0 ? received : received / (1 + rate / 100);

    gst = incl - excl;
  } else {
    excl = received;
    gst = (received * rate) / 100;
    incl = received + gst;
  }

  const deal = Number($("dealAmount")?.value || 0);

  const balance = Math.max(0, deal - incl);

  if ($("gstAmountText")) {
    $("gstAmountText").textContent = money(gst);
  }

  if ($("exclText")) {
    $("exclText").textContent = money(excl);
  }

  if ($("balanceText")) {
    $("balanceText").textContent = money(balance);
  }

  if ($("gstAmount")) {
    $("gstAmount").value = gst.toFixed(2);
  }

  if ($("exclAmount")) {
    $("exclAmount").value = excl.toFixed(2);
  }

  if ($("balanceAmount")) {
    $("balanceAmount").value = balance.toFixed(2);
  }

  if ($("receivedLabel")) {
    $("receivedLabel").innerHTML =
      gstStatus === "included"
        ? 'Amount Received (Incl. GST) <span class="required">*</span>'
        : 'Amount Received (Excl. GST) <span class="required">*</span>';
  }
}

// =========================================================
// PAYMENT PERCENTAGE
// =========================================================

function setupPaymentPercentage() {
  document
    .querySelectorAll('input[name="payment_percentage"]')
    .forEach(function (radio) {
      const parent = radio.parentElement;

      if (!parent) {
        return;
      }

      parent.addEventListener("click", function () {
        document
          .querySelectorAll('input[name="payment_percentage"]')
          .forEach(function (r) {
            r.checked = false;

            if (r.parentElement) {
              r.parentElement.classList.remove("active");
            }
          });

        radio.checked = true;
        parent.classList.add("active");
      });
    });
}
function setupPaymentStatus() {
  document
    .querySelectorAll('input[name="payment_status"]')
    .forEach(function (radio) {
      const parent = radio.parentElement;

      if (!parent) {
        return;
      }

      parent.addEventListener("click", function () {
        document
          .querySelectorAll('input[name="payment_status"]')
          .forEach(function (r) {
            r.checked = false;

            if (r.parentElement) {
              r.parentElement.classList.remove("active");
            }
          });

        radio.checked = true;
        parent.classList.add("active");
      });
    });
}

// =========================================================
// FILE NAMES
// =========================================================

function setupFileNames() {
  document.querySelectorAll('input[type="file"]').forEach(function (input) {
    input.addEventListener("change", function () {
      const targetId = input.dataset.filename;

      const target = $(targetId);

      if (!target) {
        return;
      }

      target.textContent = input.files.length ? input.files[0].name : "";
    });
  });
}

// =========================================================
// SERVICES MODAL
// =========================================================

function setupServiceModal() {
  const open = $("openServices");
  const close = $("closeServices");
  const done = $("doneServices");
  const modal = $("serviceModal");

  if (!modal) {
    return;
  }

  if (open) {
    open.addEventListener("click", function () {
      modal.hidden = false;
      modal.style.display = "flex";
    });
  }

  if (close) {
    close.addEventListener("click", function () {
      updateSelectedServices();
      modal.hidden = true;
      modal.style.display = "none";
    });
  }

  if (done) {
    done.addEventListener("click", function () {
      updateSelectedServices();
      modal.hidden = true;
      modal.style.display = "none";
    });
  }

  updateSelectedServices();
}

// =========================================================
// UPDATE SELECTED SERVICES
// =========================================================

function updateSelectedServices() {
  const list = $("serviceList");
  const chips = $("serviceChips");
  const hidden = $("servicesField");
  const count = $("serviceCount");

  if (!list || !chips || !hidden) {
    return;
  }

  const checkedBoxes = Array.from(
    list.querySelectorAll('input[type="checkbox"]:checked'),
  );

  const otherCheckbox = document.querySelector(
    'input[data-other-service="true"]',
  );

  const otherInput = $("otherService");

  let finalServices = checkedBoxes
    .filter(function (checkbox) {
      return !checkbox.hasAttribute("data-other-service");
    })
    .map(function (checkbox) {
      return checkbox.value;
    });

  if (otherCheckbox && otherCheckbox.checked) {
    const otherText = otherInput ? otherInput.value.trim() : "";

    if (otherText) {
      finalServices.push("Others: " + otherText);
    } else {
      finalServices.push("Others");
    }
  }

  hidden.value = finalServices.join(",");

  if (count) {
    count.textContent =
      finalServices.length === 1
        ? "1 service selected"
        : `${finalServices.length} service(s) selected`;
  }

  if (!finalServices.length) {
    chips.innerHTML = `
      <span class="pe-muted">
        No service selected
      </span>
    `;
    return;
  }

  chips.innerHTML = finalServices
    .map(function (service) {
      return `
        <span class="pe-chip">
          ${escapeHtml(service)}
        </span>
      `;
    })
    .join("");
}

// =========================================================
// EDIT PAYMENT - LOAD EXISTING PAYMENT
// =========================================================

function loadEditPayment() {
  const raw = localStorage.getItem("yugemEditPayment");

  if (!raw) {
    return;
  }

  try {
    const payment = JSON.parse(raw);

    if (!payment || !payment.payment_id) {
      localStorage.removeItem("yugemEditPayment");
      return;
    }

    editingPaymentId = Number(payment.payment_id);

    if ($("clientName")) {
      $("clientName").value = payment.client_name || "";
    }

    if ($("contactNumber")) {
      $("contactNumber").value = payment.client_contact || "";
    }

    if ($("emailAddress")) {
      $("emailAddress").value = payment.client_email || "";
    }

    if ($("companyName")) {
      $("companyName").value = payment.company_name || "";
    }

    if ($("companyType")) {
      $("companyType").value = payment.company_type || "";
    }

    if ($("dealAmount")) {
      $("dealAmount").value = payment.total_amount ?? "";
    }

    if ($("receivedAmount")) {
      $("receivedAmount").value = payment.received_amount ?? "";
    }

    if ($("gstRate")) {
      $("gstRate").value = payment.gst_rate ?? "";
    }

    if ($("bdeName")) {
      $("bdeName").value = payment.bde_name || "";
    }

    if ($("panCard")) {
      $("panCard").value = (payment.bde_pan || "").toUpperCase();
    }

    if ($("bdm1")) {
      $("bdm1").value = payment.bdm1_name || "";
    }

    if ($("bdm2")) {
      $("bdm2").value = payment.bdm2_name || "";
    }

    if ($("remarks")) {
      $("remarks").value = payment.remarks || "";
    }

    const gstRadio = document.querySelector(
      `input[name="gst_status"][value="${payment.gst_status || "included"}"]`,
    );

    if (gstRadio) {
      gstRadio.checked = true;

      document.querySelectorAll("#gstToggle .pe-opt").forEach(function (opt) {
        opt.classList.remove("active");
      });

      if (gstRadio.parentElement) {
        gstRadio.parentElement.classList.add("active");
      }
    }

    const percentage = String(payment.payment_percentage ?? "100");

    document
      .querySelectorAll('input[name="payment_percentage"]')
      .forEach(function (radio) {
        radio.checked = radio.value === percentage;

        if (radio.parentElement) {
          radio.parentElement.classList.toggle("active", radio.checked);
        }
      });

    document
      .querySelectorAll('#serviceList input[type="checkbox"]')
      .forEach(function (checkbox) {
        checkbox.checked = false;
      });

    let otherText = "";

    (Array.isArray(payment.services)
      ? payment.services
      : String(payment.services || "")
          .split(",")
          .filter(Boolean)
    ).forEach(function (service) {
      const value = String(service || "").trim();

      if (value.indexOf("Others:") === 0) {
        const otherCheckbox = document.querySelector(
          'input[data-other-service="true"]',
        );

        if (otherCheckbox) {
          otherCheckbox.checked = true;
        }

        otherText = value.substring("Others:".length).trim();

        return;
      }

      const checkbox = Array.from(
        document.querySelectorAll('#serviceList input[type="checkbox"]'),
      ).find(function (item) {
        return item.value === value;
      });

      if (checkbox) {
        checkbox.checked = true;
      }
    });

    if ($("otherService")) {
      $("otherService").value = otherText;
    }

    toggleOtherService();
    updateSelectedServices();
    updateGST();

    localStorage.removeItem("yugemEditPayment");
  } catch (error) {
    console.error("loadEditPayment error:", error);

    localStorage.removeItem("yugemEditPayment");

    editingPaymentId = null;
  }
}

// =========================================================
// FORM RESET
// =========================================================

function setupReset() {
  const resetButton = $("resetPayment");

  if (!resetButton) {
    return;
  }

  resetButton.addEventListener("click", function () {
    resetPaymentForm();
  });
}

function resetPaymentForm() {
  const form = $("paymentForm");

  if (form) {
    form.reset();
  }

  editingPaymentId = null;

  const gstIncluded = document.querySelector(
    'input[name="gst_status"][value="included"]',
  );

  if (gstIncluded) {
    gstIncluded.checked = true;
  }

  document.querySelectorAll("#gstToggle .pe-opt").forEach(function (opt) {
    opt.classList.remove("active");
  });

  if (gstIncluded && gstIncluded.parentElement) {
    gstIncluded.parentElement.classList.add("active");
  }

  document
    .querySelectorAll('input[name="payment_percentage"]')
    .forEach(function (radio) {
      radio.checked = false;

      if (radio.parentElement) {
        radio.parentElement.classList.remove("active");
      }
    });

  document
    .querySelectorAll('#serviceList input[type="checkbox"]')
    .forEach(function (checkbox) {
      checkbox.checked = false;
    });

  if ($("otherService")) {
    $("otherService").value = "";
  }

  toggleOtherService();
  updateSelectedServices();
  updateGST();
  setDateTime();
}

// =========================================================
// VALIDATE PAYMENT FORM
// =========================================================

function validatePaymentForm() {
  const user = JSON.parse(sessionStorage.getItem("yugemUser") || "null");

  if (!user || !user.bde_user_id) {
    alert("Please login again.");

    window.location.href = "login.html";

    return false;
  }

  const clientName = $("clientName")?.value.trim() || "";

  if (!clientName) {
    alert("Client Name is required.");

    $("clientName")?.focus();

    return false;
  }

  const bdeName = $("bdeName")?.value.trim() || "";

  if (!bdeName) {
    alert("BDE Name is required.");

    $("bdeName")?.focus();

    return false;
  }

  const pan = $("panCard")?.value.trim() || "";

  if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
    alert("Please enter a valid PAN Card number.");

    $("panCard")?.focus();

    return false;
  }

  const bdm1Name = $("bdm1")?.value.trim() || "";

  if (!bdm1Name) {
    alert("BDM Name 1 is required.");

    $("bdm1")?.focus();

    return false;
  }

  const paymentPercentage =
    document.querySelector('input[name="payment_percentage"]:checked')?.value ||
    "";

  if (!paymentPercentage) {
    alert("Please select Payment Percentage.");

    return false;
  }
  const paymentStatus =
    document.querySelector('input[name="payment_status"]:checked')?.value || "";

  if (!paymentStatus) {
    alert("Please select Payment Status.");
    return false;
  }

  updateSelectedServices();

  const services = $("servicesField")?.value.trim() || "";

  if (!services) {
    alert("Please select at least one service.");

    return false;
  }

  const dealAmount = Number($("dealAmount")?.value || 0);

  if (dealAmount <= 0) {
    alert("Please enter a valid Deal Amount.");

    $("dealAmount")?.focus();

    return false;
  }

  const receivedAmount = Number($("receivedAmount")?.value || 0);

  if (receivedAmount < 0) {
    alert("Received Amount cannot be negative.");

    $("receivedAmount")?.focus();

    return false;
  }

  return true;
}

// =========================================================
// SUBMIT PAYMENT
// =========================================================

async function submitPayment(event) {
  event.preventDefault();

  if (!validatePaymentForm()) {
    return;
  }

  const form = $("paymentForm");

  if (!form) {
    return;
  }

  const user = JSON.parse(sessionStorage.getItem("yugemUser") || "null");

  if (!user || !user.bde_user_id) {
    alert("User session expired. Please login again.");

    window.location.href = "login.html";

    return;
  }

  const bdm1Name = $("bdm1")?.value.trim() || "";

  const bdm2Name = $("bdm2")?.value.trim() || "";

  if (!bdm1Name) {
    alert("BDM Name 1 is required.");

    $("bdm1")?.focus();

    return;
  }

  const formData = new FormData(form);

  const paymentStatus =
    document.querySelector('input[name="payment_status"]:checked')?.value || "";

  if (!paymentStatus) {
    alert("Please select Payment Status.");
    return;
  }

  formData.set("payment_status", paymentStatus);

  formData.set("bde_user_id", String(user.bde_user_id));

  formData.set("employee_id", user.employee_id || "");

  formData.set("bde_name", $("bdeName")?.value.trim() || user.name || "");

  formData.set("bde_pan", ($("panCard")?.value.trim() || "").toUpperCase());

  formData.set("bdm_1_name", bdm1Name);

  formData.set("bdm_2_name", bdm2Name);

  formData.delete("bdm_1_id");

  formData.delete("bdm_2_id");

  formData.delete("bdm_3_id");

  updateSelectedServices();

  formData.set("services", $("servicesField")?.value || "");
  if ($("paymentDate")) {
    formData.set("payment_date", $("paymentDate").value);
  }

  if ($("paymentTime")) {
    formData.set("payment_time", $("paymentTime").value);
  }

  const gstStatus =
    document.querySelector('input[name="gst_status"]:checked')?.value ||
    "included";

  formData.set("gst_status", gstStatus);

  formData.set("gst_rate", $("gstRate")?.value || "18");

  formData.set("gst_amount", $("gstAmount")?.value || "0");

  formData.set("excl_amount", $("exclAmount")?.value || "0");

  formData.set("balance_amount", $("balanceAmount")?.value || "0");

  const paymentPercentage =
    document.querySelector('input[name="payment_percentage"]:checked')?.value ||
    "";

  formData.set("payment_percentage", paymentPercentage);

  let url = "/api/payments";

  let method = "POST";

  if (editingPaymentId) {
    url = `/api/payments/${editingPaymentId}`;

    method = "PUT";
  }

  const submitButton = form.querySelector('button[type="submit"]');

  const originalButtonText = submitButton?.textContent || "Save Payment";

  if (submitButton) {
    submitButton.disabled = true;

    submitButton.textContent = editingPaymentId ? "Updating..." : "Saving...";
  }

  try {
    const response = await fetch(url, {
      method: method,
      body: formData,
    });

    let data = {};

    try {
      data = await response.json();
    } catch (jsonError) {
      console.error("Response JSON error:", jsonError);
    }

    if (!response.ok) {
      throw new Error(
        data.message || data.error || `Request failed (${response.status})`,
      );
    }

    if (editingPaymentId) {
      alert(data.message || "Payment updated successfully.");

      editingPaymentId = null;

      window.location.href = "payment-entries.html";

      return;
    }

    alert(data.message || "Payment saved successfully.");

    resetPaymentForm();
  } catch (error) {
    console.error("Payment submit error:", error);

    alert(error.message || "Unable to save payment.");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;

      submitButton.textContent = originalButtonText;
    }
  }
}

// =========================================================
// PAYMENT HISTORY
// =========================================================

function initializePaymentHistory() {
  loadPaymentHistory();
  setupPaymentSearch();
  setupPaymentFilters();
  setupPaymentRefresh();
  setupPaymentModalClose();
}

async function loadPaymentHistory() {
  const tbody = $("paymentTableBody");

  if (!tbody) {
    return;
  }

  tbody.innerHTML = `
    <tr>
      <td colspan="8">
        Loading payments...
      </td>
    </tr>
  `;

  try {
    const response = await fetch("/api/payments", {
      method: "GET",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || "Unable to load payments.");
    }

    payments = Array.isArray(data)
      ? data
      : Array.isArray(data.payments)
        ? data.payments
        : [];

    renderPaymentHistory(payments);
  } catch (error) {
    console.error("Payment history error:", error);

    tbody.innerHTML = `
      <tr>
        <td colspan="8">
          Unable to load payment history.
        </td>
      </tr>
    `;
  }
}

// =========================================================
// RENDER PAYMENT HISTORY
// =========================================================

function renderPaymentHistory(list) {
  const tbody = $("paymentTableBody");

  if (!tbody) {
    return;
  }

  tbody.innerHTML = "";

  if (!Array.isArray(list) || !list.length) {
    tbody.innerHTML = `
      <tr>
        <td
          colspan="8"
          class="empty-row"
        >
          No payment records found.
        </td>
      </tr>
    `;

    return;
  }

  list.forEach(function (payment) {
    const row = document.createElement("tr");

    const paymentId = payment.payment_id ?? payment.id ?? "";

    const date = payment.payment_date ?? payment.date ?? "";

    const clientName = payment.client_name ?? "";

    const companyName = payment.company_name ?? "";

    const totalAmount = payment.total_amount ?? payment.amount ?? 0;

    const receivedAmount = payment.received_amount ?? 0;

    const balanceAmount = payment.balance_amount ?? 0;

    row.innerHTML = `
      <td>
        <input
          type="checkbox"
          class="payment-checkbox"
          data-payment-id="${Number(paymentId)}"
          ${selectedPaymentIds.has(Number(paymentId)) ? "checked" : ""}
        >
      </td>

      <td>
        ${escapeHtml(paymentId)}
      </td>

      <td>
        ${escapeHtml(date)}
      </td>

      <td>
        ${escapeHtml(clientName)}
      </td>

      <td>
        ${escapeHtml(companyName)}
      </td>

      <td>
        ${money(totalAmount)}
      </td>

      <td>
        ${money(receivedAmount)}
      </td>

      <td>
        <div>
          ${money(balanceAmount)}
        </div>

        ${
          payment.payment_status
            ? `
              <small class="status-badge">
                ${escapeHtml(payment.payment_status)}
              </small>
            `
            : ""
        }
      </td>

      <td>
        <button
          type="button"
          class="btn-view-payment"
          onclick="viewPayment(${Number(paymentId)})"
        >
          View
        </button>
      </td>
    `;

    tbody.appendChild(row);
  });
}

// =========================================================
// SEARCH
// =========================================================

function setupPaymentSearch() {
  const search = $("paymentSearch") || $("searchInput");

  const searchButton = $("searchBtn");

  const clearButton = $("clearSearchBtn");

  if (search) {
    search.addEventListener("input", function () {
      applyPaymentFilters();
    });

    search.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        applyPaymentFilters();
      }
    });
  }

  if (searchButton) {
    searchButton.addEventListener("click", function () {
      applyPaymentFilters();
    });
  }

  if (clearButton) {
    clearButton.addEventListener("click", function () {
      if (search) {
        search.value = "";
      }

      const status = $("paymentStatusFilter") || $("statusFilter");

      if (status) {
        status.value = "";
      }

      const type = $("paymentTypeFilter");

      if (type) {
        type.value = "";
      }

      const date = $("paymentDateFilter");

      if (date) {
        date.value = "";
      }

      renderPaymentHistory(payments);
    });
  }
}

// =========================================================
// FILTERS
// =========================================================

function setupPaymentFilters() {
  const filters = [
    $("paymentStatusFilter") ? "paymentStatusFilter" : "statusFilter",

    "paymentTypeFilter",

    "paymentDateFilter",
  ];

  filters.forEach(function (id) {
    const element = $(id);

    if (element) {
      element.addEventListener("change", applyPaymentFilters);
    }
  });
}

function applyPaymentFilters() {
  const search = ($("paymentSearch")?.value || $("searchInput")?.value || "")
    .trim()
    .toLowerCase();

  const status = (
    $("paymentStatusFilter")?.value ||
    $("statusFilter")?.value ||
    ""
  )
    .trim()
    .toLowerCase();

  const type = ($("paymentTypeFilter")?.value || "").trim().toLowerCase();

  const date = ($("paymentDateFilter")?.value || "").trim().toLowerCase();

  const filtered = payments.filter(function (payment) {
    const searchable = [
      payment.payment_id,
      payment.client_name,
      payment.company_name,
      payment.bde_name,
      payment.employee_id,
      payment.bde_pan,
      payment.bdm1_name,
      payment.bdm2_name,
      payment.payment_type,
      payment.payment_status,
    ]
      .join(" ")
      .toLowerCase();

    if (search && !searchable.includes(search)) {
      return false;
    }

    if (
      status &&
      String(payment.payment_status || "").toLowerCase() !== status
    ) {
      return false;
    }

    if (type && String(payment.payment_type || "").toLowerCase() !== type) {
      return false;
    }

    if (
      date &&
      !String(payment.payment_date || "")
        .toLowerCase()
        .includes(date)
    ) {
      return false;
    }

    return true;
  });

  renderPaymentHistory(filtered);
}

// =========================================================
// REFRESH
// =========================================================

function setupPaymentRefresh() {
  const button = $("refreshPayments");

  if (!button) {
    return;
  }

  button.addEventListener("click", function () {
    loadPaymentHistory();
  });
}

// =========================================================
// PAYMENT MODAL HELPERS
// =========================================================

function getPaymentModal() {
  return $("paymentDetailsModal") || $("paymentModal");
}

function getPaymentDetailsBody() {
  return (
    $("paymentDetailsBody") || $("paymentDetailsContent") || $("paymentDetails")
  );
}

function getImageViewer() {
  return $("imageViewer");
}

function closePaymentModal() {
  closePaymentDetails();
}

function closeImageViewer() {
  const viewer = getImageViewer();

  if (!viewer) {
    return;
  }

  viewer.hidden = true;
  viewer.style.display = "none";
}

// =========================================================
// MODAL CLOSE
// =========================================================

function setupPaymentModalClose() {
  const modal = getPaymentModal();

  if (!modal) {
    return;
  }

  const closeButtons = modal.querySelectorAll(
    "[data-close-modal], .modal-close, .close",
  );

  closeButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      closePaymentDetails();
    });
  });

  modal.addEventListener("click", function (event) {
    if (event.target === modal) {
      closePaymentDetails();
    }
  });
}

// =========================================================
// VIEW PAYMENT
// =========================================================

function viewPayment(paymentId) {
  if (!paymentId) {
    alert("Invalid Payment ID.");
    return;
  }

  const payment = payments.find(function (item) {
    return Number(item.payment_id) === Number(paymentId);
  });

  if (!payment) {
    alert("Payment details not found.");
    return;
  }

  renderPaymentDetails(payment);
}

// =========================================================
// RENDER PAYMENT DETAILS
// =========================================================

function renderPaymentDetails(payment) {
  const modal = getPaymentModal();

  const body = getPaymentDetailsBody();

  if (!modal || !body) {
    alert("Payment details modal not found.");
    return;
  }

  const paymentId = payment.payment_id || payment.id || "";

  const services = Array.isArray(payment.services)
    ? payment.services
    : String(payment.services || "")
        .split(",")
        .map(function (item) {
          return item.trim();
        })
        .filter(Boolean);

  function detail(label, value) {
    return `
      <div class="payment-detail-row">
        <div class="payment-detail-label">
          ${escapeHtml(label)}
        </div>

        <div class="payment-detail-value">
          ${escapeHtml(
            value === null || value === undefined || value === "" ? "-" : value,
          )}
        </div>
      </div>
    `;
  }

  const servicesHtml = services.length
    ? services
        .map(function (service) {
          return `
                <span class="pe-chip">
                  ${escapeHtml(service)}
                </span>
              `;
        })
        .join("")
    : "<span>-</span>";

  // =======================================================
  // ATTACHMENTS
  // =======================================================

  const attachments = Array.isArray(payment.attachments)
    ? payment.attachments
    : [];

  let attachmentsHtml = attachments.length
    ? attachments
        .map(function (file) {
          const fileName = file.file_name || file.filename || "Attachment";

          const fileUrl = file.file_url || file.url || file.path || "#";

          return `
                <div class="payment-attachment">

                  <span>
                    ${escapeHtml(fileName)}
                  </span>

                  ${
                    fileUrl !== "#"
                      ? `
                        <a
                          href="${escapeHtml(fileUrl)}"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open
                        </a>
                      `
                      : ""
                  }

                </div>
              `;
        })
        .join("")
    : "";

  if (!attachments.length) {
    if (
      payment.has_screenshot === true ||
      payment.has_screenshot === "Y" ||
      payment.has_screenshot === 1
    ) {
      const screenshotUrl =
        payment.screenshot_url ||
        `/api/payments/${paymentId}/attachment/screenshot`;

      attachmentsHtml += `
        <div class="payment-attachment">

          <span>
            ${escapeHtml(payment.screenshot_name || "Payment Screenshot")}
          </span>

          <a
            href="${escapeHtml(screenshotUrl)}"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open
          </a>

        </div>
      `;
    }

    if (
      payment.has_invoice === true ||
      payment.has_invoice === "Y" ||
      payment.has_invoice === 1
    ) {
      const invoiceUrl =
        payment.invoice_url || `/api/payments/${paymentId}/attachment/invoice`;

      attachmentsHtml += `
        <div class="payment-attachment">

          <span>
            ${escapeHtml(payment.invoice_name || "Invoice")}
          </span>

          <a
            href="${escapeHtml(invoiceUrl)}"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open
          </a>

        </div>
      `;
    }
  }

  if (!attachmentsHtml) {
    attachmentsHtml = "<span>-</span>";
  }

  // =======================================================
  // PAYMENT DETAILS HTML
  // =======================================================

  body.innerHTML = `
    <div class="payment-details-wrapper">

      <div class="payment-details-header">

        <div>
          <h2>
            Payment Details
          </h2>

          <p>
            Payment ID:
            <strong>
              ${escapeHtml(paymentId)}
            </strong>
          </p>
        </div>


        <div class="payment-detail-actions">

          <button
            type="button"
            class="btn-edit-payment"
            onclick="editPayment(${Number(paymentId)})"
          >
            Edit Payment
          </button>

          <button
            type="button"
            class="btn-delete-payment"
            onclick="deletePayment(${Number(paymentId)})"
          >
            Delete Payment
          </button>

        </div>

      </div>


      <div class="payment-detail-section">

        <h3>
          Payment Information
        </h3>

        ${detail("Payment ID", paymentId)}

        ${detail("Payment Date", payment.payment_date)}

        ${detail("Payment Time", payment.payment_time)}

        ${detail("Payment Type", payment.payment_type)}

        ${detail(
          "Payment Percentage",
          payment.payment_percentage ? `${payment.payment_percentage}%` : "-",
        )}

        ${detail("Payment Status", payment.payment_status)}

      </div>


      <div class="payment-detail-section">

        <h3>
          BDE Information
        </h3>

        ${detail("BDE Name", payment.bde_name)}

        ${detail("Employee ID", payment.employee_id)}

        ${detail("PAN Card", payment.bde_pan)}

      </div>


      <div class="payment-detail-section">

        <h3>
          Client Information
        </h3>

        ${detail("Client Name", payment.client_name)}

        ${detail("Contact Number", payment.client_contact)}

        ${detail("Email", payment.client_email)}

        ${detail("Company Name", payment.company_name)}

        ${detail("Company Type", payment.company_type)}

      </div>


      <div class="payment-detail-section">

        <h3>
          Amount Details
        </h3>

        ${detail("Basic Amount", money(payment.basic_amount))}

        ${detail("GST Status", payment.gst_status)}

        ${detail("GST Rate", payment.gst_rate ? `${payment.gst_rate}%` : "0%")}

        ${detail("GST Amount", money(payment.gst_amount))}

        ${detail("Total Amount", money(payment.total_amount))}

        ${detail("Received Amount", money(payment.received_amount))}

        ${detail("Balance Amount", money(payment.balance_amount))}

      </div>


      <div class="payment-detail-section">

        <h3>
          BDM Information
        </h3>

        ${detail("BDM Name 1", payment.bdm1_name || payment.bdm1_id)}

        ${detail("BDM Name 2", payment.bdm2_name || payment.bdm2_id)}

      </div>


      <div class="payment-detail-section">

        <h3>
          Services
        </h3>

        <div class="payment-services-list">
          ${servicesHtml}
        </div>

      </div>


      <div class="payment-detail-section">

        <h3>
          Remarks
        </h3>

        <div class="payment-remarks">
          ${escapeHtml(payment.remarks || "-")}
        </div>

      </div>


      <div class="payment-detail-section">

        <h3>
          Attachments
        </h3>

        <div class="payment-attachments">
          ${attachmentsHtml}
        </div>

      </div>

    </div>
  `;

  modal.hidden = false;
  modal.style.display = "flex";
}

// =========================================================
// EDIT PAYMENT
// =========================================================

async function editPayment(paymentId) {
  if (!paymentId) {
    alert("Invalid Payment ID.");
    return;
  }

  let payment = payments.find(function (item) {
    return Number(item.payment_id) === Number(paymentId);
  });

  if (!payment) {
    try {
      const response = await fetch(`/api/payments/${paymentId}`);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || data.error || "Unable to load payment.",
        );
      }

      payment = data.payment || data;
    } catch (error) {
      console.error("Edit payment load error:", error);

      alert(error.message || "Unable to load payment.");

      return;
    }
  }

  try {
    localStorage.setItem("yugemEditPayment", JSON.stringify(payment));
  } catch (error) {
    console.error("Unable to store payment:", error);

    alert("Unable to prepare payment for editing.");

    return;
  }

  const modal = getPaymentModal();

  if (modal) {
    modal.hidden = true;
    modal.style.display = "none";
  }

  window.location.href = "payment-entry.html";
}

// =========================================================
// DELETE PAYMENT
// =========================================================

async function deletePayment(paymentId) {
  if (!paymentId) {
    alert("Invalid Payment ID.");
    return;
  }

  const confirmed = confirm(
    "Are you sure you want to delete this payment?\n\n" +
      "Payment ID: " +
      paymentId +
      "\n\n" +
      "This will permanently delete the payment and its related records.",
  );

  if (!confirmed) {
    return;
  }

  const button = document.querySelector(".btn-delete-payment");

  const originalText = button?.textContent || "Delete Payment";

  if (button) {
    button.disabled = true;
    button.textContent = "Deleting...";
  }

  try {
    const response = await fetch(`/api/payments/${paymentId}`, {
      method: "DELETE",
    });

    let data = {};

    try {
      data = await response.json();
    } catch (error) {
      console.error("Delete response JSON error:", error);
    }

    if (!response.ok) {
      throw new Error(
        data.message || data.error || "Unable to delete payment.",
      );
    }

    payments = payments.filter(function (payment) {
      return Number(payment.payment_id) !== Number(paymentId);
    });

    const modal = getPaymentModal();

    if (modal) {
      modal.hidden = true;
      modal.style.display = "none";
    }

    renderPaymentHistory(payments);

    alert(data.message || "Payment deleted successfully.");
  } catch (error) {
    console.error("Delete payment error:", error);

    alert(error.message || "Unable to delete payment.");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

// =========================================================
// ATTACHMENTS
// =========================================================

function openAttachment(url) {
  if (!url) {
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

// =========================================================
// CLOSE PAYMENT MODAL
// =========================================================

function closePaymentDetails() {
  const modal = getPaymentModal();

  if (!modal) {
    return;
  }

  modal.hidden = true;
  modal.style.display = "none";
}

// =========================================================
// ESC KEY
// =========================================================

document.addEventListener("keydown", function (event) {
  if (event.key !== "Escape") {
    return;
  }

  closePaymentDetails();
});

// =========================================================
// GLOBAL EXPORTS
// =========================================================

window.viewPayment = viewPayment;

window.editPayment = editPayment;

window.deletePayment = deletePayment;

window.closePaymentDetails = closePaymentDetails;

window.closePaymentModal = closePaymentModal;

window.closeImageViewer = closeImageViewer;

window.openAttachment = openAttachment;

window.submitPayment = submitPayment;

// =========================================================
// BEFORE UNLOAD
// =========================================================

window.addEventListener("beforeunload", function () {
  try {
    updateSelectedServices();
  } catch (error) {
    console.error("Service sync error:", error);
  }
});

// =========================================================
// PAYMENT MODAL BACKDROP
// =========================================================

document.addEventListener("click", function (event) {
  const modal = getPaymentModal();

  if (!modal) {
    return;
  }

  if (event.target === modal && !modal.hidden) {
    closePaymentDetails();
  }
});

// =========================================================
// SERVICE MODAL BACKDROP
// =========================================================

document.addEventListener("click", function (event) {
  const modal = $("serviceModal");

  if (!modal) {
    return;
  }

  if (event.target === modal && !modal.hidden) {
    modal.hidden = true;
    modal.style.display = "none";

    updateSelectedServices();
  }
});

// =========================================================
// NUMERIC INPUTS
// =========================================================

["dealAmount", "receivedAmount", "gstRate"].forEach(function (id) {
  const input = $(id);

  if (!input) {
    return;
  }

  input.addEventListener("input", function () {
    if (Number(this.value) < 0) {
      this.value = 0;
    }
  });
});

// =========================================================
// CONTACT NUMBER
// =========================================================

const contactInput = $("contactNumber");

if (contactInput) {
  contactInput.addEventListener("input", function () {
    this.value = this.value.replace(/\D/g, "").slice(0, 10);
  });
}

// =========================================================
// EMAIL
// =========================================================

const emailInput = $("emailAddress");

if (emailInput) {
  emailInput.addEventListener("input", function () {
    this.value = this.value.toLowerCase();
  });
}

// =========================================================
// BDM TEXTBOXES
// =========================================================

["bdm1", "bdm2"].forEach(function (id) {
  const input = $(id);

  if (!input) {
    return;
  }

  input.addEventListener("input", function () {
    this.value = this.value.replace(/\s{2,}/g, " ");
  });
});

// =========================================================
// BDE NAME
// =========================================================

const bdeNameInput = $("bdeName");

if (bdeNameInput) {
  bdeNameInput.addEventListener("input", function () {
    this.value = this.value.replace(/\s{2,}/g, " ");
  });
}

// =========================================================
// CLIENT NAME
// =========================================================

const clientNameInput = $("clientName");

if (clientNameInput) {
  clientNameInput.addEventListener("input", function () {
    this.value = this.value.replace(/\s{2,}/g, " ");
  });
}

// =========================================================
// COMPANY NAME
// =========================================================

const companyNameInput = $("companyName");

if (companyNameInput) {
  companyNameInput.addEventListener("input", function () {
    this.value = this.value.replace(/\s{2,}/g, " ");
  });
}

// =========================================================
// REMARKS
// =========================================================

const remarksInput = $("remarks");

if (remarksInput) {
  remarksInput.addEventListener("input", function () {
    this.value = this.value.replace(/\s{2,}/g, " ");
  });
}

// =========================================================
// AUTO GST UPDATE
// =========================================================

document.addEventListener("input", function (event) {
  const target = event.target;

  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  if (
    target.id === "dealAmount" ||
    target.id === "receivedAmount" ||
    target.id === "gstRate"
  ) {
    updateGST();
  }
});

// =========================================================
// SERVICE CHECKBOX CHANGE
// =========================================================

document.addEventListener("change", function (event) {
  const target = event.target;

  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  if (target.type === "checkbox" && target.closest("#serviceList")) {
    if (target.hasAttribute("data-other-service")) {
      toggleOtherService();
    }

    updateSelectedServices();
  }
});

// =========================================================
// KEYBOARD ACCESS
// =========================================================

document.addEventListener("keydown", function (event) {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  const target = event.target;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  if (target.classList.contains("btn-view-payment")) {
    event.preventDefault();
    target.click();
  }
});

// =========================================================
// LOGOUT
// =========================================================

const logoutButton = $("logoutButton");

if (logoutButton) {
  logoutButton.addEventListener("click", function () {
    const confirmed = confirm("Are you sure you want to logout?");

    if (!confirmed) {
      return;
    }

    localStorage.removeItem("yugemUser");
    sessionStorage.removeItem("yugemAuthToken");
    localStorage.removeItem("yugemEditPayment");

    window.location.href = "login.html";
  });
}

// =========================================================
// BACK TO DASHBOARD
// =========================================================

const dashboardButton = $("dashboardButton");

if (dashboardButton) {
  dashboardButton.addEventListener("click", function () {
    window.location.href = "index.html";
  });
}

// =========================================================
// PAYMENT ENTRY BACK BUTTON
// =========================================================

const paymentBackButton = $("paymentBackButton");

if (paymentBackButton) {
  paymentBackButton.addEventListener("click", function () {
    window.location.href = "payment-entries.html";
  });
}

// =========================================================
// PAGE LOAD
// =========================================================

window.addEventListener("load", function () {
  try {
    if ($("serviceList")) {
      updateSelectedServices();
    }

    if ($("dealAmount") || $("receivedAmount") || $("gstRate")) {
      updateGST();
    }
  } catch (error) {
    console.error("Final payment initialization error:", error);
  }
});

function updateSelectionUI() {
  const count = selectedPaymentIds.size;

  const toolbar = $("selectionToolbar");
  const countElement = $("selectedCount");
  const selectAll = $("selectAllPayments");

  if (countElement) {
    countElement.textContent = count;
  }

  if (toolbar) {
    toolbar.hidden = count === 0;
  }

  if (selectAll) {
    const checkboxes = document.querySelectorAll(".payment-checkbox");

    selectAll.checked =
      checkboxes.length > 0 && Array.from(checkboxes).every((cb) => cb.checked);

    selectAll.indeterminate = count > 0 && !selectAll.checked;
  }
}

document.addEventListener("change", function (event) {
  if (event.target.classList.contains("payment-checkbox")) {
    const id = Number(event.target.dataset.paymentId);

    if (event.target.checked) {
      selectedPaymentIds.add(id);
    } else {
      selectedPaymentIds.delete(id);
    }

    updateSelectionUI();
  }

  if (event.target.id === "selectAllPayments") {
    document.querySelectorAll(".payment-checkbox").forEach(function (checkbox) {
      checkbox.checked = event.target.checked;

      const id = Number(checkbox.dataset.paymentId);

      if (event.target.checked) {
        selectedPaymentIds.add(id);
      } else {
        selectedPaymentIds.delete(id);
      }
    });

    updateSelectionUI();
  }
});

document.addEventListener("click", async function (event) {
  if (event.target.id === "clearSelectionBtn") {
    selectedPaymentIds.clear();

    document
      .querySelectorAll(".payment-checkbox")
      .forEach((cb) => (cb.checked = false));

    updateSelectionUI();
    return;
  }

  if (event.target.id !== "deleteSelectedBtn") {
    return;
  }

  if (selectedPaymentIds.size === 0) {
    return;
  }

  const ids = Array.from(selectedPaymentIds);

  if (
    !confirm(
      `Are you sure you want to delete ${ids.length} selected payment(s)?`,
    )
  ) {
    return;
  }

  const button = event.target;

  button.disabled = true;
  button.textContent = "Deleting...";

  try {
    for (const paymentId of ids) {
      const response = await fetch(`/api/payments/${paymentId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`Failed to delete Payment ID ${paymentId}`);
      }
    }

    selectedPaymentIds.clear();

    await loadPaymentHistory();

    updateSelectionUI();

    alert(`${ids.length} payment(s) deleted successfully.`);
  } catch (error) {
    console.error("Bulk delete error:", error);

    alert(error.message || "Unable to delete selected payments.");

    await loadPaymentHistory();
  } finally {
    button.disabled = false;
    button.textContent = "Delete Selected";
  }
});

// =========================================================
// END
// =========================================================
