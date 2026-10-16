/* =========================================================
   YUGEM - ADMIN USER ACCESS
========================================================= */

document.addEventListener("DOMContentLoaded", function () {
  /* =====================================================
       CURRENT USER / ADMIN CHECK
    ===================================================== */

  const currentUser = JSON.parse(sessionStorage.getItem("yugemUser") || "null");

  console.log("ADMIN ACCESS - currentUser:", currentUser);
  console.log("ADMIN ACCESS - role:", currentUser?.role);
  console.log("ADMIN ACCESS - access_role:", currentUser?.access_role);

  const currentRole = String(
    currentUser?.role || currentUser?.access_role || "",
  )
    .trim()
    .toUpperCase();

  if (!currentUser || currentRole !== "ADMIN") {
    alert("Admin access required.");
    window.location.href = "index.html";
    return;
  }
  /* =====================================================
       TAB-SPECIFIC ADMIN API
  ===================================================== */

  function adminApiFetch(url, options = {}) {
    const token = sessionStorage.getItem("yugemAuthToken");

    if (!token) {
      throw new Error("Authentication token not found. Please login again.");
    }

    const headers = {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    };

    return fetch(url, {
      ...options,
      headers: headers,
      credentials: "same-origin",
    });
  }

  /* =====================================================
       DOM ELEMENTS
    ===================================================== */

  const tableBody = document.getElementById("accessTableBody");

  const addUserBtn = document.getElementById("addUserBtn");

  const userModal = document.getElementById("userModal");

  const closeModalBtn = document.getElementById("closeUserModal");

  const cancelModalBtn = document.getElementById("cancelUserBtn");

  const userForm = document.getElementById("userForm");

  const modalTitle = document.getElementById("userModalTitle");

  const employeeIdInput = document.getElementById("formEmployeeId");

  const fullNameInput = document.getElementById("formFullName");

  const loginIdInput = document.getElementById("formLoginId");

  const passwordInput = document.getElementById("formPassword");

  const confirmPasswordInput = document.getElementById("formConfirmPassword");

  const contactNoInput = document.getElementById("formContactNo");

  const dbRoleInput = document.getElementById("formDbRole");

  const accessRoleInput = document.getElementById("formAccessRole");

  const statusInput = document.getElementById("formStatus");

  const formError = document.getElementById("userFormError");

  const saveUserBtn = document.getElementById("saveUserBtn");

  let editingUserId = null;
  function adminApiFetch(url, options = {}) {
    const token = sessionStorage.getItem("yugemAuthToken");

    if (!token) {
      throw new Error("Authentication token not found. Please login again.");
    }

    const headers = {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    };

    return fetch(url, {
      ...options,
      headers,
      credentials: "same-origin",
    });
  }

  /* =====================================================
       PAGE NAMES
    ===================================================== */

  const PAGE_NAMES = [
    {
      key: "index.html",
      label: "Dashboard",
    },
    {
      key: "payment-entry.html",
      label: "New Payment",
    },
    {
      key: "payment-entries.html",
      label: "Payment Entries",
    },
    {
      key: "report.html",
      label: "Reports",
    },
    {
      key: "admin-access.html",
      label: "User Access",
    },
  ];

  /* =====================================================
       MODAL FUNCTIONS
    ===================================================== */

  function showModal() {
    if (!userModal) {
      return;
    }

    userModal.style.display = "flex";
  }

  function hideModal() {
    if (userModal) {
      userModal.style.display = "none";
    }

    editingUserId = null;

    if (userForm) {
      userForm.reset();
    }

    if (employeeIdInput) {
      employeeIdInput.readOnly = false;
    }

    if (modalTitle) {
      modalTitle.textContent = "Add New User";
    }

    if (saveUserBtn) {
      saveUserBtn.textContent = "Create User";
    }

    if (formError) {
      formError.style.display = "none";
      formError.textContent = "";
    }

    document.querySelectorAll(".form-page-access").forEach(function (checkbox) {
      checkbox.checked = false;
    });
  }

  function showFormError(message) {
    if (!formError) {
      alert(message);
      return;
    }

    formError.textContent = message;
    formError.style.display = "block";
  }

  function clearFormError() {
    if (!formError) {
      return;
    }

    formError.textContent = "";
    formError.style.display = "none";
  }

  /* =====================================================
       PAGE ACCESS
    ===================================================== */

  function getSelectedPages() {
    const pages = [];

    document.querySelectorAll(".form-page-access").forEach(function (checkbox) {
      if (checkbox.checked) {
        pages.push(checkbox.value);
      }
    });

    return pages;
  }

  function setSelectedPages(pages) {
    const allowedPages = Array.isArray(pages) ? pages : [];

    document.querySelectorAll(".form-page-access").forEach(function (checkbox) {
      checkbox.checked = allowedPages.includes(checkbox.value);
    });
  }

  /* =====================================================
       SUMMARY
    ===================================================== */

  function updateSummary(users) {
    const totalUsersElement = document.getElementById("totalUsers");

    const adminUsersElement = document.getElementById("adminUsers");

    const employeeUsersElement = document.getElementById("employeeUsers");

    const noAccessUsersElement = document.getElementById("noAccessUsers");

    let adminCount = 0;
    let employeeCount = 0;
    let noAccessCount = 0;

    users.forEach(function (user) {
      const role = String(
        user.access_role || user.ACCESS_ROLE || "NO_ACCESS",
      ).toUpperCase();

      if (role === "ADMIN") {
        adminCount++;
      } else if (role === "EMPLOYEE") {
        employeeCount++;
      } else {
        noAccessCount++;
      }
    });

    if (totalUsersElement) {
      totalUsersElement.textContent = users.length;
    }

    if (adminUsersElement) {
      adminUsersElement.textContent = adminCount;
    }

    if (employeeUsersElement) {
      employeeUsersElement.textContent = employeeCount;
    }

    if (noAccessUsersElement) {
      noAccessUsersElement.textContent = noAccessCount;
    }
  }

  /* =====================================================
       HELPER FUNCTIONS
    ===================================================== */

  function escapeHtml(value) {
    const div = document.createElement("div");

    div.textContent = value == null ? "" : String(value);

    return div.innerHTML;
  }

  function getUserId(user) {
    return user.user_id ?? user.USER_ID;
  }

  function getEmployeeId(user) {
    return user.employee_id ?? user.EMPLOYEE_ID ?? "";
  }

  function getFullName(user) {
    return user.full_name ?? user.FULL_NAME ?? "";
  }

  function getLoginId(user) {
    return user.login_id ?? user.LOGIN_ID ?? "";
  }

  function getDbRole(user) {
    return user.role_name ?? user.ROLE_NAME ?? "";
  }

  function getAccessRole(user) {
    return user.access_role ?? user.ACCESS_ROLE ?? "NO_ACCESS";
  }

  function getStatus(user) {
    return user.is_active ?? user.IS_ACTIVE ?? "N";
  }

  function getContactNo(user) {
    return user.contact_no ?? user.CONTACT_NO ?? "";
  }

  function getAllowedPages(user) {
    return user.allowed_pages ?? user.ALLOWED_PAGES ?? [];
  }

  /* =====================================================
       TABLE CONTROLS
    ===================================================== */

  function renderRoleSelect(userId, accessRole) {
    return `
            <select
                class="access-role-select"
                data-user-id="${userId}"
            >
                <option
                    value="ADMIN"
                    ${accessRole === "ADMIN" ? "selected" : ""}
                >
                    ADMIN
                </option>

                <option
                    value="EMPLOYEE"
                    ${accessRole === "EMPLOYEE" ? "selected" : ""}
                >
                    EMPLOYEE
                </option>

                <option
                    value="NO_ACCESS"
                    ${accessRole === "NO_ACCESS" ? "selected" : ""}
                >
                    NO ACCESS
                </option>
            </select>
        `;
  }

  function renderStatusSelect(userId, status) {
    const active = String(status).toUpperCase() === "Y";

    return `
            <select
                class="status-select"
                data-user-id="${userId}"
            >
                <option
                    value="Y"
                    ${active ? "selected" : ""}
                >
                    ACTIVE
                </option>

                <option
                    value="N"
                    ${!active ? "selected" : ""}
                >
                    INACTIVE
                </option>
            </select>
        `;
  }

  function renderPageCheckboxes(userId, allowedPages) {
    const pages = Array.isArray(allowedPages) ? allowedPages : [];

    return `
            <div class="row-page-access">

                ${PAGE_NAMES.map(function (page) {
                  return `
                        <label
                            style="
                                display:block;
                                margin-bottom:4px;
                            "
                        >

                            <input
                                type="checkbox"
                                class="row-page-checkbox"
                                data-user-id="${userId}"
                                value="${page.key}"
                                ${pages.includes(page.key) ? "checked" : ""}
                            >

                            ${escapeHtml(page.label)}

                        </label>
                    `;
                }).join("")}

            </div>
        `;
  }

  function renderActionButtons(user) {
    const userId = getUserId(user);

    const active = String(getStatus(user)).toUpperCase() === "Y";

    return `
            <div class="action-buttons">

                <button
                    type="button"
                    class="edit-user-btn action-btn"
                    data-user-id="${userId}"
                >
                    Edit
                </button>


                <button
                    type="button"
                    class="${
                      active ? "deactivate-user-btn" : "activate-user-btn"
                    } action-btn toggle-user-btn"
                    data-user-id="${userId}"
                    data-action="${active ? "deactivate" : "activate"}"
                >
                    ${active ? "Deactivate" : "Activate"}
                </button>


                <button
                    type="button"
                    class="btn-primary action-btn save-access-btn"
                    data-user-id="${userId}"
                >
                    Save Access
                </button>

            </div>
        `;
  }

  /* =====================================================
       RENDER USERS
    ===================================================== */

  function renderUsers(users) {
    if (!tableBody) {
      return;
    }

    tableBody.innerHTML = "";

    if (!Array.isArray(users) || users.length === 0) {
      tableBody.innerHTML = `
                <tr>
                    <td
                        colspan="9"
                        class="empty-row"
                    >
                        No users found.
                    </td>
                </tr>
            `;

      updateSummary([]);

      return;
    }

    users.forEach(function (user) {
      const userId = getUserId(user);

      const employeeId = getEmployeeId(user);

      const fullName = getFullName(user);

      const loginId = getLoginId(user);

      const dbRole = getDbRole(user);

      const accessRole = getAccessRole(user);

      const status = getStatus(user);

      const allowedPages = getAllowedPages(user);

      const row = document.createElement("tr");

      const allowedPageNames =
        Array.isArray(allowedPages) && allowedPages.length
          ? allowedPages
              .map(function (page) {
                const found = PAGE_NAMES.find(function (item) {
                  return item.key === page;
                });

                return found ? found.label : page;
              })
              .join(", ")
          : "No Pages";

      row.innerHTML = `

                <td>
                    ${escapeHtml(employeeId)}
                </td>


                <td>
                    ${escapeHtml(fullName)}
                </td>


                <td>
                    ${escapeHtml(loginId)}
                </td>


                <td>
                    ${escapeHtml(dbRole)}
                </td>


                <td>
                    ${renderRoleSelect(userId, accessRole)}
                </td>


                <td>
                    ${renderPageCheckboxes(userId, allowedPages)}
                </td>


                <td>
                    ${escapeHtml(allowedPageNames)}
                </td>


                <td>
                    ${renderStatusSelect(userId, status)}
                </td>


                <td>
                    ${renderActionButtons(user)}
                </td>

            `;

      tableBody.appendChild(row);
    });

    updateSummary(users);
  }

  /* =====================================================
       LOAD USER ACCESS
    ===================================================== */

  async function loadUserAccess() {
    try {
      const response = await adminApiFetch("/api/admin/user-access", {
        method: "GET",
        credentials: "same-origin",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || data.error || "Unable to load user access.",
        );
      }

      const users = data.users || data.data || [];

      renderUsers(users);
    } catch (error) {
      console.error("User access load error:", error);

      if (tableBody) {
        tableBody.innerHTML = `
                    <tr>
                        <td
                            colspan="9"
                            class="empty-row"
                        >
                            Failed to load user access.
                        </td>
                    </tr>
                `;
      }

      alert(error.message || "Failed to load user access.");
    }
  }

  /* =====================================================
       SAVE ACCESS
    ===================================================== */

  async function saveAccess(userId) {
    const roleSelect = document.querySelector(
      `.access-role-select[data-user-id="${userId}"]`,
    );

    const statusSelect = document.querySelector(
      `.status-select[data-user-id="${userId}"]`,
    );

    const pageCheckboxes = document.querySelectorAll(
      `.row-page-checkbox[data-user-id="${userId}"]`,
    );

    const accessRole = roleSelect ? roleSelect.value : "NO_ACCESS";

    const isActive = statusSelect ? statusSelect.value : "N";

    const allowedPages = [];

    pageCheckboxes.forEach(function (checkbox) {
      if (checkbox.checked) {
        allowedPages.push(checkbox.value);
      }
    });

    if (accessRole === "NO_ACCESS") {
      allowedPages.length = 0;
    }

    try {
      const response = await adminApiFetch(`/api/admin/user-access/${userId}`, {
        method: "PUT",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          access_role: accessRole,

          is_active: isActive,

          allowed_pages: allowedPages,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Failed to save access.");
      }

      alert("User access saved successfully.");

      await loadUserAccess();
    } catch (error) {
      console.error("Save access error:", error);

      alert(error.message || "Failed to save access.");
    }
  }

  /* =====================================================
       ADD USER
    ===================================================== */

  function openAddUserModal() {
    editingUserId = null;

    clearFormError();

    if (modalTitle) {
      modalTitle.textContent = "Add New User";
    }

    if (saveUserBtn) {
      saveUserBtn.textContent = "Create User";
    }

    if (userForm) {
      userForm.reset();
    }

    if (employeeIdInput) {
      employeeIdInput.readOnly = false;
    }

    if (accessRoleInput) {
      accessRoleInput.value = "EMPLOYEE";
    }

    if (statusInput) {
      statusInput.value = "Y";
    }

    document.querySelectorAll(".form-page-access").forEach(function (checkbox) {
      checkbox.checked = false;
    });

    showModal();
  }

  /* =====================================================
       EDIT USER
    ===================================================== */

  async function openEditUserModal(userId) {
    try {
      const response = await adminApiFetch("/api/admin/user-access", {
        method: "GET",
        credentials: "same-origin",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Unable to load user.");
      }

      const users = data.users || data.data || [];

      const user = users.find(function (item) {
        return String(getUserId(item)) === String(userId);
      });

      if (!user) {
        throw new Error("User not found.");
      }

      editingUserId = userId;

      clearFormError();

      if (modalTitle) {
        modalTitle.textContent = "Edit User";
      }

      if (saveUserBtn) {
        saveUserBtn.textContent = "Update User";
      }

      if (employeeIdInput) {
        employeeIdInput.value = getEmployeeId(user);

        employeeIdInput.readOnly = true;
      }

      if (fullNameInput) {
        fullNameInput.value = getFullName(user);
      }

      if (loginIdInput) {
        loginIdInput.value = getLoginId(user);
      }

      if (passwordInput) {
        passwordInput.value = "";
      }

      if (confirmPasswordInput) {
        confirmPasswordInput.value = "";
      }

      if (contactNoInput) {
        contactNoInput.value = getContactNo(user);
      }

      if (dbRoleInput) {
        dbRoleInput.value = getDbRole(user);
      }

      if (accessRoleInput) {
        accessRoleInput.value = getAccessRole(user);
      }

      if (statusInput) {
        statusInput.value =
          String(getStatus(user)).toUpperCase() === "Y" ? "Y" : "N";
      }

      setSelectedPages(getAllowedPages(user));

      showModal();
    } catch (error) {
      console.error("Edit user error:", error);

      alert(error.message || "Failed to load user.");
    }
  }

  /* =====================================================
       ADD / EDIT USER SUBMIT
    ===================================================== */

  async function submitUserForm(event) {
    event.preventDefault();

    clearFormError();

    const employeeId = employeeIdInput ? employeeIdInput.value.trim() : "";

    const fullName = fullNameInput ? fullNameInput.value.trim() : "";

    const loginId = loginIdInput ? loginIdInput.value.trim() : "";

    const password = passwordInput ? passwordInput.value : "";

    const confirmPassword = confirmPasswordInput
      ? confirmPasswordInput.value
      : "";

    const contactNo = contactNoInput ? contactNoInput.value.trim() : "";

    const dbRole = dbRoleInput ? dbRoleInput.value.trim() : "";

    const accessRole = accessRoleInput ? accessRoleInput.value : "NO_ACCESS";

    const isActive = statusInput ? statusInput.value : "Y";

    const allowedPages = getSelectedPages();

    if (!employeeId) {
      showFormError("Employee ID is required.");

      return;
    }

    if (!fullName) {
      showFormError("Full Name is required.");

      return;
    }

    if (!loginId) {
      showFormError("Login ID is required.");

      return;
    }

    if (!editingUserId && !password) {
      showFormError("Password is required for new user.");

      return;
    }

    if (password || confirmPassword) {
      if (password !== confirmPassword) {
        showFormError("Password and Confirm Password do not match.");

        return;
      }
    }

    if (!dbRole) {
      showFormError("DB Role is required.");

      return;
    }

    if (accessRole === "NO_ACCESS") {
      allowedPages.length = 0;
    }

    const payload = {
      employee_id: employeeId,

      full_name: fullName,

      login_id: loginId,

      contact_no: contactNo,

      role_name: dbRole,

      db_role: dbRole,

      access_role: accessRole,

      is_active: isActive,

      allowed_pages: allowedPages,
    };

    if (password) {
      payload.password = password;
    }

    try {
      let response;

      if (editingUserId) {
        response = await adminApiFetch(`/api/admin/users/${editingUserId}`, {
          method: "PUT",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
      } else {
        response = await adminApiFetch("/api/admin/users", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Failed to save user.");
      }

      alert(
        editingUserId
          ? "User updated successfully."
          : "New user created successfully.",
      );

      hideModal();

      await loadUserAccess();
    } catch (error) {
      console.error("User save error:", error);

      showFormError(error.message || "Failed to save user.");
    }
  }

  /* =====================================================
       ACTIVATE / DEACTIVATE
    ===================================================== */

  async function toggleUserStatus(userId, action) {
    const actionText = action === "deactivate" ? "deactivate" : "activate";

    const confirmed = confirm(
      `Are you sure you want to ${actionText} this user?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await adminApiFetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: action,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || data.error || `Failed to ${actionText} user.`,
        );
      }

      alert(
        action === "deactivate"
          ? "User deactivated successfully."
          : "User activated successfully.",
      );

      await loadUserAccess();
    } catch (error) {
      console.error("Toggle user status error:", error);

      alert(error.message || `Failed to ${actionText} user.`);
    }
  }

  /* =====================================================
       BUTTON EVENTS
    ===================================================== */

  if (addUserBtn) {
    addUserBtn.addEventListener("click", openAddUserModal);
  }

  if (closeModalBtn) {
    closeModalBtn.addEventListener("click", hideModal);
  }

  if (cancelModalBtn) {
    cancelModalBtn.addEventListener("click", hideModal);
  }

  /* =====================================================
       CLOSE MODAL OUTSIDE
    ===================================================== */

  if (userModal) {
    userModal.addEventListener("click", function (event) {
      if (event.target === userModal) {
        hideModal();
      }
    });
  }

  /* =====================================================
       FORM SUBMIT
    ===================================================== */

  if (userForm) {
    userForm.addEventListener("submit", submitUserForm);
  }

  /* =====================================================
       TABLE BUTTON EVENTS
    ===================================================== */

  if (tableBody) {
    tableBody.addEventListener("click", function (event) {
      const editButton = event.target.closest(".edit-user-btn");

      if (editButton) {
        const userId = editButton.dataset.userId;

        if (userId) {
          openEditUserModal(userId);
        }

        return;
      }

      const toggleButton = event.target.closest(".toggle-user-btn");

      if (toggleButton) {
        const userId = toggleButton.dataset.userId;

        const action = toggleButton.dataset.action;

        if (userId && action) {
          toggleUserStatus(userId, action);
        }

        return;
      }

      const saveButton = event.target.closest(".save-access-btn");

      if (saveButton) {
        const userId = saveButton.dataset.userId;

        if (userId) {
          saveAccess(userId);
        }
      }
    });
  }

  /* =====================================================
       ACCESS ROLE CHANGE
    ===================================================== */

  if (tableBody) {
    tableBody.addEventListener("change", function (event) {
      if (event.target.classList.contains("access-role-select")) {
        const userId = event.target.dataset.userId;

        if (event.target.value === "NO_ACCESS") {
          document
            .querySelectorAll(`.row-page-checkbox[data-user-id="${userId}"]`)
            .forEach(function (checkbox) {
              checkbox.checked = false;
            });
        }
      }
    });
  }

  /* =====================================================
       INITIAL LOAD
    ===================================================== */

  loadUserAccess();
});
