/* =========================================================
   YUGEM - LOGIN JS
========================================================= */

document.addEventListener("DOMContentLoaded", function () {
  /* =====================================================
        PASSWORD SHOW / HIDE
  ===================================================== */

  const passwordInput = document.getElementById("password");
  const passwordToggle = document.getElementById("passwordToggle");
  const toggleIcon = document.getElementById("toggleIcon");

  if (passwordInput && passwordToggle && toggleIcon) {
    passwordToggle.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();

      const isPassword = passwordInput.type === "password";

      if (isPassword) {
        passwordInput.type = "text";
        toggleIcon.className = "bi bi-eye-slash-fill";
        passwordToggle.setAttribute("aria-label", "Hide password");
      } else {
        passwordInput.type = "password";
        toggleIcon.className = "bi bi-eye-fill";
        passwordToggle.setAttribute("aria-label", "Show password");
      }
    });
  }

  /* =====================================================
        LOGIN FORM
  ===================================================== */

  const loginForm = document.getElementById("loginForm");

  if (!loginForm) {
    return;
  }

  const loginIdInput = document.getElementById("loginId");

  /* =====================================================
        LOGIN SUBMIT
  ===================================================== */

  loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const loginId = loginIdInput ? loginIdInput.value.trim() : "";
    const passwordValue = passwordInput ? passwordInput.value : "";

    if (!loginId) {
      showLoginMessage("Please enter Login ID.", "danger");
      return;
    }

    if (!passwordValue) {
      showLoginMessage("Please enter password.", "danger");
      return;
    }

    const button = loginForm.querySelector("button[type='submit']");

    if (button) {
      button.disabled = true;
      button.textContent = "Logging in...";
    }

    try {
      const response = await fetch("/api/login", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          login_id: loginId,
          password: passwordValue,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.status !== "success") {
        throw new Error(data.message || "Invalid Login ID or Password.");
      }

      /* =================================================
            SAVE COMPLETE LOGGED-IN USER
      ================================================= */

      const user = {
        user_id: data.user_id ?? data.user?.user_id ?? data.user?.id,

        bde_user_id: data.user_id ?? data.user?.user_id ?? data.user?.id,

        employee_id: data.employee_id ?? data.user?.employee_id ?? "",

        login_id: data.login_id ?? data.user?.login_id ?? loginId,

        name:
          data.full_name ??
          data.name ??
          data.user?.full_name ??
          data.user?.name ??
          loginId,

        role: data.role ?? data.user?.role ?? "",

        allowed_pages: Array.isArray(data.allowed_pages)
          ? data.allowed_pages
          : Array.isArray(data.user?.allowed_pages)
            ? data.user.allowed_pages
            : [],
      };

      /* =================================================
            SAFETY CHECK
      ================================================= */

      if (!user.bde_user_id) {
        console.error("Login response does not contain user ID:", data);

        throw new Error(
          "Login successful, but User ID was not returned by server.",
        );
      }

      if (!user.role) {
        console.error("Login response does not contain role:", data);

        throw new Error(
          "Login successful, but user access role was not returned by server.",
        );
      }

      if (
        !Array.isArray(user.allowed_pages) ||
        user.allowed_pages.length === 0
      ) {
        console.error("Login response does not contain allowed pages:", data);

        throw new Error(
          "Login successful, but no pages are configured for this account.",
        );
      }

      if (!data.auth_token) {
        throw new Error(
          "Login successful, but authentication token was not returned by server.",
        );
      }

      /* =================================================
            SAVE USER SESSION
      ================================================= */

      sessionStorage.setItem("yugemAuthToken", data.auth_token);
      sessionStorage.setItem("yugemUser", JSON.stringify(user));

      console.log("YUGEM login successful:", user);

      /* =================================================
            REDIRECT
      ================================================= */

      window.location.href = "payment-entry.html";
    } catch (error) {
      console.error("Login error:", error);

      showLoginMessage(error.message || "Unable to login.", "danger");

      if (button) {
        button.disabled = false;
        button.textContent = "Login";
      }
    }
  });
});

/* =========================================================
   LOGIN MESSAGE
========================================================= */

function showLoginMessage(message, type) {
  const container = document.getElementById("loginMessage");

  if (!container) {
    return;
  }

  container.innerHTML = `
        <div class="alert alert-${type}">
            ${message}
        </div>
    `;
}
