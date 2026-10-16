/* =========================================================
   YUGEM - COMMON JS
========================================================= */

/* =========================================================
   YUGEM - PAGE ACCESS CONTROL
========================================================= */

window.yugemAccessReady = (async function () {
  const currentPage = window.location.pathname.split("/").pop().toLowerCase();

  /* Login page ko access-control se exclude karo */

  if (currentPage === "" || currentPage === "login.html") {
    return;
  }

  /* Logged-in user check */

  const savedUser = sessionStorage.getItem("yugemUser");
  const authToken = sessionStorage.getItem("yugemAuthToken");

  if (!savedUser || !authToken) {
    sessionStorage.removeItem("yugemUser");
    sessionStorage.removeItem("yugemAuthToken");
    window.location.href = "login.html";

    return;
  }

  let user;

  try {
    user = JSON.parse(savedUser);
  } catch (error) {
    console.error("Invalid Yugem user data:", error);

    sessionStorage.removeItem("yugemUser");
    sessionStorage.removeItem("yugemAuthToken");

    window.location.href = "login.html";

    return;
  }

  /* =====================================================
     GET LATEST ACCESS FROM DATABASE ON EVERY PAGE LOAD
     ===================================================== */

  try {
    const response = await fetch("/api/my-access", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      credentials: "same-origin",
    });

    let accessData = {};

    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      accessData = await response.json();
    }

    if (!response.ok) {
      console.error("Current access load failed:", accessData);

      sessionStorage.removeItem("yugemUser");
      sessionStorage.removeItem("yugemAuthToken");

      if (response.status === 403) {
        alert(accessData.message || "Your account does not have access.");
      }

      window.location.href = "login.html";
      return;
    }

    user.role = String(accessData.role || "")
      .trim()
      .toUpperCase();

    user.allowed_pages = Array.isArray(accessData.allowed_pages)
      ? accessData.allowed_pages
      : [];

    sessionStorage.setItem("yugemUser", JSON.stringify(user));
  } catch (error) {
    console.error("Unable to refresh user access:", error);
    return;
  }

  /* User role check */

  const role = String(user.role || "")
    .trim()
    .toUpperCase();

  /* Allowed pages */

  const allowedPages = Array.isArray(user.allowed_pages)
    ? user.allowed_pages.map(function (page) {
        return String(page).trim().toLowerCase();
      })
    : [];

  /* Role missing */

  if (!role) {
    alert("Your account does not have an access role.");

    sessionStorage.removeItem("yugemUser");

    window.location.href = "login.html";

    return;
  }

  /* No pages configured */

  if (allowedPages.length === 0) {
    alert("No pages are configured for your account.");

    window.location.href = "login.html";

    return;
  }

  /* Current page permission check */

  if (!allowedPages.includes(currentPage)) {
    alert("You do not have permission to access this page.");

    window.location.href = allowedPages[0] || "login.html";

    return;
  }

  /*
   * Save normalized access information.
   * Existing yugemUser data is preserved.
   */

  user.role = role;

  user.allowed_pages = allowedPages;

  sessionStorage.setItem("yugemUser", JSON.stringify(user));
})();

/* =========================================================
   DOM CONTENT LOADED
========================================================= */

document.addEventListener("DOMContentLoaded", async function () {
  /* =====================================================
       WAIT FOR LATEST ACCESS CHECK
    ===================================================== */

  if (window.yugemAccessReady) {
    await window.yugemAccessReady;
  }

 /* =====================================================
   MOBILE MENU
   GLOBAL SIDEBAR + OVERLAY CONTROL
   ===================================================== */

const menuToggle = document.getElementById("menuToggle");

const sidebar =
  document.getElementById("sidebar") ||
  document.querySelector(".sidebar");

const sidebarOverlay =
  document.getElementById("sidebarOverlay");


/* =====================================================
   FORCE INITIAL CLOSED STATE
   Prevent any old inline HTML handler/state
   from leaving the overlay visible.
===================================================== */

function closeSidebar() {

  if (sidebar) {
    sidebar.classList.remove("active");
  }

  if (sidebarOverlay) {
    sidebarOverlay.style.display = "none";
    sidebarOverlay.style.visibility = "hidden";
    sidebarOverlay.style.opacity = "0";
    sidebarOverlay.style.pointerEvents = "none";
  }

  document.body.classList.remove("sidebar-open");
}


/* =====================================================
   OPEN SIDEBAR
===================================================== */

function openSidebar() {

  if (window.innerWidth > 768) {
    return;
  }

  if (sidebar) {
    sidebar.classList.add("active");
  }

  if (sidebarOverlay) {
    sidebarOverlay.style.display = "block";
    sidebarOverlay.style.visibility = "visible";
    sidebarOverlay.style.opacity = "1";
    sidebarOverlay.style.pointerEvents = "auto";
  }

  document.body.classList.add("sidebar-open");
}


/* =====================================================
   INITIAL STATE
===================================================== */

closeSidebar();


/* =====================================================
   MENU BUTTON
===================================================== */

if (menuToggle && sidebar) {

  menuToggle.addEventListener("click", function (event) {

    event.preventDefault();
    event.stopPropagation();

    if (window.innerWidth <= 768) {

      if (sidebar.classList.contains("active")) {
        closeSidebar();
      } else {
        openSidebar();
      }

    }

  });

}


/* =====================================================
   OVERLAY CLICK
===================================================== */

if (sidebarOverlay) {

  sidebarOverlay.addEventListener("click", function (event) {

    event.preventDefault();
    event.stopPropagation();

    closeSidebar();

  });

}


/* =====================================================
   SIDEBAR LINK CLICK
===================================================== */

if (sidebar) {

  sidebar.querySelectorAll("a").forEach(function (link) {

    link.addEventListener("click", function () {

      if (window.innerWidth <= 768) {
        closeSidebar();
      }

    });

  });

}


/* =====================================================
   OUTSIDE CLICK
===================================================== */

document.addEventListener("click", function (event) {

  if (
    window.innerWidth <= 768 &&
    sidebar &&
    sidebar.classList.contains("active") &&
    !sidebar.contains(event.target) &&
    !menuToggle?.contains(event.target) &&
    !sidebarOverlay?.contains(event.target)
  ) {

    closeSidebar();

  }

});


/* =====================================================
   RESIZE PROTECTION
===================================================== */

window.addEventListener("resize", function () {

  if (window.innerWidth > 768) {
    closeSidebar();
  }

});
  /* =====================================================
     GLOBAL OVERLAY PROTECTION

     Existing HTML pages mein bhi sidebarOverlay ka
     inline JavaScript hai.

     Ye observer ensure karega ki:
     - desktop par overlay kabhi visible na rahe
     - sidebar inactive hone par overlay hidden rahe
     - mobile sidebar active hone par hi overlay visible rahe
  ===================================================== */

  if (sidebarOverlay && sidebar) {
    const overlayObserver = new MutationObserver(function () {
      /*
       * Desktop:
       * overlay ALWAYS hidden.
       */

      if (window.innerWidth > 768) {
        if (
          sidebarOverlay.style.display !== "none" ||
          sidebarOverlay.style.opacity !== "0" ||
          sidebarOverlay.style.visibility !== "hidden" ||
          sidebarOverlay.style.pointerEvents !== "none"
        ) {
          closeSidebar();
        }

        return;
      }

      /*
       * Mobile:
       * Sidebar active hai to overlay visible.
       */

      if (sidebar.classList.contains("active")) {
        sidebarOverlay.style.display = "block";
        sidebarOverlay.style.opacity = "1";
        sidebarOverlay.style.visibility = "visible";
        sidebarOverlay.style.pointerEvents = "auto";
      } else {
        sidebarOverlay.style.display = "none";
        sidebarOverlay.style.opacity = "0";
        sidebarOverlay.style.visibility = "hidden";
        sidebarOverlay.style.pointerEvents = "none";
      }
    });

    overlayObserver.observe(sidebar, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // overlayObserver.observe(sidebarOverlay, {
    //   attributes: true,
    //   attributeFilter: ["style"],
    // });
  }

  /* =====================================================
       ROLE BASED SIDEBAR VISIBILITY
       EMPLOYEE = New Payment + Logout only
    ===================================================== */

  let loggedInUser = null;

  try {
    loggedInUser = JSON.parse(sessionStorage.getItem("yugemUser") || "null");
  } catch (error) {
    console.error("Invalid yugemUser:", error);
  }

  if (loggedInUser) {
    /* ===================================================
         GET USER ROLE
      =================================================== */

    const role = String(loggedInUser.role || "")
      .trim()
      .toUpperCase();

    /* ===================================================
         SIDEBAR MENU
      =================================================== */

    const sidebarMenu = document.querySelector(".sidebar-menu");

    /* ===================================================
         ADMIN - USER ACCESS LINK
      =================================================== */

    if (role === "ADMIN" && sidebarMenu) {
      let userAccessLink = sidebarMenu.querySelector(
        'a[href="admin-access.html"]',
      );

      /*
       * User Access link agar HTML me
       * already nahi hai to automatically
       * create karo.
       */

      if (!userAccessLink) {
        userAccessLink = document.createElement("a");

        userAccessLink.href = "admin-access.html";

        userAccessLink.innerHTML = `
            <span>⚙</span>
            <span>User Access</span>
          `;

        /*
         * Logout ke just pehle
         * User Access add karo.
         */

        const logoutButton = sidebarMenu.querySelector(".logout-btn");

        if (logoutButton) {
          sidebarMenu.insertBefore(userAccessLink, logoutButton);
        } else {
          sidebarMenu.appendChild(userAccessLink);
        }
      }

      /*
       * User Access visible rakho.
       */

      userAccessLink.style.display = "flex";

      /*
       * Agar current page
       * admin-access.html hai to active.
       */

      const sidebarCurrentPage = window.location.pathname
        .split("/")
        .pop()
        .toLowerCase();

      if (sidebarCurrentPage === "admin-access.html") {
        userAccessLink.classList.add("active");
      }
    }

    /* ===================================================
         ALL SIDEBAR LINKS
      =================================================== */

    const sidebarLinks = document.querySelectorAll(".sidebar-menu a");

    sidebarLinks.forEach(function (link) {
      const href = (link.getAttribute("href") || "")
        .split("?")[0]
        .split("#")[0]
        .toLowerCase();

      /* ===============================================
             EMPLOYEE
             ONLY NEW PAYMENT + LOGOUT
          =============================================== */

      if (role === "EMPLOYEE") {
        const isNewPayment = href === "payment-entry.html";

        const isLogout =
          link.classList.contains("logout-btn") || href === "login.html";

        if (!isNewPayment && !isLogout) {
          link.style.display = "none";
        }
      }

      /* ===============================================
             ADMIN
             ALL LINKS SHOW
          =============================================== */

      if (role === "ADMIN") {
        link.style.display = "";
      }
    });
  }

  /* =====================================================
       FILE NAME
    ===================================================== */

  const fileInputs = document.querySelectorAll('input[type="file"]');

  fileInputs.forEach(function (input) {
    input.addEventListener("change", function () {
      const outputId = input.dataset.filename;

      if (!outputId) {
        return;
      }

      const output = document.getElementById(outputId);

      if (!output) {
        return;
      }

      if (input.files.length === 0) {
        output.textContent = "";

        return;
      }

      if (input.files.length === 1) {
        output.textContent = input.files[0].name;
      } else {
        output.textContent = input.files.length + " files selected";
      }
    });
  });

  /* =====================================================
       LOGOUT
    ===================================================== */

  const logoutButtons = document.querySelectorAll(".logout-btn");

  logoutButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      sessionStorage.removeItem("yugemUser");

      sessionStorage.removeItem("yugemAuthToken");
    });
  });
});

/* =========================================================
   API REQUEST
========================================================= */

async function apiRequest(url, options = {}) {
  const response = await fetch(url, options);

  let data;

  const contentType = response.headers.get("content-type");

  if (contentType && contentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    throw new Error(data?.message || data?.error || "Request failed");
  }

  return data;
}

/* =========================================================
   ALERT
========================================================= */

function showAlert(message, type = "success") {
  const existing = document.querySelector(".dynamic-alert");

  if (existing) {
    existing.remove();
  }

  const alert = document.createElement("div");

  alert.className = "alert alert-" + type + " dynamic-alert";

  alert.textContent = message;

  const container = document.querySelector(".content-wrapper") || document.body;

  container.prepend(alert);

  setTimeout(function () {
    alert.remove();
  }, 4000);
}

/* =========================================================
   BUTTON LOADING
========================================================= */

function setButtonLoading(button, loading) {
  if (!button) {
    return;
  }

  if (loading) {
    button.dataset.originalText = button.innerHTML;

    button.disabled = true;

    button.innerHTML = `
      <span class="spinner"></span>
      Processing...
    `;
  } else {
    button.disabled = false;

    if (button.dataset.originalText) {
      button.innerHTML = button.dataset.originalText;
    }
  }
}
