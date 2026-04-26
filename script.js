const rootElement = document.documentElement;
const themeToggle = document.querySelector("[data-theme-toggle]");
const API_BASE_URL = "https://verax.up.railway.app/api";
const AUTH_TOKEN_KEY = "token";
const AUTH_USER_KEY = "user";
const PENDING_OTP_EMAIL_KEY = "pendingSignupOtpEmail";
const PROFILE_PREFS_KEY = "profilePrefs";
const SETTINGS_CACHE_KEY = "veraxSettings";
const SETTINGS_BACKUP_KEY = "veraxSettingsBackupAt";
const BRAND_NAME = "veraX";
const BRAND_ACCENT = "#050505";
const PARKED_CAR_IMAGE = "images/occupied space.png";
const currentPage = window.location.pathname.split("/").pop() || "index.html";
const publicPages = new Set(["index.html", "login.html", "signup.html", ""]);

const pageState = {
  currentUser: null,
  notifications: [],
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
  users: {
    page: 1,
    limit: 10,
    search: "",
    status: "",
    role: "",
  },
  reports: {
    startDate: "",
    endDate: "",
    parkingSlot: "",
    paymentMethod: "",
  },
  settings: {
    data: null,
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

const getNotifications = () => pageState.notifications;

const setNotifications = (notifications) => {
  pageState.notifications = Array.isArray(notifications) ? notifications : [];
};

const shouldCreateNotification = (message, type) => {
  if (type === "danger") {
    return false;
  }

  return type === "success"
    || type === "info"
    || /(success|created|updated|deleted|checked|saved|exported|marked|paid|assigned)/i.test(message);
};

const fetchNotifications = async () => {
  if (!isProtectedPage() || !getToken()) {
    setNotifications([]);
    return [];
  }

  try {
    const response = await apiRequest("/notifications");
    const notifications = Array.isArray(response?.data) ? response.data : [];
    setNotifications(notifications);
    return notifications;
  } catch (error) {
    setNotifications([]);
    return [];
  }
};

const pushNotification = async (message, type = "info") => {
  if (!isProtectedPage() || !getToken()) {
    return null;
  }

  const response = await apiRequest("/notifications", {
    method: "POST",
    body: {
      message,
      type,
      page: currentPage,
    },
  });

  const createdNotification = response?.data || null;

  if (createdNotification) {
    setNotifications([createdNotification, ...getNotifications()].slice(0, 30));
  }

  return createdNotification;
};

const markNotificationsRead = async () => {
  const unreadNotifications = getNotifications().filter((notification) => !notification.read);

  if (!unreadNotifications.length) {
    return;
  }

  await Promise.all(unreadNotifications.map((notification) => apiRequest(`/notifications/${notification.id}/read`, {
    method: "PUT",
  })));

  setNotifications(getNotifications().map((notification) => ({
    ...notification,
    read: true,
  })));
};

const deleteNotification = async (notificationId) => {
  await apiRequest(`/notifications/${notificationId}`, {
    method: "DELETE",
  });

  setNotifications(getNotifications().filter((notification) => notification.id !== notificationId));
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

  if (shouldCreateNotification(message, type)) {
    pushNotification(message, type)
      .then(() => {
        renderNotificationMenus();
      })
      .catch(() => {
        // Ignore notification persistence failures so alerts still work.
      });
  }

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

const getPendingOtpEmail = () => {
  try {
    return localStorage.getItem(PENDING_OTP_EMAIL_KEY) || "";
  } catch {
    return "";
  }
};

const setPendingOtpEmail = (email) => {
  try {
    localStorage.setItem(PENDING_OTP_EMAIL_KEY, String(email || "").trim().toLowerCase());
  } catch {
    // Ignore storage errors.
  }
};

const clearPendingOtpEmail = () => {
  try {
    localStorage.removeItem(PENDING_OTP_EMAIL_KEY);
  } catch {
    // Ignore storage errors.
  }
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

    const requestError = new Error(message);
    requestError.status = response.status;

    if (payload && typeof payload === "object") {
      Object.assign(requestError, payload);
    }

    throw requestError;
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
      const formattedRole = displayUser?.role ? displayUser.role.charAt(0).toUpperCase() + displayUser.role.slice(1) : "Staff";
      role.textContent = displayUser?.company?.name ? `${formattedRole} • ${displayUser.company.name}` : formattedRole;
    }

    if (avatar) {
      avatar.innerHTML = displayUser?.profileImage
        ? `<img src="${displayUser.profileImage}" alt="${escapeHtml(displayUser.fullName || "Profile")}" class="profile-avatar-image">`
        : '<i class="bi bi-person-fill"></i>';
    }
  });
};

const getCachedSettings = () => {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_CACHE_KEY) || "null");
  } catch {
    return null;
  }
};

const cacheSettings = (settings) => {
  try {
    localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors.
  }
};

const normalizeHexColor = (value, fallback = "#2F8F12") => {
  const candidate = String(value || "").trim();

  if (/^#[0-9a-f]{6}$/i.test(candidate)) {
    return candidate.toUpperCase();
  }

  return fallback.toUpperCase();
};

const adjustHexColor = (hex, amount) => {
  const normalized = normalizeHexColor(hex).slice(1);
  const clamp = (channel) => Math.max(0, Math.min(255, channel));
  const channels = [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ].map((channel) => clamp(channel + amount));

  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
};

const setSelectValue = (select, value, aliases = {}) => {
  if (!select) {
    return;
  }

  const target = String(value ?? "").trim();
  const alias = aliases[target] || target;
  const options = Array.from(select.options);
  const matchedOption = options.find((option) => option.value === target)
    || options.find((option) => option.value === alias)
    || options.find((option) => option.textContent.trim() === target)
    || options.find((option) => option.textContent.trim() === alias);

  if (matchedOption) {
    select.value = matchedOption.value;
  }
};

const applyDynamicAppStyles = () => {
  const styleId = "dynamicAppSettingsStyles";
  const accent = BRAND_ACCENT;
  const accentDark = adjustHexColor(accent, 24);
  let styleElement = document.getElementById(styleId);

  if (!styleElement) {
    styleElement = document.createElement("style");
    styleElement.id = styleId;
    document.head.appendChild(styleElement);
  }

  styleElement.textContent = `
    .sidebar li.active a,
    .sidebar li:hover a,
    .vehicles-add-btn,
    .btn-checkout,
    .users-add-btn,
    .settings-save-btn,
    .settings-secondary-btn,
    .report-filter-btn,
    .report-export-btn,
    .actions-card button:hover,
    .vehicles-pagination button.active,
    .settings-status-pill,
    .settings-toggle input:checked + .settings-toggle-slider,
    .slot.selected,
    .slot-card.available .slot-card-icon,
    .slot-card.occupied .slot-card-icon,
    .payment-stat-icon,
    .report-stat-icon {
      background: ${accent} !important;
      border-color: ${accent} !important;
    }

    .slot.selected {
      background: transparent !important;
    }

    .sidebar-brand,
    .stat-card span,
    .stat-card i,
    .slot-stat-icon,
    .slot-card.occupied,
    .settings-card-title i,
    .parking-post,
    .parking-post::after,
    .tree,
    .tree::before,
    .tree::after,
    .hill-line,
    .mini-car,
    .mini-car::before,
    .mini-car::after {
      color: ${accent} !important;
      border-color: ${accent} !important;
    }

    .slot.selected {
      border-left-color: ${accent} !important;
      border-bottom-color: ${accent} !important;
    }

    .settings-color-preview,
    .notification-badge,
    .badge.text-bg-success,
    .btn.btn-success,
    .progress-bar.bg-success {
      background: ${accent} !important;
    }

    .vehicles-add-btn:hover,
    .btn-checkout:hover,
    .users-add-btn:hover,
    .settings-save-btn:hover,
    .settings-secondary-btn:hover,
    .report-filter-btn:hover,
    .report-export-btn:hover,
    .vehicles-pagination button:hover {
      background: ${accentDark} !important;
      border-color: ${accentDark} !important;
    }
  `;
};

const applyAppSettings = (settings) => {
  if (!settings) {
    return;
  }

  pageState.settings.data = settings;
  cacheSettings(settings);

  const primaryColor = BRAND_ACCENT;

  document.querySelectorAll(".sidebar-brand").forEach((element) => {
    element.textContent = BRAND_NAME;
  });

  const titleParts = document.title.split("|");
  document.title = titleParts.length > 1
    ? `${BRAND_NAME} | ${titleParts.slice(1).join("|").trim()}`
    : BRAND_NAME;

  rootElement.style.setProperty("--settings-primary-color", primaryColor);
  applyDynamicAppStyles();

  if (settings.theme === "dark" || settings.theme === "light") {
    applyTheme(settings.theme);

    try {
      localStorage.setItem("theme", settings.theme);
      localStorage.setItem("parkflow-theme", settings.theme);
    } catch {
      // Ignore storage errors.
    }
  }

  document.body.classList.remove("sidebar-right");
  document.body.classList.remove("sidebar-compact");

  const systemName = document.getElementById("systemNameValue");
  if (systemName) {
    systemName.textContent = BRAND_NAME;
  }

  const colorValue = document.getElementById("primaryColorValue");
  if (colorValue) {
    colorValue.textContent = primaryColor;
  }

  const colorPicker = document.getElementById("primaryColor");
  if (colorPicker) {
    colorPicker.value = primaryColor;
  }

  const colorPreview = document.querySelector(".settings-color-preview");
  if (colorPreview) {
    colorPreview.style.background = primaryColor;
  }
};

const loadAppSettings = async ({ force = false } = {}) => {
  if (!isProtectedPage()) {
    return null;
  }

  if (!force) {
    const cachedSettings = getCachedSettings();

    if (cachedSettings) {
      applyAppSettings(cachedSettings);
    }
  }

  try {
    const response = await apiRequest("/settings");
    const settings = response.data || null;

    if (settings) {
      applyAppSettings(settings);
    }

    return settings;
  } catch (error) {
    if (!pageState.settings.data) {
      showAlert(error.message, "danger");
    }

    return pageState.settings.data;
  }
};

const renderNotificationMenus = () => {
  const notifications = getNotifications();
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  document.querySelectorAll(".admin").forEach((adminBlock) => {
    const trigger = adminBlock.querySelector(".notification-trigger");
    const badge = adminBlock.querySelector(".notification-badge");
    const menu = adminBlock.querySelector(".notification-menu");
    const list = menu?.querySelector(".notification-list");

    if (badge) {
      badge.textContent = unreadCount > 9 ? "9+" : String(unreadCount);
      badge.hidden = unreadCount === 0;
    }

    if (!list) {
      return;
    }

    list.innerHTML = notifications.length
      ? notifications.map((notification) => `
        <div class="notification-item ${notification.read ? "" : "unread"}">
          <button type="button" class="notification-item-body" data-notification-id="${notification.id}">
            <strong>${escapeHtml(notification.message)}</strong>
            <small>${escapeHtml(formatDateTime(notification.createdAt))}</small>
          </button>
          <button type="button" class="notification-delete-btn" data-delete-notification="${notification.id}" aria-label="Delete notification">
            Delete
          </button>
        </div>
      `).join("")
      : '<div class="notification-empty">No notifications yet.</div>';

    menu.querySelectorAll("[data-notification-id]").forEach((item) => {
      item.addEventListener("click", (event) => {
        event.stopPropagation();
        markNotificationsRead()
          .then(() => {
            renderNotificationMenus();
            adminBlock.classList.remove("notifications-open");
          })
          .catch(() => {
            // Ignore notification update failures in the menu interaction.
          });
      });
    });

    menu.querySelectorAll("[data-delete-notification]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        deleteNotification(button.dataset.deleteNotification)
          .then(() => {
            renderNotificationMenus();
            adminBlock.classList.add("notifications-open");
          })
          .catch(() => {
            // Ignore notification deletion failures in the menu interaction.
          });
      });
    });

    if (trigger) {
      trigger.setAttribute("aria-label", unreadCount ? `${unreadCount} new notifications` : "Notifications");
    }
  });
};

const initializeNotifications = async () => {
  document.querySelectorAll(".admin").forEach((adminBlock) => {
    const bellIcon = adminBlock.querySelector(".bi-bell");

    if (!bellIcon) {
      return;
    }

    bellIcon.classList.add("notification-trigger");
    bellIcon.setAttribute("role", "button");
    bellIcon.setAttribute("tabindex", "0");
    bellIcon.setAttribute("aria-expanded", "false");

    if (!adminBlock.querySelector(".notification-badge")) {
      const badge = document.createElement("span");
      badge.className = "notification-badge";
      badge.hidden = true;
      bellIcon.appendChild(badge);
    }

    if (!adminBlock.querySelector(".notification-menu")) {
      const menu = document.createElement("div");
      menu.className = "notification-menu";
      menu.innerHTML = `
        <div class="notification-menu-card">
          <div class="notification-menu-header">
            <strong>Notifications</strong>
          </div>
          <div class="notification-list"></div>
        </div>
      `;
      adminBlock.appendChild(menu);
    }

    if (!bellIcon.dataset.notificationsReady) {
      bellIcon.dataset.notificationsReady = "true";

      bellIcon.addEventListener("click", (event) => {
        event.stopPropagation();
        document.querySelectorAll(".admin.notifications-open").forEach((block) => {
          if (block !== adminBlock) {
            block.classList.remove("notifications-open");
          }
        });
        adminBlock.classList.remove("profile-open");
        adminBlock.classList.toggle("notifications-open");

        if (adminBlock.classList.contains("notifications-open")) {
          markNotificationsRead()
            .then(() => {
              renderNotificationMenus();
            })
            .catch(() => {
              // Ignore notification update failures in the menu interaction.
            });
        }
      });

      bellIcon.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          bellIcon.click();
        }
      });
    }
  });

  if (!document.body.dataset.notificationOutsideBound) {
    document.body.dataset.notificationOutsideBound = "true";
    document.addEventListener("click", () => {
      document.querySelectorAll(".admin.notifications-open").forEach((block) => {
        block.classList.remove("notifications-open");
      });
    });
  }

  await fetchNotifications();
  renderNotificationMenus();
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

      if (event.target.closest(".notification-trigger") || event.target.closest(".notification-menu")) {
        return;
      }

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

const ensureUserModal = () => {
  let modalElement = document.getElementById("userActionModal");

  if (!modalElement) {
    modalElement = document.createElement("div");
    modalElement.className = "modal fade";
    modalElement.id = "userActionModal";
    modalElement.tabIndex = -1;
    modalElement.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">User</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <form id="userActionForm">
            <div class="modal-body">
              <div class="mb-3">
                <label class="form-label" for="userActionFullName">Full Name</label>
                <input class="form-control" id="userActionFullName" name="fullName" required>
              </div>
              <div class="mb-3">
                <label class="form-label" for="userActionEmail">Email</label>
                <input class="form-control" id="userActionEmail" name="email" type="email" required>
              </div>
              <div class="mb-3">
                <label class="form-label" for="userActionPhone">Phone</label>
                <input class="form-control" id="userActionPhone" name="phone" required>
              </div>
              <div class="mb-3">
                <label class="form-label" for="userActionPassword">Password</label>
                <input class="form-control" id="userActionPassword" name="password" type="password" placeholder="Required for new users">
              </div>
              <div class="mb-3">
                <label class="form-label" for="userActionRole">Role</label>
                <select class="form-select" id="userActionRole" name="role">
                  <option value="attendant">Attendant</option>
                  <option value="manager">Manager</option>
                  <option value="cashier">Cashier</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div class="mb-0">
                <label class="form-label" for="userActionStatus">Status</label>
                <select class="form-select" id="userActionStatus" name="status">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-dark" id="userActionSubmit">Save</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.appendChild(modalElement);
  }

  const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
  const form = modalElement.querySelector("#userActionForm");
  const title = modalElement.querySelector(".modal-title");
  const submitButton = modalElement.querySelector("#userActionSubmit");
  const passwordInput = modalElement.querySelector("#userActionPassword");
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
            fullName: String(formData.get("fullName") || "").trim(),
            email: String(formData.get("email") || "").trim(),
            phone: String(formData.get("phone") || "").trim(),
            role: String(formData.get("role") || "").trim(),
            status: String(formData.get("status") || "").trim(),
          };
          const password = String(formData.get("password") || "").trim();

          if (!payload.fullName) {
            throw new Error("Full name is required");
          }

          if (!payload.email) {
            throw new Error("Email is required");
          }

          if (!payload.phone) {
            throw new Error("Phone is required");
          }

          if (!payload.role) {
            throw new Error("Role is required");
          }

          if (!payload.status) {
            throw new Error("Status is required");
          }

          if (passwordInput.required && !password) {
            throw new Error("Password is required");
          }

          if (password) {
            payload.password = password;
          }

          await submitHandler(payload);
        } catch (error) {
          showAlert(error.message || "Failed to save user.", "danger");
        } finally {
          submitButton.disabled = false;
          submitButton.textContent = originalText;
        }
      });
  }

  return {
    open: ({
      modalTitle,
      submitText,
      defaults = {},
      passwordRequired = true,
      onSubmit,
    }) => {
      title.textContent = modalTitle;
      submitButton.textContent = submitText;
      form.reset();
      form.querySelector('[name="fullName"]').value = defaults.fullName || "";
      form.querySelector('[name="email"]').value = defaults.email || "";
      form.querySelector('[name="phone"]').value = defaults.phone || "";
      form.querySelector('[name="role"]').value = defaults.role || "attendant";
      form.querySelector('[name="status"]').value = defaults.status || "active";
      passwordInput.value = "";
      passwordInput.required = passwordRequired;
      passwordInput.placeholder = passwordRequired ? "Required for new users" : "Leave blank to keep current password";
      submitHandler = onSubmit;
      modal.show();
    },
    close: () => modal.hide(),
  };
};

const loadUsers = async () => {
  const tableBody = document.getElementById("usersTableBody");
  const tableInfo = document.getElementById("usersTableInfo");
  const pagination = document.getElementById("usersPagination");

  if (!tableBody || !tableInfo || !pagination) {
    return;
  }

  renderLoadingRow(tableBody, 7, "Loading users...");

  try {
    const response = await apiRequest(`/users${buildQuery(pageState.users)}`);
    const users = response.data?.users || [];
    const meta = response.data?.pagination || {};
    const userModal = ensureUserModal();

    if (!users.length) {
      renderLoadingRow(tableBody, 7, "No users found.");
    } else {
      tableBody.innerHTML = users.map((user) => `
        <tr>
          <td>${escapeHtml(user.id)}</td>
          <td>${escapeHtml(user.fullName)}</td>
          <td>${escapeHtml(user.email)}</td>
          <td>${escapeHtml(user.role)}</td>
          <td>${escapeHtml(user.phone)}</td>
          <td><span class="user-status-pill ${user.status === "inactive" ? "inactive" : ""}">${escapeHtml(user.status)}</span></td>
          <td>
            <div class="users-action-group">
              <button type="button" class="users-action-btn" data-edit-user="${user.id}" aria-label="Edit user"><i class="bi bi-pencil"></i></button>
              <button type="button" class="users-action-btn" data-delete-user="${user.id}" aria-label="Delete user"><i class="bi bi-trash"></i></button>
            </div>
          </td>
        </tr>
      `).join("");
    }

    const total = meta.total || 0;
    const start = total ? ((meta.page - 1) * meta.limit) + 1 : 0;
    const end = total ? Math.min(meta.page * meta.limit, total) : 0;
    tableInfo.textContent = `Showing ${start} to ${end} of ${total} users`;

    renderPagination(pagination, meta, (nextPage) => {
      pageState.users.page = nextPage;
      loadUsers();
    });

    tableBody.querySelectorAll("[data-edit-user]").forEach((button) => {
      button.addEventListener("click", () => {
        const user = users.find((item) => item.id === button.dataset.editUser);

        if (!user) {
          return;
        }

        userModal.open({
          modalTitle: "Edit User",
          submitText: "Save Changes",
          defaults: user,
          passwordRequired: false,
          onSubmit: async (payload) => {
            await apiRequest(`/users/${user.id}`, {
              method: "PUT",
              body: payload,
            });
            showAlert("User updated successfully");
            userModal.close();
            await loadUsers();
          },
        });
      });
    });

    tableBody.querySelectorAll("[data-delete-user]").forEach((button) => {
      button.addEventListener("click", async () => {
        const user = users.find((item) => item.id === button.dataset.deleteUser);

        if (!user || !window.confirm(`Delete user ${user.fullName}?`)) {
          return;
        }

        try {
          await apiRequest(`/users/${user.id}`, {
            method: "DELETE",
          });
          showAlert("User deleted successfully");
          await loadUsers();
        } catch (error) {
          showAlert(error.message, "danger");
        }
      });
    });
  } catch (error) {
    renderLoadingRow(tableBody, 7, "Failed to load users.");
    showAlert(error.message, "danger");
  }
};

const initializeUsersPage = () => {
  const tableBody = document.getElementById("usersTableBody");

  if (!tableBody) {
    return;
  }

  const userModal = ensureUserModal();

  document.getElementById("userSearch")?.addEventListener("input", (event) => {
    pageState.users.search = event.target.value.trim();
    pageState.users.page = 1;
    loadUsers();
  });

  document.getElementById("filterUsersButton")?.addEventListener("click", () => {
    const role = window.prompt("Filter by role: admin, manager, attendant, cashier", pageState.users.role);

    if (role === null) {
      return;
    }

    const status = window.prompt("Filter by status: active or inactive", pageState.users.status);

    if (status === null) {
      return;
    }

    pageState.users.role = role.trim();
    pageState.users.status = status.trim();
    pageState.users.page = 1;
    loadUsers();
  });

    document.getElementById("addUserButton")?.addEventListener("click", () => {
      userModal.open({
        modalTitle: "Add New User",
        submitText: "Create User",
        passwordRequired: true,
        onSubmit: async (payload) => {
          await apiRequest("/users", {
            method: "POST",
            body: payload,
          });
          showAlert("User created successfully");
          document.getElementById("userActionForm")?.reset();
          userModal.close();
          await loadUsers();
          window.dispatchEvent(new Event("app:dataUpdated"));
        },
      });
    });

  loadUsers();
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
          <div class="rounded-3 w-100" style="height: ${Math.max((Number(item.amount || 0) / maxAmount) * 220, 12)}px; background: linear-gradient(180deg, #2d2d2d 0%, #111 100%);"></div>
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
        <div class="progress-bar" style="width: ${parkedPercent}%; background: #111;">${parkedPercent}%</div>
      </div>
      <div class="d-flex justify-content-between mb-2">
        <span>Parked</span>
        <strong>${parked}</strong>
      </div>
      <div class="progress mb-3" style="height: 16px;">
        <div class="progress-bar" style="width: ${checkedOutPercent}%; background: #2d2d2d;">${checkedOutPercent}%</div>
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

  if (!document.body.dataset.reportRefreshBound) {
    document.body.dataset.reportRefreshBound = "true";
    window.setInterval(() => {
      if (document.getElementById("reportTopSlotsTable") && !document.hidden) {
        loadReports();
      }
    }, 30000);
  }
};

const populateSettingsForm = (settings) => {
  document.getElementById("lotName").value = BRAND_NAME;
  document.getElementById("lotAddress").value = settings.address || "";
  setSelectValue(document.getElementById("lotTimezone"), settings.timezone, {
    "(UTC+02:00) Cairo": "Africa/Cairo",
    "(UTC+03:00) Nairobi": "Africa/Nairobi",
  });
  setSelectValue(document.getElementById("dateFormat"), settings.dateFormat);

  const currencySelect = document.getElementById("currency");
  if (currencySelect) {
    Array.from(currencySelect.options).forEach((option) => {
      if (!option.value) {
        const text = option.textContent.trim();
        option.value = text.startsWith("USD") ? "USD" : text.startsWith("EUR") ? "EUR" : text.startsWith("TZS") ? "TZS" : text;
      }
    });
    setSelectValue(currencySelect, settings.currency);
  }

  document.getElementById("totalParkingSlots").value = String(settings.totalParkingSlots ?? 20);
  document.getElementById("defaultDuration").value = String(settings.defaultParkingDuration ?? 2);
  document.getElementById("gracePeriod").value = String(settings.overstayGracePeriod ?? 15);
  document.getElementById("allowOvernightParking").checked = Boolean(settings.allowOvernightParking);
  document.getElementById("enableSlotSelection").checked = Boolean(settings.enableSlotSelection);
  document.getElementById("autoAssignSlot").checked = Boolean(settings.autoAssignSlot);
  document.getElementById("emailNotifications").checked = Boolean(settings.emailNotifications);
  document.getElementById("smsNotifications").checked = Boolean(settings.smsNotifications);
  document.getElementById("paymentNotifications").checked = Boolean(settings.paymentNotifications);
  document.getElementById("overstayAlerts").checked = Boolean(settings.overstayAlerts);
  document.getElementById("dailySummaryReports").checked = Boolean(settings.dailySummaryReports);
  setSelectValue(document.getElementById("passwordPolicy"), settings.passwordPolicy, {
    Strong: "strong",
    Medium: "medium",
    Basic: "basic",
  });
  document.getElementById("sessionTimeout").value = String(settings.sessionTimeout ?? 30);
  document.getElementById("twoFactorAuthentication").checked = Boolean(settings.twoFactorAuthentication);
  document.getElementById("attemptLimit").value = String(settings.loginAttemptLimit ?? 5);
  document.getElementById("requireStrongPassword").checked = Boolean(settings.requireStrongPassword);
  setSelectValue(document.getElementById("themeSetting"), settings.theme, {
    Dark: "dark",
    Light: "light",
  });
  document.getElementById("primaryColor").value = BRAND_ACCENT;
  setSelectValue(document.getElementById("sidebarPosition"), settings.sidebarPosition, {
    Left: "left",
    Right: "right",
  });
  document.getElementById("compactSidebar").checked = Boolean(settings.compactSidebar);

  applyAppSettings(settings);
};

const collectSettingsFormPayload = () => ({
  parkingLotName: BRAND_NAME,
  address: document.getElementById("lotAddress")?.value.trim(),
  timezone: document.getElementById("lotTimezone")?.value || "Africa/Cairo",
  dateFormat: document.getElementById("dateFormat")?.value || "YYYY-MM-DD HH:mm",
  currency: document.getElementById("currency")?.value || "USD",
  totalParkingSlots: Number(document.getElementById("totalParkingSlots")?.value || 0),
  defaultParkingDuration: Number(document.getElementById("defaultDuration")?.value || 0),
  overstayGracePeriod: Number(document.getElementById("gracePeriod")?.value || 0),
  allowOvernightParking: document.getElementById("allowOvernightParking")?.checked ?? false,
  enableSlotSelection: document.getElementById("enableSlotSelection")?.checked ?? false,
  autoAssignSlot: document.getElementById("autoAssignSlot")?.checked ?? false,
  emailNotifications: document.getElementById("emailNotifications")?.checked ?? false,
  smsNotifications: document.getElementById("smsNotifications")?.checked ?? false,
  paymentNotifications: document.getElementById("paymentNotifications")?.checked ?? false,
  overstayAlerts: document.getElementById("overstayAlerts")?.checked ?? false,
  dailySummaryReports: document.getElementById("dailySummaryReports")?.checked ?? false,
  passwordPolicy: String(document.getElementById("passwordPolicy")?.value || "strong").toLowerCase(),
  sessionTimeout: Number(document.getElementById("sessionTimeout")?.value || 0),
  twoFactorAuthentication: document.getElementById("twoFactorAuthentication")?.checked ?? false,
  loginAttemptLimit: Number(document.getElementById("attemptLimit")?.value || 0),
  requireStrongPassword: document.getElementById("requireStrongPassword")?.checked ?? false,
  theme: String(document.getElementById("themeSetting")?.value || "light").toLowerCase(),
  primaryColor: BRAND_ACCENT,
  sidebarPosition: String(document.getElementById("sidebarPosition")?.value || "left").toLowerCase(),
  compactSidebar: document.getElementById("compactSidebar")?.checked ?? false,
});

const updateSettingsInfoPanel = async (settings) => {
  const versionValue = document.getElementById("systemVersionValue");
  const lastBackupValue = document.getElementById("lastBackupValue");
  const totalUsersValue = document.getElementById("totalUsersValue");
  const totalVehiclesValue = document.getElementById("totalVehiclesValue");

  if (versionValue) {
    versionValue.textContent = "1.0.0";
  }

  if (lastBackupValue) {
    const backupAt = localStorage.getItem(SETTINGS_BACKUP_KEY) || settings?.updatedAt;
    lastBackupValue.textContent = backupAt ? formatDateTime(backupAt) : "Not yet backed up";
  }

  try {
    const [usersResponse, vehiclesResponse] = await Promise.all([
      apiRequest("/users?page=1&limit=1"),
      apiRequest("/vehicles?page=1&limit=1"),
    ]);

    if (totalUsersValue) {
      totalUsersValue.textContent = String(usersResponse.data?.pagination?.total ?? 0);
    }

    if (totalVehiclesValue) {
      totalVehiclesValue.textContent = String(vehiclesResponse.data?.pagination?.total ?? 0);
    }
  } catch {
    if (totalUsersValue && totalUsersValue.textContent === "--") {
      totalUsersValue.textContent = "N/A";
    }

    if (totalVehiclesValue && totalVehiclesValue.textContent === "--") {
      totalVehiclesValue.textContent = "N/A";
    }
  }
};

const initializeSettingsPage = async () => {
  const saveButton = document.getElementById("saveSettingsButton");

  if (!saveButton) {
    return;
  }

  const backupButton = document.getElementById("backupSettingsButton");
  const colorPicker = document.getElementById("primaryColor");
  const isAdmin = pageState.currentUser?.role === "admin";

  if (!isAdmin) {
    saveButton.disabled = true;
    saveButton.title = "Only admins can update settings";

    if (backupButton) {
      backupButton.disabled = true;
      backupButton.title = "Only admins can create a settings backup";
    }
  }

  const settings = await loadAppSettings({ force: true });

  if (settings) {
    populateSettingsForm(settings);
    await updateSettingsInfoPanel(settings);
  }

  colorPicker?.addEventListener("input", (event) => {
    const previewSettings = {
      ...(pageState.settings.data || {}),
      primaryColor: BRAND_ACCENT,
      theme: document.getElementById("themeSetting")?.value || pageState.settings.data?.theme || "light",
      sidebarPosition: "left",
      compactSidebar: false,
      parkingLotName: BRAND_NAME,
    };

    applyAppSettings(previewSettings);
  });

  document.getElementById("themeSetting")?.addEventListener("change", () => {
    applyAppSettings({
      ...(pageState.settings.data || {}),
      ...collectSettingsFormPayload(),
    });
  });

  document.getElementById("sidebarPosition")?.addEventListener("change", () => {
    applyAppSettings({
      ...(pageState.settings.data || {}),
      ...collectSettingsFormPayload(),
    });
  });

  document.getElementById("compactSidebar")?.addEventListener("change", () => {
    applyAppSettings({
      ...(pageState.settings.data || {}),
      ...collectSettingsFormPayload(),
    });
  });

  document.getElementById("lotName")?.addEventListener("input", () => {
    applyAppSettings({
      ...(pageState.settings.data || {}),
      parkingLotName: BRAND_NAME,
      primaryColor: BRAND_ACCENT,
      theme: document.getElementById("themeSetting")?.value || pageState.settings.data?.theme,
      sidebarPosition: "left",
      compactSidebar: false,
    });
  });

  saveButton.addEventListener("click", async () => {
    if (!isAdmin) {
      showAlert("Only admins can update settings.", "danger");
      return;
    }

    const originalText = saveButton.innerHTML;
    saveButton.disabled = true;
    saveButton.innerHTML = '<i class="bi bi-hourglass-split"></i> Saving...';

    try {
      const payload = collectSettingsFormPayload();
      const response = await apiRequest("/settings", {
        method: "PUT",
        body: payload,
      });

      const updatedSettings = response.data || payload;
      applyAppSettings(updatedSettings);
      populateSettingsForm(updatedSettings);
      await updateSettingsInfoPanel(updatedSettings);
      showAlert("Settings updated successfully");
    } catch (error) {
      showAlert(error.message, "danger");
    } finally {
      saveButton.disabled = false;
      saveButton.innerHTML = originalText;
    }
  });

  backupButton?.addEventListener("click", async () => {
    if (!isAdmin) {
      showAlert("Only admins can create a settings backup.", "danger");
      return;
    }

    try {
      const settingsToBackup = pageState.settings.data || collectSettingsFormPayload();
      const timestamp = new Date().toISOString();
      const backupBlob = new Blob([JSON.stringify(settingsToBackup, null, 2)], {
        type: "application/json",
      });
      const downloadUrl = URL.createObjectURL(backupBlob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `settings-backup-${timestamp.replace(/[:.]/g, "-")}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
      localStorage.setItem(SETTINGS_BACKUP_KEY, timestamp);
      await updateSettingsInfoPanel(settingsToBackup);
      showAlert("Settings backup downloaded successfully");
    } catch (error) {
      showAlert(error.message || "Failed to create settings backup.", "danger");
    }
  });
};

const initializeAuthPages = () => {
  const loginForm = document.getElementById("loginForm");
  const signupForm = document.getElementById("signupForm");
  const otpSection = document.getElementById("signupOtpSection");
  const otpInput = document.getElementById("signupOtpCode");
  const otpMessage = document.getElementById("signupOtpMessage");
  const verifyOtpButton = document.getElementById("verifySignupOtpButton");
  const resendOtpButton = document.getElementById("resendSignupOtpButton");
  const signupEmailInput = document.getElementById("signupEmail");

  const showSignupOtpSection = (email, options = {}) => {
    const {
      disableSignupFields = false,
      message = "We sent a verification code to your email.",
    } = options;

    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!otpSection || !otpInput || !normalizedEmail) {
      return;
    }

    setPendingOtpEmail(normalizedEmail);
    otpSection.classList.remove("d-none");
    otpMessage.textContent = `${message} ${normalizedEmail}`;
    otpInput.value = "";

    if (signupEmailInput) {
      signupEmailInput.value = normalizedEmail;
    }

    if (signupForm && disableSignupFields) {
      signupForm.querySelectorAll("input, select, button").forEach((element) => {
        element.disabled = true;
      });
    }
  };

  const verifySignupOtp = async () => {
    const pendingEmail = getPendingOtpEmail() || signupEmailInput?.value.trim().toLowerCase();

    if (!pendingEmail) {
      showAlert("Please sign up first so we know which email to verify.", "danger");
      return;
    }

    if (!otpInput?.value.trim()) {
      showAlert("Please enter the 6-digit OTP code.", "danger");
      return;
    }

    if (verifyOtpButton) {
      verifyOtpButton.disabled = true;
      verifyOtpButton.textContent = "Verifying...";
    }

    try {
      const response = await apiRequest("/auth/verify-email-otp", {
        auth: false,
        method: "POST",
        body: {
          email: pendingEmail,
          otp: otpInput.value.trim(),
        },
      });

      clearPendingOtpEmail();
      showAlert(response.message || "Email verified successfully");

      if (response.data?.token && response.data?.user) {
        setAuthSession(response.data.token, response.data.user);
        window.location.href = "dashboard.html";
        return;
      }

      window.location.href = "login.html";
    } catch (error) {
      showAlert(error.message, "danger");
    } finally {
      if (verifyOtpButton) {
        verifyOtpButton.disabled = false;
        verifyOtpButton.textContent = "Verify OTP";
      }
    }
  };

  const resendSignupOtp = async () => {
    const pendingEmail = getPendingOtpEmail() || signupEmailInput?.value.trim().toLowerCase();

    if (!pendingEmail) {
      showAlert("Please enter your signup email first.", "danger");
      return;
    }

    if (resendOtpButton) {
      resendOtpButton.disabled = true;
      resendOtpButton.textContent = "Sending...";
    }

    try {
      const response = await apiRequest("/auth/resend-email-otp", {
        auth: false,
        method: "POST",
        body: {
          email: pendingEmail,
        },
      });

      setPendingOtpEmail(pendingEmail);
      showAlert(response.message || "A new verification code has been sent.");
    } catch (error) {
      showAlert(error.message, "danger");
    } finally {
      if (resendOtpButton) {
        resendOtpButton.disabled = false;
        resendOtpButton.textContent = "Resend OTP";
      }
    }
  };

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
        if (error.requiresOtp && error.email) {
          setPendingOtpEmail(error.email);
          showAlert(error.message, "danger");
          window.location.href = `signup.html?verifyEmail=${encodeURIComponent(error.email)}`;
          return;
        }

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
            companyName: document.getElementById("parkingLotName")?.value.trim(),
          },
        });

        showSignupOtpSection(response.data?.email || document.getElementById("signupEmail")?.value.trim(), {
          disableSignupFields: true,
          message: "We sent a verification code to your email.",
        });
        showAlert(response.message || "Signup successful. Please verify your email.");
      } catch (error) {
        showAlert(error.message, "danger");
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = originalText;
      }
    });
  }

  if (verifyOtpButton) {
    verifyOtpButton.addEventListener("click", verifySignupOtp);
  }

  if (resendOtpButton) {
    resendOtpButton.addEventListener("click", resendSignupOtp);
  }

  otpInput?.addEventListener("input", () => {
    otpInput.value = otpInput.value.replace(/\D/g, "").slice(0, 6);
  });

  otpInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      verifySignupOtp();
    }
  });

  if (otpSection) {
    const params = new URLSearchParams(window.location.search);
    const emailFromQuery = params.get("verifyEmail");
    const pendingEmail = emailFromQuery || getPendingOtpEmail();

    if (pendingEmail) {
      showSignupOtpSection(pendingEmail, {
        disableSignupFields: false,
        message: "We sent a verification code to your email.",
      });
    }
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
    await loadAppSettings();
  }

  await initializeNotifications();
  initializeProfileMenu();

  initializeDashboardPage();
  initializeVehiclesPage();
  initializeParkingSlotsPage();
  initializeTransactionsPage();
  initializePaymentsPage();
  initializeReportsPage();
  initializeUsersPage();
  await initializeSettingsPage();
};

initializeApp();
