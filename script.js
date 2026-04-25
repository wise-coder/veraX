const rootElement = document.documentElement;
const themeToggle = document.querySelector("[data-theme-toggle]");
const API_BASE_URL = `${window.location.protocol}//${window.location.hostname}:5000/api`;
const AUTH_TOKEN_KEY = "token";
const AUTH_USER_KEY = "user";
const PROFILE_PREFS_KEY = "profilePrefs";
const PARKED_CAR_IMAGE = "images/occupied space.png";
const currentPage = window.location.pathname.split("/").pop() || "index.html";
const publicPages = new Set(["index.html", "login.html", "signup.html", ""]);

const pageState = {
  currentUser: null,
  dashboard: {
    overview: null,
  },
  vehicles: {
    page: 1,
    limit: 10,
    search: "",
  },
  slots: {
    page: 1,
    limit: 20,
    search: "",
    selectedSlot: null,
  },
  transactions: {
    page: 1,
    limit: 10,
    search: "",
    type: "",
    status: "",
  },
  payments: {
    page: 1,
    limit: 10,
    search: "",
    status: "",
    paymentMethod: "",
  },
  reports: {
    startDate: "",
    endDate: "",
    parkingSlot: "",
    paymentMethod: "",
  },
};

const syncLegacyTheme = () => {
  try {
    const legacyTheme = localStorage.getItem("parkflow-theme");
    const currentTheme = localStorage.getItem("theme");

    if (!currentTheme && legacyTheme) {
      localStorage.setItem("theme", legacyTheme);
    }
  } catch {
    // Ignore storage access issues.
  }
};

const getInitialTheme = () => {
  syncLegacyTheme();
  const activeTheme = rootElement.getAttribute("data-theme");

  if (activeTheme === "dark" || activeTheme === "light") {
    return activeTheme;
  }

  try {
    return localStorage.getItem("theme") || "light";
  } catch {
    return "light";
  }
};

const updateThemeToggle = (theme) => {
  if (!themeToggle) {
    return;
  }

  const nextTheme = theme === "dark" ? "light" : "dark";
  const themeLabel = themeToggle.querySelector("[data-theme-label]");

  themeToggle.setAttribute("aria-pressed", String(theme === "dark"));
  themeToggle.setAttribute("aria-label", `Switch to ${nextTheme} mode`);

  if (themeLabel) {
    themeLabel.textContent = `${nextTheme.charAt(0).toUpperCase()}${nextTheme.slice(1)} Mode`;
  }
};

const applyTheme = (theme) => {
  rootElement.setAttribute("data-theme", theme);
  updateThemeToggle(theme);
};

applyTheme(getInitialTheme());

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const nextTheme = rootElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(nextTheme);

    try {
      localStorage.setItem("theme", nextTheme);
      localStorage.setItem("parkflow-theme", nextTheme);
    } catch {
      // Ignore storage errors.
    }
  });
}

const revealElements = document.querySelectorAll(".reveal-up, .reveal-scale");

if (revealElements.length) {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) {
        return;
      }

      const delay = Number(entry.target.dataset.delay || 0);

      window.setTimeout(() => {
        entry.target.classList.add("is-visible");
      }, delay);

      observer.unobserve(entry.target);
    });
  }, {
    threshold: 0.18,
  });

  revealElements.forEach((element) => revealObserver.observe(element));
}

document.querySelectorAll("[data-toggle-password]").forEach((toggle) => {
  toggle.addEventListener("click", () => {
    const input = document.getElementById(toggle.dataset.togglePassword);

    if (!input) {
      return;
    }

    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";
    toggle.textContent = isPassword ? "Hide" : "Show";
  });
});

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

const getProfilePrefs = () => {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_PREFS_KEY) || "{}");
  } catch {
    return {};
  }
};

const saveProfilePrefs = (prefs) => {
  try {
    localStorage.setItem(PROFILE_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage errors.
  }
};

const getMergedUserProfile = (user) => {
  if (!user?.id) {
    return user;
  }

  const prefs = getProfilePrefs();
  const saved = prefs[user.id] || {};

  return {
    ...user,
    fullName: saved.fullName || user.fullName,
    phone: saved.phone || user.phone,
    profileImage: saved.profileImage || "",
  };
};

const formatCurrency = (value) => {
  const amount = Number(value || 0);
  return `$ ${amount.toFixed(2)}`;
};

const formatDateTime = (value) => {
  if (!value) {
    return "N/A";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "N/A";
  }

  return parsedDate.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatDuration = (entryTime, exitTime = new Date()) => {
  if (!entryTime) {
    return "N/A";
  }

  const start = new Date(entryTime);
  const end = new Date(exitTime);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return "N/A";
  }

  const totalMinutes = Math.max(Math.floor((end.getTime() - start.getTime()) / 60000), 0);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes}m`;
};

const showAlert = (message, type = "success") => {
  let container = document.getElementById("globalAlertContainer");

  if (!container) {
    container = document.createElement("div");
    container.id = "globalAlertContainer";
    container.className = "position-fixed top-0 end-0 p-3";
    container.style.zIndex = "2000";
    document.body.appendChild(container);
  }

  const alert = document.createElement("div");
  alert.className = `alert alert-${type} alert-dismissible fade show shadow`;
  alert.role = "alert";
  alert.innerHTML = `
    ${escapeHtml(message)}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;

  container.appendChild(alert);

  window.setTimeout(() => {
    alert.remove();
  }, 4000);
};

const isProtectedPage = () => !publicPages.has(currentPage);

const getToken = () => {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
};

const setAuthSession = (token, user) => {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  pageState.currentUser = user;
};

const clearAuthSession = () => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  pageState.currentUser = null;
};

const redirectToLogin = () => {
  clearAuthSession();
  window.location.href = "login.html";
};

const buildQuery = (params = {}) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
};

const apiRequest = async (endpoint, options = {}) => {
  const {
    auth = true,
    method = "GET",
    body,
    headers = {},
    responseType = "json",
  } = options;

  const requestHeaders = {
    ...headers,
  };

  if (auth) {
    const token = getToken();

    if (!token) {
      redirectToLogin();
      throw new Error("Authentication required");
    }

    requestHeaders.Authorization = `Bearer ${token}`;
  }

  if (body !== undefined && !(body instanceof FormData)) {
    requestHeaders["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: requestHeaders,
    body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });

  let payload = null;

  if (responseType === "blob") {
    payload = await response.blob();
  } else {
    const text = await response.text();
    payload = text ? JSON.parse(text) : null;
  }

  if (!response.ok) {
    const message = payload?.message || `Request failed with status ${response.status}`;

    if (response.status === 401) {
      redirectToLogin();
    }

    throw new Error(message);
  }

  return payload;
};

const renderLoadingRow = (tbody, columns, message = "Loading...") => {
  if (!tbody) {
    return;
  }

  tbody.innerHTML = `<tr><td colspan="${columns}" class="text-center py-4">${escapeHtml(message)}</td></tr>`;
};

const renderEmptyState = (container, message) => {
  if (!container) {
    return;
  }

  container.innerHTML = `
    <div class="text-center py-4 text-muted">
      ${escapeHtml(message)}
    </div>
  `;
};

const updateAdminLabels = (user) => {
  const displayUser = getMergedUserProfile(user || {});

  document.querySelectorAll(".admin").forEach((adminBlock) => {
    const name = adminBlock.querySelector("strong");
    const role = adminBlock.querySelector("small");
    const avatar = adminBlock.querySelector(".avatar");

    if (name) {
      name.textContent = displayUser?.fullName || "User";
    }

    if (role) {
      role.textContent = displayUser?.role ? displayUser.role.charAt(0).toUpperCase() + displayUser.role.slice(1) : "Staff";
    }

    if (avatar) {
      avatar.innerHTML = displayUser?.profileImage
        ? `<img src="${displayUser.profileImage}" alt="${escapeHtml(displayUser.fullName || "Profile")}" class="profile-avatar-image">`
        : '<i class="bi bi-person-fill"></i>';
    }
  });
};

const syncProfileMenuContent = (adminBlock, menuId, user) => {
  const mergedUser = getMergedUserProfile(user || {});
  const menu = adminBlock.querySelector(".profile-menu");

  if (!menu) {
    return;
  }

  const headerAvatar = menu.querySelector(".profile-menu-avatar");
  const headerName = menu.querySelector(".profile-menu-header strong");
  const headerEmail = menu.querySelector(".profile-menu-header small");
  const nameInput = menu.querySelector(`#${menuId}Name`);
  const phoneInput = menu.querySelector(`#${menuId}Phone`);

  if (headerAvatar) {
    headerAvatar.innerHTML = mergedUser?.profileImage
      ? `<img src="${mergedUser.profileImage}" alt="${escapeHtml(mergedUser.fullName || "Profile")}" class="profile-avatar-image">`
      : '<i class="bi bi-person-fill"></i>';
  }

  if (headerName) {
    headerName.textContent = mergedUser?.fullName || "User";
  }

  if (headerEmail) {
    headerEmail.textContent = mergedUser?.email || "";
  }

  if (nameInput) {
    nameInput.value = mergedUser?.fullName || "";
    nameInput.setAttribute("value", mergedUser?.fullName || "");
  }

  if (phoneInput) {
    phoneInput.value = mergedUser?.phone || "";
    phoneInput.setAttribute("value", mergedUser?.phone || "");
  }
};

const initializeProfileMenu = () => {
  const adminBlocks = document.querySelectorAll(".admin");

  if (!adminBlocks.length) {
    return;
  }

  adminBlocks.forEach((adminBlock, index) => {
    const menuId = `profileMenu${index}`;

    if (adminBlock.dataset.profileReady) {
      syncProfileMenuContent(adminBlock, menuId, pageState.currentUser || {});
      return;
    }

    adminBlock.dataset.profileReady = "true";
    adminBlock.dataset.profileMenuId = menuId;
    adminBlock.setAttribute("role", "button");
    adminBlock.setAttribute("tabindex", "0");
    adminBlock.setAttribute("aria-expanded", "false");

    const mergedUser = getMergedUserProfile(pageState.currentUser || {});

    const menu = document.createElement("div");
    menu.className = "profile-menu";
    menu.id = menuId;
    menu.innerHTML = `
      <div class="profile-menu-card">
        <div class="profile-menu-header">
          <div class="profile-menu-avatar">
            ${mergedUser?.profileImage ? `<img src="${mergedUser.profileImage}" alt="${escapeHtml(mergedUser.fullName || "Profile")}" class="profile-avatar-image">` : '<i class="bi bi-person-fill"></i>'}
          </div>
          <div>
            <strong>${escapeHtml(mergedUser?.fullName || "User")}</strong>
            <small>${escapeHtml(mergedUser?.email || "")}</small>
          </div>
        </div>
        <p class="profile-menu-note">Customize your profile, upload a picture, or log out.</p>
        <label class="profile-upload-btn" for="${menuId}Upload">Upload Photo</label>
        <input type="file" id="${menuId}Upload" accept="image/*" hidden>
        <div class="profile-menu-field">
          <label for="${menuId}Name">Full Name</label>
          <input type="text" id="${menuId}Name" value="${escapeHtml(mergedUser?.fullName || "")}">
        </div>
        <div class="profile-menu-field">
          <label for="${menuId}Phone">Phone</label>
          <input type="text" id="${menuId}Phone" value="${escapeHtml(mergedUser?.phone || "")}">
        </div>
        <div class="profile-menu-actions">
          <button type="button" class="profile-save-btn">Save Changes</button>
          <button type="button" class="profile-logout-btn">Logout</button>
        </div>
      </div>
    `;

    adminBlock.appendChild(menu);

    const toggleMenu = (open) => {
      adminBlock.classList.toggle("profile-open", open);
      adminBlock.setAttribute("aria-expanded", String(open));
    };

    adminBlock.addEventListener("click", (event) => {
      event.stopPropagation();

      if (event.target.closest(".profile-menu")) {
        return;
      }

      const isOpen = adminBlock.classList.contains("profile-open");
      document.querySelectorAll(".admin.profile-open").forEach((block) => {
        block.classList.remove("profile-open");
        block.setAttribute("aria-expanded", "false");
      });
      toggleMenu(!isOpen);
    });

    adminBlock.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        adminBlock.click();
      }
    });

    menu.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    menu.querySelector(".profile-logout-btn")?.addEventListener("click", () => {
      clearAuthSession();
      window.location.href = "login.html";
    });

    menu.querySelector(".profile-save-btn")?.addEventListener("click", () => {
      const nameInput = menu.querySelector(`#${menuId}Name`);
      const phoneInput = menu.querySelector(`#${menuId}Phone`);
      const currentUser = pageState.currentUser;

      if (!currentUser?.id) {
        showAlert("Unable to save profile", "danger");
        return;
      }

      const prefs = getProfilePrefs();
      prefs[currentUser.id] = {
        ...(prefs[currentUser.id] || {}),
        fullName: nameInput?.value.trim() || currentUser.fullName,
        phone: phoneInput?.value.trim() || currentUser.phone,
      };
      saveProfilePrefs(prefs);

      pageState.currentUser = {
        ...currentUser,
        fullName: prefs[currentUser.id].fullName,
        phone: prefs[currentUser.id].phone,
      };

      try {
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(pageState.currentUser));
      } catch {
        // Ignore storage errors.
      }

      updateAdminLabels(pageState.currentUser);
      initializeProfileMenu();
      showAlert("Profile updated successfully");
      toggleMenu(false);
    });

    menu.querySelector(`#${menuId}Upload`)?.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      const currentUser = pageState.currentUser;

      if (!file || !currentUser?.id) {
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const prefs = getProfilePrefs();
        prefs[currentUser.id] = {
          ...(prefs[currentUser.id] || {}),
          profileImage: String(reader.result || ""),
        };
        saveProfilePrefs(prefs);
        updateAdminLabels(pageState.currentUser);
        initializeProfileMenu();
        showAlert("Profile image updated successfully");
        event.target.value = "";
      };
      reader.readAsDataURL(file);
    });
  });

  if (!document.body.dataset.profileOutsideBound) {
    document.body.dataset.profileOutsideBound = "true";
    document.addEventListener("click", () => {
      document.querySelectorAll(".admin.profile-open").forEach((block) => {
        block.classList.remove("profile-open");
        block.setAttribute("aria-expanded", "false");
      });
    });
  }
};

const initializeResponsiveSidebar = () => {
  const sidebar = document.querySelector(".sidebar");
  const menuTrigger = document.querySelector(".menu-toggle") || document.querySelector(".menu-icon");

  if (!sidebar || !menuTrigger) {
    return;
  }

  let overlay = document.querySelector(".sidebar-overlay");

  if (!overlay) {
    overlay = document.createElement("button");
    overlay.type = "button";
    overlay.className = "sidebar-overlay";
    overlay.setAttribute("aria-label", "Close navigation");
    document.body.appendChild(overlay);
  }

  const closeSidebar = () => {
    document.body.classList.remove("sidebar-open");
    menuTrigger.setAttribute("aria-expanded", "false");
  };

  const openSidebar = () => {
    document.body.classList.add("sidebar-open");
    menuTrigger.setAttribute("aria-expanded", "true");
  };

  if (!menuTrigger.dataset.sidebarReady) {
    menuTrigger.dataset.sidebarReady = "true";
    menuTrigger.setAttribute("role", "button");
    menuTrigger.setAttribute("tabindex", "0");
    menuTrigger.setAttribute("aria-expanded", "false");
    menuTrigger.setAttribute("aria-label", "Open navigation");

    menuTrigger.addEventListener("click", () => {
      if (window.innerWidth > 1100) {
        return;
      }

      if (document.body.classList.contains("sidebar-open")) {
        closeSidebar();
        return;
      }

      openSidebar();
    });

    menuTrigger.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        menuTrigger.click();
      }
    });
  }

  if (!overlay.dataset.sidebarReady) {
    overlay.dataset.sidebarReady = "true";
    overlay.addEventListener("click", closeSidebar);
  }

  if (!document.body.dataset.sidebarResizeReady) {
    document.body.dataset.sidebarResizeReady = "true";
    window.addEventListener("resize", () => {
      if (window.innerWidth > 1100) {
        closeSidebar();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeSidebar();
      }
    });
  }

  sidebar.querySelectorAll("a").forEach((link) => {
    if (link.dataset.sidebarCloseReady) {
      return;
    }

    link.dataset.sidebarCloseReady = "true";
    link.addEventListener("click", closeSidebar);
  });
};

const loadCurrentUser = async () => {
  if (!isProtectedPage()) {
    return null;
  }

  const cachedUser = localStorage.getItem(AUTH_USER_KEY);

  if (cachedUser && !pageState.currentUser) {
    try {
      pageState.currentUser = JSON.parse(cachedUser);
      updateAdminLabels(pageState.currentUser);
    } catch {
      // Ignore broken cache.
    }
  }

  try {
    const response = await apiRequest("/auth/me");
    const user = response.data;
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    pageState.currentUser = user;
    updateAdminLabels(user);
    return user;
  } catch (error) {
    showAlert(error.message, "danger");
    return null;
  }
};

const handleLogoutLinks = () => {
  document.querySelectorAll("[data-logout]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      clearAuthSession();
      window.location.href = "login.html";
    });
  });
};

const renderPagination = (container, pagination, onChange) => {
  if (!container || !pagination) {
    return;
  }

  const {
    page = 1,
    totalPages = 1,
  } = pagination;

  if (totalPages <= 1) {
    container.innerHTML = `
      <button type="button" class="active" aria-current="page">1</button>
    `;
    return;
  }

  let buttons = `
    <button type="button" data-page="${Math.max(page - 1, 1)}" ${page === 1 ? "disabled" : ""} aria-label="Previous page">
      <i class="bi bi-chevron-left"></i>
    </button>
  `;

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    buttons += `
      <button type="button" data-page="${pageNumber}" class="${pageNumber === page ? "active" : ""}" ${pageNumber === page ? 'aria-current="page"' : ""}>
        ${pageNumber}
      </button>
    `;
  }

  buttons += `
    <button type="button" data-page="${Math.min(page + 1, totalPages)}" ${page === totalPages ? "disabled" : ""} aria-label="Next page">
      <i class="bi bi-chevron-right"></i>
    </button>
  `;

  container.innerHTML = buttons;
  container.querySelectorAll("[data-page]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextPage = Number(button.dataset.page);

      if (nextPage !== page) {
        onChange(nextPage);
      }
    });
  });
};

const ensureVehicleModal = () => {
  let modalElement = document.getElementById("vehicleActionModal");

  if (!modalElement) {
    modalElement = document.createElement("div");
    modalElement.className = "modal fade";
    modalElement.id = "vehicleActionModal";
    modalElement.tabIndex = -1;
    modalElement.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Vehicle Action</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <form id="vehicleActionForm">
            <div class="modal-body">
              <div class="mb-3">
                <label class="form-label" for="vehicleActionPlate">Plate Number</label>
                <input class="form-control" id="vehicleActionPlate" name="plateNumber" required>
              </div>
              <div class="mb-3">
                <label class="form-label" for="vehicleActionOwner">Owner Name</label>
                <input class="form-control" id="vehicleActionOwner" name="ownerName" required>
              </div>
              <div class="mb-3">
                <label class="form-label" for="vehicleActionPhone">Owner Phone</label>
                <input class="form-control" id="vehicleActionPhone" name="ownerPhone" required>
              </div>
              <div class="mb-3">
                <label class="form-label" for="vehicleActionType">Vehicle Type</label>
                <input class="form-control" id="vehicleActionType" name="vehicleType" placeholder="Sedan, SUV, Truck..." required>
              </div>
              <div class="mb-3">
                <label class="form-label" for="vehicleActionSlot">Parking Slot</label>
                <select class="form-select" id="vehicleActionSlot" name="parkingSlotId">
                  <option value="">Auto-assign nearest available slot</option>
                </select>
              </div>
              <div class="small text-muted" id="vehicleActionHint">All data will be submitted to the backend.</div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-dark" id="vehicleActionSubmit">Save</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.appendChild(modalElement);
  }

  const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
  const form = modalElement.querySelector("#vehicleActionForm");
  const title = modalElement.querySelector(".modal-title");
  const submitButton = modalElement.querySelector("#vehicleActionSubmit");
  const slotSelect = modalElement.querySelector("#vehicleActionSlot");
  const hint = modalElement.querySelector("#vehicleActionHint");
  let submitHandler = null;

  if (!form.dataset.bound) {
    form.dataset.bound = "true";
    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!submitHandler) {
        return;
      }

      submitButton.disabled = true;
      const originalText = submitButton.textContent;
      submitButton.textContent = "Saving...";

      try {
        const formData = new FormData(form);
        const payload = {
          plateNumber: String(formData.get("plateNumber") || "").trim().toUpperCase(),
          ownerName: String(formData.get("ownerName") || "").trim(),
          ownerPhone: String(formData.get("ownerPhone") || "").trim(),
          vehicleType: String(formData.get("vehicleType") || "").trim(),
        };
        const parkingSlotId = String(formData.get("parkingSlotId") || "").trim();

        if (parkingSlotId) {
          payload.parkingSlotId = parkingSlotId;
        }

        await submitHandler(payload);
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = originalText;
      }
    });
  }

  return {
    open: async ({
      modalTitle,
      submitText,
      defaults = {},
      requireSlotSelection = false,
      preselectedSlotId = "",
      onSubmit,
    }) => {
      title.textContent = modalTitle;
      submitButton.textContent = submitText;
      form.reset();
      form.querySelector('[name="plateNumber"]').value = defaults.plateNumber || "";
      form.querySelector('[name="ownerName"]').value = defaults.ownerName || "";
      form.querySelector('[name="ownerPhone"]').value = defaults.ownerPhone || "";
      form.querySelector('[name="vehicleType"]').value = defaults.vehicleType || "";

      slotSelect.disabled = true;
      slotSelect.innerHTML = requireSlotSelection
        ? '<option value="">Loading available slots...</option>'
        : '<option value="">Auto-assign nearest available slot</option>';
      hint.textContent = requireSlotSelection
        ? "Choose a free parking slot before submitting."
        : "Leave the slot empty to auto-assign the nearest available slot.";

      try {
        const availableSlotsResponse = await apiRequest("/parking-slots/available");
        const availableSlots = availableSlotsResponse.data?.slots || [];
        slotSelect.disabled = false;

        const options = availableSlots.map((slot) => `
          <option value="${slot.id}" ${preselectedSlotId === slot.id ? "selected" : ""}>
            ${escapeHtml(slot.slotNumber)}
          </option>
        `).join("");

        slotSelect.innerHTML = requireSlotSelection
          ? `<option value="">Select a parking slot</option>${options}`
          : `<option value="">Auto-assign nearest available slot</option>${options}`;

        if (preselectedSlotId) {
          slotSelect.value = preselectedSlotId;
        }
      } catch (error) {
        slotSelect.disabled = false;
        slotSelect.innerHTML = requireSlotSelection
          ? '<option value="">No available slots found</option>'
          : '<option value="">Auto-assign nearest available slot</option>';
        showAlert(error.message, "danger");
      }

      submitHandler = onSubmit;
      modal.show();
    },
    close: () => modal.hide(),
  };
};

const ensureCheckoutModal = () => {
  let modalElement = document.getElementById("checkoutVehicleModal");

  if (!modalElement) {
    modalElement = document.createElement("div");
    modalElement.className = "modal fade";
    modalElement.id = "checkoutVehicleModal";
    modalElement.tabIndex = -1;
    modalElement.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Check Out Vehicle</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <form id="checkoutVehicleForm">
            <div class="modal-body">
              <div class="mb-3">
                <label class="form-label" for="checkoutVehicleSelect">Select parked vehicle</label>
                <select class="form-select" id="checkoutVehicleSelect" name="vehicleId" required></select>
              </div>
              <div class="mb-3">
                <label class="form-label" for="checkoutPaymentMethod">Payment method</label>
                <select class="form-select" id="checkoutPaymentMethod" name="paymentMethod">
                  <option value="cash">Cash</option>
                  <option value="mobile_money">Mobile Money</option>
                  <option value="card">Card</option>
                </select>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-dark" id="checkoutVehicleSubmit">Check Out</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.appendChild(modalElement);
  }

  const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
  const form = modalElement.querySelector("#checkoutVehicleForm");
  const select = modalElement.querySelector("#checkoutVehicleSelect");
  const submitButton = modalElement.querySelector("#checkoutVehicleSubmit");
  let submitHandler = null;

  if (!form.dataset.bound) {
    form.dataset.bound = "true";
    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!submitHandler) {
        return;
      }

      submitButton.disabled = true;
      const originalText = submitButton.textContent;
      submitButton.textContent = "Processing...";

      try {
        const formData = new FormData(form);
        await submitHandler({
          vehicleId: String(formData.get("vehicleId") || ""),
          paymentMethod: String(formData.get("paymentMethod") || "cash"),
        });
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = originalText;
      }
    });
  }

  return {
    open: ({ vehicles, onSubmit }) => {
      if (!vehicles.length) {
        showAlert("No parked vehicles available for check out.", "info");
        return;
      }

      select.innerHTML = vehicles.map((vehicle) => `
        <option value="${vehicle.id}">
          ${escapeHtml(vehicle.plateNumber)} - ${escapeHtml(vehicle.ownerName)} (${escapeHtml(vehicle.currentSlot || "No Slot")})
        </option>
      `).join("");

      submitHandler = onSubmit;
      modal.show();
    },
    close: () => modal.hide(),
  };
};

const ensureSlotInfoModal = () => {
  let modalElement = document.getElementById("slotInfoModal");

  if (!modalElement) {
    modalElement = document.createElement("div");
    modalElement.className = "modal fade";
    modalElement.id = "slotInfoModal";
    modalElement.tabIndex = -1;
    modalElement.innerHTML = `
      <div class="modal-dialog modal-sm modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Occupied Slot</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body" id="slotInfoModalBody"></div>
        </div>
      </div>
    `;

    document.body.appendChild(modalElement);
  }

  const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
  const body = modalElement.querySelector("#slotInfoModalBody");
  const title = modalElement.querySelector(".modal-title");

  return {
    open: (slot) => {
      title.textContent = `${slot.slotNumber} Details`;

      if (slot.status === "occupied") {
        body.innerHTML = `
          <div class="d-grid gap-2">
            <div><strong>Slot:</strong> ${escapeHtml(slot.slotNumber)}</div>
            <div><strong>Status:</strong> ${escapeHtml(slot.status || "N/A")}</div>
            <div><strong>Plate:</strong> ${escapeHtml(slot.plateNumber || "N/A")}</div>
            <div><strong>Owner:</strong> ${escapeHtml(slot.ownerName || "N/A")}</div>
            <div><strong>Phone:</strong> ${escapeHtml(slot.ownerPhone || "N/A")}</div>
            <div><strong>Vehicle Type:</strong> ${escapeHtml(slot.vehicleType || "N/A")}</div>
            <div><strong>Entry Time:</strong> ${escapeHtml(formatDateTime(slot.entryTime))}</div>
            <div class="pt-2">
              <button type="button" class="btn btn-dark btn-sm w-100" data-slot-checkout="true" data-vehicle-id="${escapeHtml(slot.currentVehicle || "")}">Check Out</button>
            </div>
          </div>
        `;
      } else {
        body.innerHTML = `
          <div class="d-grid gap-2">
            <div><strong>Slot:</strong> ${escapeHtml(slot.slotNumber)}</div>
            <div><strong>Status:</strong> ${escapeHtml(slot.status || "N/A")}</div>
            <div><strong>Details:</strong> This parking slot is empty.</div>
            <div class="pt-2">
              <button type="button" class="btn btn-outline-danger btn-sm w-100" data-slot-delete="true">Delete Slot</button>
            </div>
          </div>
        `;
      }

      const deleteButton = body.querySelector("[data-slot-delete]");
      const checkoutButton = body.querySelector("[data-slot-checkout]");

      if (deleteButton) {
        deleteButton.addEventListener("click", async () => {
          if (!window.confirm(`Delete parking slot ${slot.slotNumber}?`)) {
            return;
          }

          deleteButton.disabled = true;

          try {
            await apiRequest(`/parking-slots/${slot.id}`, {
              method: "DELETE",
            });
            showAlert("Parking slot deleted successfully");
            modal.hide();
            await loadDashboard();
          } catch (error) {
            showAlert(error.message, "danger");
          } finally {
            deleteButton.disabled = false;
          }
        });
      }

      if (checkoutButton && checkoutButton.dataset.vehicleId) {
        checkoutButton.addEventListener("click", async () => {
          checkoutButton.disabled = true;

          try {
            await performCheckOut(checkoutButton.dataset.vehicleId, "cash", async () => {
              modal.hide();
              await loadDashboard();
            });
          } catch (error) {
            showAlert(error.message, "danger");
          } finally {
            checkoutButton.disabled = false;
          }
        });
      }

      modal.show();
    },
  };
};

const performCheckIn = async (payload, afterSuccess) => {
  const response = await apiRequest("/vehicles/check-in", {
    method: "POST",
    body: payload,
  });

  showAlert(response.message || "Vehicle checked in successfully");

  if (typeof afterSuccess === "function") {
    await afterSuccess(response);
  }
};

const performCheckOut = async (vehicleId, paymentMethod = "cash", afterSuccess) => {
  const response = await apiRequest(`/vehicles/check-out/${vehicleId}`, {
    method: "POST",
    body: { paymentMethod },
  });

  showAlert(response.message || "Vehicle checked out successfully");

  if (typeof afterSuccess === "function") {
    await afterSuccess(response);
  }
};

async function loadDashboard() {
  const totalSlots = document.getElementById("totalSlots");
  const occupiedSlots = document.getElementById("occupiedSlots");
  const availableSlots = document.getElementById("availableSlots");
  const todayRevenue = document.getElementById("todayRevenue");
  const parkingSlots = document.getElementById("parkingSlots");
  const vehicleTable = document.getElementById("vehicleTable");

  if (!totalSlots || !parkingSlots || !vehicleTable) {
    return;
  }

  totalSlots.textContent = "--";
  occupiedSlots.textContent = "--";
  availableSlots.textContent = "--";
  todayRevenue.textContent = "--";
  parkingSlots.innerHTML = '<div class="text-center py-4">Loading parking map...</div>';
  renderLoadingRow(vehicleTable, 7, "Loading recent vehicles...");

  try {
    const response = await apiRequest("/dashboard/overview");
    const overview = response.data;
    pageState.dashboard.overview = overview;

    totalSlots.textContent = String(overview.totalSlots ?? 0);
    occupiedSlots.textContent = String(overview.occupiedSlots ?? 0);
    availableSlots.textContent = String(overview.availableSlots ?? 0);
    todayRevenue.textContent = formatCurrency(overview.todayRevenue);

    renderParkingMap(overview.parkingMapData || []);
    renderRecentVehicles(overview.recentParkedVehicles || []);
  } catch (error) {
    parkingSlots.innerHTML = '<div class="text-center py-4 text-danger">Failed to load parking map.</div>';
    renderLoadingRow(vehicleTable, 7, "Failed to load recent vehicles.");
    showAlert(error.message, "danger");
  }
}

function renderParkingMap(slots) {
  const parkingSlots = document.getElementById("parkingSlots");

  if (!parkingSlots) {
    return;
  }

  if (!slots.length) {
    renderEmptyState(parkingSlots, "No parking slots available.");
    return;
  }

  parkingSlots.innerHTML = slots.map((slot) => {
    const occupied = slot.status === "occupied";

    return `
      <div class="slot-wrapper slot-trigger" data-dashboard-slot="${slot.id}" role="button" tabindex="0" aria-label="View ${escapeHtml(slot.slotNumber)} details">
        <span class="slot-number">${escapeHtml(slot.slotNumber)}</span>
        <div class="slot ${occupied ? "occupied" : ""}" title="${escapeHtml(slot.slotNumber)}">
          ${occupied ? `
            <div class="d-flex flex-column align-items-center justify-content-center">
              <img class="parked-car-image" src="${PARKED_CAR_IMAGE}" alt="Parked car in ${escapeHtml(slot.slotNumber)}">
              <small class="text-white fw-semibold mt-1">${escapeHtml(slot.plateNumber || "")}</small>
            </div>
          ` : ""}
        </div>
      </div>
    `;
  }).join("");

  parkingSlots.querySelectorAll("[data-dashboard-slot]").forEach((slotElement) => {
    const openSlotModal = () => {
      const slot = pageState.dashboard.overview?.parkingMapData?.find((item) => item.id === slotElement.dataset.dashboardSlot);

      if (slot) {
        ensureSlotInfoModal().open(slot);
      }
    };

    slotElement.addEventListener("click", openSlotModal);
    slotElement.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openSlotModal();
      }
    });
  });

  parkingSlots.onmousedown = (event) => {
    const slotElement = event.target.closest("[data-dashboard-slot]");

    if (!slotElement) {
      return;
    }

    const slot = pageState.dashboard.overview?.parkingMapData?.find((item) => item.id === slotElement.dataset.dashboardSlot);

    if (slot) {
      ensureSlotInfoModal().open(slot);
    }
  };
}

function renderRecentVehicles(vehicles) {
  const vehicleTable = document.getElementById("vehicleTable");

  if (!vehicleTable) {
    return;
  }

  if (!vehicles.length) {
    renderLoadingRow(vehicleTable, 7, "No parked vehicles found.");
    return;
  }

  vehicleTable.innerHTML = vehicles.map((vehicle) => `
    <tr>
      <td>${escapeHtml(vehicle.plateNumber)}</td>
      <td>${escapeHtml(vehicle.ownerName)}</td>
      <td>${escapeHtml(vehicle.currentSlot || "N/A")}</td>
      <td>${escapeHtml(formatDateTime(vehicle.entryTime))}</td>
      <td>${escapeHtml(formatDuration(vehicle.entryTime))}</td>
      <td>${escapeHtml(vehicle.status)}</td>
      <td>
        <button class="btn btn-sm btn-dark" type="button" data-dashboard-checkout="${vehicle.id}">
          Check Out
        </button>
      </td>
    </tr>
  `).join("");

  vehicleTable.querySelectorAll("[data-dashboard-checkout]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await performCheckOut(button.dataset.dashboardCheckout, "cash", loadDashboard);
      } catch (error) {
        showAlert(error.message, "danger");
      }
    });
  });
}

const initializeDashboardPage = () => {
  const parkingSlots = document.getElementById("parkingSlots");

  if (!parkingSlots) {
    return;
  }

  const vehicleModal = ensureVehicleModal();
  const checkoutModal = ensureCheckoutModal();
  const slotInfoModal = ensureSlotInfoModal();

  document.getElementById("addVehicleBtn")?.addEventListener("click", async () => {
    await vehicleModal.open({
      modalTitle: "Add New Vehicle",
      submitText: "Check In Vehicle",
      onSubmit: async (payload) => {
        await performCheckIn(payload, async () => {
          vehicleModal.close();
          await loadDashboard();
        });
      },
    });
  });

  document.getElementById("checkInVehicleBtn")?.addEventListener("click", async () => {
    await vehicleModal.open({
      modalTitle: "Check In Vehicle",
      submitText: "Check In",
      requireSlotSelection: true,
      onSubmit: async (payload) => {
        await performCheckIn(payload, async () => {
          vehicleModal.close();
          await loadDashboard();
        });
      },
    });
  });

  document.getElementById("checkOutVehicleBtn")?.addEventListener("click", async () => {
    try {
      const response = await apiRequest("/vehicles?page=1&limit=100&status=parked&sortBy=entryTime&order=desc");
      const vehicles = (response.data?.vehicles || []).map((vehicle) => ({
        id: vehicle.id,
        plateNumber: vehicle.plateNumber,
        ownerName: vehicle.ownerName,
        currentSlot: vehicle.currentSlot?.slotNumber || "N/A",
      }));

      checkoutModal.open({
        vehicles,
        onSubmit: async ({ vehicleId, paymentMethod }) => {
          await performCheckOut(vehicleId, paymentMethod, async () => {
            checkoutModal.close();
            await loadDashboard();
          });
        },
      });
    } catch (error) {
      showAlert(error.message, "danger");
    }
  });

  document.getElementById("viewReportsBtn")?.addEventListener("click", () => {
    window.location.href = "reports.html";
  });

  loadDashboard();
};

const loadVehicles = async () => {
  const tableBody = document.getElementById("vehiclesPageTable");
  const tableInfo = document.getElementById("vehiclesTableInfo");
  const pagination = document.getElementById("vehiclesPagination");

  if (!tableBody || !tableInfo || !pagination) {
    return;
  }

  renderLoadingRow(tableBody, 6, "Loading vehicles...");

  try {
    const response = await apiRequest(`/vehicles${buildQuery(pageState.vehicles)}`);
    const vehicles = response.data?.vehicles || [];
    const meta = response.data?.pagination || {};

    if (!vehicles.length) {
      renderLoadingRow(tableBody, 6, "No vehicles found.");
    } else {
      tableBody.innerHTML = vehicles.map((vehicle) => `
        <tr>
          <td>${escapeHtml(vehicle.plateNumber)}</td>
          <td>${escapeHtml(vehicle.ownerName)}</td>
          <td>${escapeHtml(vehicle.ownerPhone)}</td>
          <td>${escapeHtml(vehicle.vehicleType)}</td>
          <td><span class="badge text-bg-${vehicle.status === "parked" ? "success" : "secondary"}">${escapeHtml(vehicle.status)}</span></td>
          <td>
            <div class="vehicle-actions">
              <button type="button" data-vehicle-view="${vehicle.id}" aria-label="View vehicle"><i class="bi bi-eye"></i></button>
              <button type="button" data-vehicle-edit="${vehicle.id}" aria-label="Edit vehicle"><i class="bi bi-pencil"></i></button>
              <button type="button" data-vehicle-delete="${vehicle.id}" aria-label="Delete vehicle"><i class="bi bi-trash"></i></button>
              ${vehicle.status === "parked" ? `<button type="button" data-vehicle-checkout="${vehicle.id}" aria-label="Check out vehicle"><i class="bi bi-box-arrow-right"></i></button>` : ""}
            </div>
          </td>
        </tr>
      `).join("");
    }

    const total = meta.total || 0;
    const start = total ? ((meta.page - 1) * meta.limit) + 1 : 0;
    const end = total ? Math.min(meta.page * meta.limit, total) : 0;
    tableInfo.textContent = `Showing ${start} to ${end} of ${total} entries`;

    renderPagination(pagination, meta, (nextPage) => {
      pageState.vehicles.page = nextPage;
      loadVehicles();
    });

    tableBody.querySelectorAll("[data-vehicle-view]").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          const response = await apiRequest(`/vehicles/${button.dataset.vehicleView}`);
          const vehicle = response.data?.vehicle || response.data;
          window.alert([
            `Plate: ${vehicle.plateNumber}`,
            `Owner: ${vehicle.ownerName}`,
            `Phone: ${vehicle.ownerPhone}`,
            `Type: ${vehicle.vehicleType}`,
            `Status: ${vehicle.status}`,
            `Slot: ${vehicle.currentSlot?.slotNumber || "N/A"}`,
            `Entry: ${formatDateTime(vehicle.entryTime)}`,
            `Exit: ${formatDateTime(vehicle.exitTime)}`,
          ].join("\n"));
        } catch (error) {
          showAlert(error.message, "danger");
        }
      });
    });

    tableBody.querySelectorAll("[data-vehicle-edit]").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          const response = await apiRequest(`/vehicles/${button.dataset.vehicleEdit}`);
          const vehicle = response.data?.vehicle || response.data;
          const ownerName = window.prompt("Owner name", vehicle.ownerName);

          if (ownerName === null) {
            return;
          }

          const ownerPhone = window.prompt("Owner phone", vehicle.ownerPhone);

          if (ownerPhone === null) {
            return;
          }

          const vehicleType = window.prompt("Vehicle type", vehicle.vehicleType);

          if (vehicleType === null) {
            return;
          }

          await apiRequest(`/vehicles/${vehicle.id}`, {
            method: "PUT",
            body: {
              ownerName,
              ownerPhone,
              vehicleType,
            },
          });

          showAlert("Vehicle updated successfully");
          await loadVehicles();
        } catch (error) {
          showAlert(error.message, "danger");
        }
      });
    });

    tableBody.querySelectorAll("[data-vehicle-delete]").forEach((button) => {
      button.addEventListener("click", async () => {
        const confirmed = window.confirm("Delete this vehicle?");

        if (!confirmed) {
          return;
        }

        try {
          await apiRequest(`/vehicles/${button.dataset.vehicleDelete}`, {
            method: "DELETE",
          });

          showAlert("Vehicle deleted successfully");
          await loadVehicles();
        } catch (error) {
          showAlert(error.message, "danger");
        }
      });
    });

    tableBody.querySelectorAll("[data-vehicle-checkout]").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          await performCheckOut(button.dataset.vehicleCheckout, "cash", loadVehicles);
        } catch (error) {
          showAlert(error.message, "danger");
        }
      });
    });
  } catch (error) {
    renderLoadingRow(tableBody, 6, "Failed to load vehicles.");
    tableInfo.textContent = "Unable to load vehicles";
    showAlert(error.message, "danger");
  }
};

const initializeVehiclesPage = () => {
  const tableBody = document.getElementById("vehiclesPageTable");

  if (!tableBody) {
    return;
  }

  const vehicleModal = ensureVehicleModal();

  document.getElementById("vehicleSearch")?.addEventListener("input", (event) => {
    pageState.vehicles.search = event.target.value.trim();
    pageState.vehicles.page = 1;
    loadVehicles();
  });

  document.getElementById("addVehicleRecord")?.addEventListener("click", async () => {
    await vehicleModal.open({
      modalTitle: "Add New Vehicle",
      submitText: "Check In Vehicle",
      onSubmit: async (payload) => {
        await performCheckIn(payload, async () => {
          vehicleModal.close();
          await loadVehicles();
        });
      },
    });
  });

  loadVehicles();
};

const renderSlotDetails = (slot) => {
  const details = document.getElementById("slotDetailsContent");

  if (!details) {
    return;
  }

  if (!slot) {
    details.textContent = "Select a slot to view details.";
    return;
  }

  if (slot.status === "occupied" && slot.currentVehicle) {
    details.innerHTML = `
      <p><strong>Slot:</strong> ${escapeHtml(slot.slotNumber)}</p>
      <p><strong>Status:</strong> ${escapeHtml(slot.status)}</p>
      <p><strong>Plate:</strong> ${escapeHtml(slot.currentVehicle.plateNumber)}</p>
      <p><strong>Owner:</strong> ${escapeHtml(slot.currentVehicle.ownerName)}</p>
      <p><strong>Vehicle Type:</strong> ${escapeHtml(slot.currentVehicle.vehicleType)}</p>
      <p><strong>Entry Time:</strong> ${escapeHtml(formatDateTime(slot.currentVehicle.entryTime))}</p>
      <button type="button" class="btn btn-dark btn-sm" data-slot-vehicle="${slot.currentVehicle.id}">Check Out Vehicle</button>
    `;
    return;
  }

  if (slot.status === "available") {
    details.innerHTML = `
      <p><strong>Slot:</strong> ${escapeHtml(slot.slotNumber)}</p>
      <p><strong>Status:</strong> Available</p>
      <button type="button" class="btn btn-dark btn-sm" data-slot-assign="${slot.id}">Assign Vehicle</button>
    `;
    return;
  }

  details.innerHTML = `
    <p><strong>Slot:</strong> ${escapeHtml(slot.slotNumber)}</p>
    <p><strong>Status:</strong> ${escapeHtml(slot.status)}</p>
    <p>This slot is not available for assignment.</p>
  `;
};

const loadParkingSlots = async () => {
  const grid = document.getElementById("slotsPageGrid");
  const total = document.getElementById("slotsPageTotal");
  const occupied = document.getElementById("slotsPageOccupied");
  const available = document.getElementById("slotsPageAvailable");
  const revenue = document.getElementById("slotsPageRevenue");
  const pagination = document.getElementById("slotsPagination");

  if (!grid || !total || !occupied || !available || !revenue || !pagination) {
    return;
  }

  grid.innerHTML = '<div class="text-center py-4">Loading parking slots...</div>';

  try {
    const response = await apiRequest(`/parking-slots${buildQuery(pageState.slots)}`);
    const slots = response.data?.slots || [];
    const summary = response.data?.summary || {};
    const meta = response.data?.pagination || {};

    total.textContent = String(summary.totalSlots ?? 0);
    occupied.textContent = String(summary.occupiedSlots ?? 0);
    available.textContent = String(summary.availableSlots ?? 0);
    revenue.textContent = formatCurrency(summary.todayRevenue ?? 0);

    if (!slots.length) {
      renderEmptyState(grid, "No parking slots found.");
    } else {
      grid.innerHTML = slots.map((slot) => `
        <article class="slot-card ${escapeHtml(slot.status.toLowerCase())}" data-slot-id="${slot.id}">
          <div>
            <h3>${escapeHtml(slot.slotNumber)}</h3>
            <p>${escapeHtml(slot.status)}</p>
          </div>
          <div class="slot-card-icon" aria-hidden="true">
            ${slot.status === "occupied" ? '<i class="bi bi-car-front-fill"></i>' : "P"}
          </div>
        </article>
      `).join("");
    }

    renderPagination(pagination, meta, (nextPage) => {
      pageState.slots.page = nextPage;
      loadParkingSlots();
    });

    grid.querySelectorAll("[data-slot-id]").forEach((card) => {
      card.addEventListener("click", () => {
        const slot = slots.find((item) => item.id === card.dataset.slotId);
        pageState.slots.selectedSlot = slot || null;
        renderSlotDetails(slot);
      });
    });

    if (pageState.slots.selectedSlot) {
      const selected = slots.find((slot) => slot.id === pageState.slots.selectedSlot.id);
      renderSlotDetails(selected || slots[0] || null);
      pageState.slots.selectedSlot = selected || null;
    } else {
      renderSlotDetails(slots[0] || null);
      pageState.slots.selectedSlot = slots[0] || null;
    }
  } catch (error) {
    grid.innerHTML = '<div class="text-center py-4 text-danger">Failed to load slots.</div>';
    showAlert(error.message, "danger");
  }
};

const initializeParkingSlotsPage = () => {
  const grid = document.getElementById("slotsPageGrid");

  if (!grid) {
    return;
  }

  const vehicleModal = ensureVehicleModal();

  document.getElementById("slotSearch")?.addEventListener("input", (event) => {
    pageState.slots.search = event.target.value.trim();
    pageState.slots.page = 1;
    loadParkingSlots();
  });

  document.getElementById("addSlotButton")?.addEventListener("click", async () => {
    const slotNumber = window.prompt("Enter slot number", "")?.trim().toUpperCase();

    if (!slotNumber) {
      return;
    }

    try {
      await apiRequest("/parking-slots", {
        method: "POST",
        body: {
          slotNumber,
        },
      });

      showAlert("Parking slot created successfully");
      await loadParkingSlots();
    } catch (error) {
      showAlert(error.message, "danger");
    }
  });

  document.getElementById("slotDetailsCard")?.addEventListener("click", async (event) => {
    const assignButton = event.target.closest("[data-slot-assign]");
    const checkoutButton = event.target.closest("[data-slot-vehicle]");

    if (assignButton) {
      const slotId = assignButton.dataset.slotAssign;
      const slot = pageState.slots.selectedSlot;

      await vehicleModal.open({
        modalTitle: `Assign Vehicle To ${slot?.slotNumber || "Slot"}`,
        submitText: "Assign Vehicle",
        requireSlotSelection: true,
        preselectedSlotId: slotId,
        onSubmit: async (payload) => {
          await performCheckIn(payload, async () => {
            vehicleModal.close();
            await loadParkingSlots();
          });
        },
      });
    }

    if (checkoutButton) {
      try {
        await performCheckOut(checkoutButton.dataset.slotVehicle, "cash", loadParkingSlots);
      } catch (error) {
        showAlert(error.message, "danger");
      }
    }
  });

  loadParkingSlots();
};

const loadTransactions = async () => {
  const tableBody = document.getElementById("transactionsTable");
  const tableInfo = document.getElementById("transactionsTableInfo");
  const pagination = document.getElementById("transactionsPagination");

  if (!tableBody || !tableInfo || !pagination) {
    return;
  }

  renderLoadingRow(tableBody, 7, "Loading transactions...");

  try {
    const response = await apiRequest(`/transactions${buildQuery(pageState.transactions)}`);
    const transactions = response.data?.transactions || [];
    const meta = response.data?.pagination || {};

    if (!transactions.length) {
      renderLoadingRow(tableBody, 7, "No transactions found.");
    } else {
      tableBody.innerHTML = transactions.map((transaction) => `
        <tr>
          <td>${escapeHtml(transaction.transactionCode)}</td>
          <td>${escapeHtml(transaction.plateNumber)}</td>
          <td>${escapeHtml(transaction.type)}</td>
          <td>${escapeHtml(transaction.parkingSlot?.slotNumber || "N/A")}</td>
          <td>${escapeHtml(formatDateTime(transaction.createdAt))}</td>
          <td><span class="badge text-bg-${transaction.status === "completed" ? "success" : transaction.status === "pending" ? "warning" : "secondary"}">${escapeHtml(transaction.status)}</span></td>
          <td>${escapeHtml(formatCurrency(transaction.amount))}</td>
        </tr>
      `).join("");
    }

    const total = meta.total || 0;
    const start = total ? ((meta.page - 1) * meta.limit) + 1 : 0;
    const end = total ? Math.min(meta.page * meta.limit, total) : 0;
    tableInfo.textContent = `Showing ${start} to ${end} of ${total} entries`;

    renderPagination(pagination, meta, (nextPage) => {
      pageState.transactions.page = nextPage;
      loadTransactions();
    });
  } catch (error) {
    renderLoadingRow(tableBody, 7, "Failed to load transactions.");
    showAlert(error.message, "danger");
  }
};

const initializeTransactionsPage = () => {
  const tableBody = document.getElementById("transactionsTable");

  if (!tableBody) {
    return;
  }

  document.getElementById("transactionSearch")?.addEventListener("input", (event) => {
    pageState.transactions.search = event.target.value.trim();
    pageState.transactions.page = 1;
    loadTransactions();
  });

  document.getElementById("filterTransactionsBtn")?.addEventListener("click", () => {
    const type = window.prompt("Filter by type: check_in, check_out, payment, slot_update", pageState.transactions.type);

    if (type === null) {
      return;
    }

    pageState.transactions.type = type.trim();
    pageState.transactions.page = 1;
    loadTransactions();
  });

  document.getElementById("exportTransactionsBtn")?.addEventListener("click", async () => {
    try {
      const csvBlob = await apiRequest(`/transactions${buildQuery({
        ...pageState.transactions,
        export: "csv",
      })}`, {
        responseType: "blob",
      });
      const downloadUrl = URL.createObjectURL(csvBlob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = "transactions.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      showAlert(error.message, "danger");
    }
  });

  loadTransactions();
};

const loadPayments = async () => {
  const tableBody = document.getElementById("paymentsTable");
  const tableInfo = document.getElementById("paymentsTableInfo");
  const pagination = document.getElementById("paymentsPagination");

  if (!tableBody || !tableInfo || !pagination) {
    return;
  }

  renderLoadingRow(tableBody, 7, "Loading payments...");

  try {
    const response = await apiRequest(`/payments${buildQuery(pageState.payments)}`);
    const summary = response.data?.summary || {};
    const payments = response.data?.payments || [];
    const meta = response.data?.pagination || {};

    document.getElementById("paymentsTotalRevenue").textContent = formatCurrency(summary.totalRevenue ?? 0);
    document.getElementById("paymentsTotalVehicles").textContent = String(summary.totalVehicles ?? 0);
    document.getElementById("paymentsTotalTransactions").textContent = String(summary.totalTransactions ?? 0);
    document.getElementById("paymentsOccupancyRate").textContent = `${summary.occupancyRate ?? 0}%`;

    if (!payments.length) {
      renderLoadingRow(tableBody, 7, "No payments found.");
    } else {
      tableBody.innerHTML = payments.map((payment) => `
        <tr>
          <td>${escapeHtml(payment.paymentCode)}</td>
          <td>${escapeHtml(payment.plateNumber)}</td>
          <td>${escapeHtml(formatCurrency(payment.amount))}</td>
          <td>${escapeHtml(payment.paymentMethod)}</td>
          <td>${escapeHtml(formatDateTime(payment.paidAt || payment.createdAt))}</td>
          <td><span class="badge text-bg-${payment.status === "paid" ? "success" : payment.status === "pending" ? "warning" : "danger"}">${escapeHtml(payment.status)}</span></td>
          <td>
            ${payment.status !== "paid" ? `<button type="button" class="btn btn-sm btn-dark" data-mark-paid="${payment.id}">Mark Paid</button>` : `<button type="button" class="btn btn-sm btn-outline-secondary" data-view-payment="${payment.id}">View</button>`}
          </td>
        </tr>
      `).join("");
    }

    const total = meta.total || 0;
    const start = total ? ((meta.page - 1) * meta.limit) + 1 : 0;
    const end = total ? Math.min(meta.page * meta.limit, total) : 0;
    tableInfo.textContent = `Showing ${start} to ${end} of ${total} entries`;

    renderPagination(pagination, meta, (nextPage) => {
      pageState.payments.page = nextPage;
      loadPayments();
    });

    tableBody.querySelectorAll("[data-mark-paid]").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          await apiRequest(`/payments/${button.dataset.markPaid}/mark-paid`, {
            method: "PUT",
            body: {},
          });

          showAlert("Payment marked as paid successfully");
          await loadPayments();
        } catch (error) {
          showAlert(error.message, "danger");
        }
      });
    });

    tableBody.querySelectorAll("[data-view-payment]").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          const response = await apiRequest(`/payments/${button.dataset.viewPayment}`);
          const payment = response.data;
          window.alert([
            `Payment: ${payment.paymentCode}`,
            `Plate: ${payment.plateNumber}`,
            `Amount: ${formatCurrency(payment.amount)}`,
            `Method: ${payment.paymentMethod}`,
            `Status: ${payment.status}`,
            `Paid At: ${formatDateTime(payment.paidAt)}`,
          ].join("\n"));
        } catch (error) {
          showAlert(error.message, "danger");
        }
      });
    });
  } catch (error) {
    renderLoadingRow(tableBody, 7, "Failed to load payments.");
    showAlert(error.message, "danger");
  }
};

const initializePaymentsPage = () => {
  const tableBody = document.getElementById("paymentsTable");

  if (!tableBody) {
    return;
  }

  document.getElementById("paymentSearch")?.addEventListener("input", (event) => {
    pageState.payments.search = event.target.value.trim();
    pageState.payments.page = 1;
    loadPayments();
  });

  document.getElementById("filterPaymentsBtn")?.addEventListener("click", () => {
    const status = window.prompt("Filter by status: paid, pending, failed", pageState.payments.status);

    if (status === null) {
      return;
    }

    pageState.payments.status = status.trim();
    pageState.payments.page = 1;
    loadPayments();
  });

  document.getElementById("exportPaymentsBtn")?.addEventListener("click", async () => {
    try {
      const csvBlob = await apiRequest(`/payments${buildQuery({
        ...pageState.payments,
        export: "csv",
      })}`, {
        responseType: "blob",
      });
      const downloadUrl = URL.createObjectURL(csvBlob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = "payments.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      showAlert(error.message, "danger");
    }
  });

  loadPayments();
};

const renderRevenueChart = (records) => {
  const chart = document.getElementById("reportsRevenueChart");

  if (!chart) {
    return;
  }

  if (!records.length) {
    chart.innerHTML = '<div class="text-center py-4 text-muted">No revenue data available for this range.</div>';
    return;
  }

  const maxAmount = Math.max(...records.map((item) => Number(item.amount || 0)), 1);

  chart.innerHTML = `
    <div class="d-flex align-items-end gap-3 flex-wrap" style="min-height: 260px;">
      ${records.map((item) => `
        <div class="d-flex flex-column align-items-center flex-fill" style="min-width: 80px;">
          <div class="rounded-3 w-100" style="height: ${Math.max((Number(item.amount || 0) / maxAmount) * 220, 12)}px; background: linear-gradient(180deg, #27ae60 0%, #0e5b34 100%);"></div>
          <small class="mt-2">${escapeHtml(item.date)}</small>
          <strong>${escapeHtml(formatCurrency(item.amount))}</strong>
        </div>
      `).join("")}
    </div>
  `;
};

const renderVehicleStatusChart = (statusChart) => {
  const container = document.getElementById("reportVehicleStatus");

  if (!container) {
    return;
  }

  const parked = Number(statusChart?.parked || 0);
  const checkedOut = Number(statusChart?.checkedOut || 0);
  const total = parked + checkedOut;
  const parkedPercent = total ? ((parked / total) * 100).toFixed(1) : "0.0";
  const checkedOutPercent = total ? ((checkedOut / total) * 100).toFixed(1) : "0.0";

  container.innerHTML = `
    <div class="w-100">
      <div class="d-flex justify-content-between mb-2">
        <strong>Total vehicles</strong>
        <span>${total}</span>
      </div>
      <div class="progress mb-3" style="height: 16px;">
        <div class="progress-bar bg-success" style="width: ${parkedPercent}%">${parkedPercent}%</div>
      </div>
      <div class="d-flex justify-content-between mb-2">
        <span>Parked</span>
        <strong>${parked}</strong>
      </div>
      <div class="progress mb-3" style="height: 16px;">
        <div class="progress-bar bg-secondary" style="width: ${checkedOutPercent}%">${checkedOutPercent}%</div>
      </div>
      <div class="d-flex justify-content-between">
        <span>Checked Out</span>
        <strong>${checkedOut}</strong>
      </div>
    </div>
  `;
};

const loadReports = async () => {
  const topSlotsTable = document.getElementById("reportTopSlotsTable");
  const recentActivityTable = document.getElementById("reportRecentActivityTable");

  if (!topSlotsTable || !recentActivityTable) {
    return;
  }

  topSlotsTable.innerHTML = '<tr><td colspan="3" class="text-center py-4">Loading reports...</td></tr>';
  recentActivityTable.innerHTML = '<tr><td colspan="3" class="text-center py-4">Loading report activity...</td></tr>';

  try {
    const [reportsResponse, dashboardResponse] = await Promise.all([
      apiRequest(`/reports${buildQuery(pageState.reports)}`),
      apiRequest("/dashboard/overview"),
    ]);

    const report = reportsResponse.data || {};
    const dashboard = dashboardResponse.data || {};

    document.getElementById("reportTotalRevenue").textContent = formatCurrency(report.totalRevenue ?? 0);
    document.getElementById("reportTotalVehicles").textContent = String(report.totalVehicles ?? 0);
    document.getElementById("reportTotalTransactions").textContent = String(report.totalTransactions ?? 0);
    document.getElementById("reportOccupancyRate").textContent = `${dashboard.occupancyRate ?? 0}% occupancy`;
    document.getElementById("reportAverageDuration").textContent = `Avg duration: ${report.averageParkingDuration ?? 0}h`;

    renderRevenueChart(report.revenueOverTime || []);
    renderVehicleStatusChart(report.vehicleStatusChart || {});

    const topSlots = report.topParkingSlotsByRevenue || [];
    topSlotsTable.innerHTML = topSlots.length ? topSlots.map((slot) => `
      <tr>
        <td>${escapeHtml(slot.slotNumber)}</td>
        <td>${escapeHtml(formatCurrency(slot.revenue))}</td>
        <td>${escapeHtml(String(slot.transactions))}</td>
      </tr>
    `).join("") : '<tr><td colspan="3" class="text-center py-4">No slot revenue data available.</td></tr>';

    const recentActivity = report.recentActivity || [];
    recentActivityTable.innerHTML = recentActivity.length ? recentActivity.map((activity) => `
      <tr>
        <td>${escapeHtml(formatDateTime(activity.createdAt))}</td>
        <td>${escapeHtml(activity.type)}</td>
        <td>${escapeHtml(`${activity.plateNumber} ${activity.slotNumber ? `from ${activity.slotNumber}` : ""}`.trim())}</td>
      </tr>
    `).join("") : '<tr><td colspan="3" class="text-center py-4">No recent activity available.</td></tr>';
  } catch (error) {
    topSlotsTable.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-danger">Failed to load reports.</td></tr>';
    recentActivityTable.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-danger">Failed to load recent activity.</td></tr>';
    showAlert(error.message, "danger");
  }
};

const initializeReportsPage = () => {
  const topSlotsTable = document.getElementById("reportTopSlotsTable");

  if (!topSlotsTable) {
    return;
  }

  document.getElementById("applyReportFilters")?.addEventListener("click", () => {
    pageState.reports.startDate = document.getElementById("reportStartDate")?.value || "";
    pageState.reports.endDate = document.getElementById("reportEndDate")?.value || "";
    pageState.reports.parkingSlot = document.getElementById("reportParkingSlot")?.value.trim() || "";
    pageState.reports.paymentMethod = document.getElementById("reportPaymentMethod")?.value || "";
    loadReports();
  });

  document.getElementById("exportReportBtn")?.addEventListener("click", async () => {
    try {
      const reportResponse = await apiRequest(`/reports${buildQuery(pageState.reports)}`);
      const reportBlob = new Blob([JSON.stringify(reportResponse.data || {}, null, 2)], {
        type: "application/json",
      });
      const downloadUrl = URL.createObjectURL(reportBlob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = "reports.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      showAlert(error.message, "danger");
    }
  });

  loadReports();
};

const initializeAuthPages = () => {
  const loginForm = document.getElementById("loginForm");
  const signupForm = document.getElementById("signupForm");

  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const submitButton = loginForm.querySelector('button[type="submit"]');
      const originalText = submitButton.textContent;
      submitButton.disabled = true;
      submitButton.textContent = "Signing in...";

      try {
        const response = await apiRequest("/auth/login", {
          auth: false,
          method: "POST",
          body: {
            email: document.getElementById("loginEmail")?.value.trim(),
            password: document.getElementById("loginPassword")?.value,
          },
        });

        setAuthSession(response.data.token, response.data.user);
        window.location.href = "dashboard.html";
      } catch (error) {
        showAlert(error.message, "danger");
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = originalText;
      }
    });
  }

  if (signupForm) {
    signupForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const submitButton = signupForm.querySelector('button[type="submit"]');
      const originalText = submitButton.textContent;
      submitButton.disabled = true;
      submitButton.textContent = "Creating account...";

      try {
        const response = await apiRequest("/auth/signup", {
          auth: false,
          method: "POST",
          body: {
            fullName: document.getElementById("fullName")?.value.trim(),
            email: document.getElementById("signupEmail")?.value.trim(),
            phone: document.getElementById("signupPhone")?.value.trim(),
            password: document.getElementById("signupPassword")?.value,
            role: document.getElementById("signupRole")?.value || "attendant",
          },
        });

        setAuthSession(response.data.token, response.data.user);
        showAlert("Account created successfully");
        window.location.href = "dashboard.html";
      } catch (error) {
        showAlert(error.message, "danger");
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = originalText;
      }
    });
  }
};

const initializeProtectedRouteGuard = () => {
  if (!isProtectedPage()) {
    return;
  }

  if (!getToken()) {
    redirectToLogin();
  }
};

const initializeApp = async () => {
  handleLogoutLinks();
  initializeResponsiveSidebar();
  initializeProtectedRouteGuard();
  initializeAuthPages();

  if (isProtectedPage()) {
    await loadCurrentUser();
  }

  initializeProfileMenu();

  initializeDashboardPage();
  initializeVehiclesPage();
  initializeParkingSlotsPage();
  initializeTransactionsPage();
  initializePaymentsPage();
  initializeReportsPage();
};

initializeApp();
