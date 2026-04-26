(() => {
  const API_BASE_URL = "https://verax.up.railway.app/api";
  const AUTH_TOKEN_KEY = "token";
  const AUTH_USER_KEY = "user";

  const appState = {
    currentUser: null,
    settings: null,
    dashboardOverview: null,
  };

  const safeStorageGet = (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  };

  const safeStorageSet = (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Ignore storage access issues.
    }
  };

  const safeStorageRemove = (key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore storage access issues.
    }
  };

  const getToken = () => safeStorageGet(AUTH_TOKEN_KEY);

  const getStoredUser = () => {
    const rawUser = safeStorageGet(AUTH_USER_KEY);

    if (!rawUser) {
      return null;
    }

    try {
      const user = JSON.parse(rawUser);
      appState.currentUser = user;
      return user;
    } catch {
      safeStorageRemove(AUTH_USER_KEY);
      return null;
    }
  };

  const setSession = (token, user) => {
    if (token) {
      safeStorageSet(AUTH_TOKEN_KEY, token);
    }

    if (user) {
      safeStorageSet(AUTH_USER_KEY, JSON.stringify(user));
      appState.currentUser = user;
    }
  };

  const clearSession = () => {
    safeStorageRemove(AUTH_TOKEN_KEY);
    safeStorageRemove(AUTH_USER_KEY);
    appState.currentUser = null;
  };

  const redirectToLogin = () => {
    clearSession();

    if (!window.location.pathname.endsWith("login.html")) {
      window.location.href = "login.html";
    }
  };

  const parseResponsePayload = async (response, responseType) => {
    if (responseType === "blob") {
      return response.blob();
    }

    const text = await response.text();

    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch {
      return { success: false, message: text };
    }
  };

  const request = async (endpoint, options = {}) => {
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

    if (body !== undefined && !(body instanceof FormData) && !requestHeaders["Content-Type"]) {
      requestHeaders["Content-Type"] = "application/json";
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers: requestHeaders,
      body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    });

    const payload = await parseResponsePayload(response, responseType);

    if (response.status === 401) {
      redirectToLogin();
      throw new Error(payload?.message || "Authentication required");
    }

    if (!response.ok || (payload && payload.success === false)) {
      throw new Error(payload?.message || "Request failed");
    }

    return payload;
  };

  const authFetch = (endpoint, options = {}) => request(endpoint, { ...options, auth: true });
  const publicFetch = (endpoint, options = {}) => request(endpoint, { ...options, auth: false });

  const refreshDashboardData = async () => {
    const response = await authFetch("/dashboard/overview");
    appState.dashboardOverview = response?.data || null;
    return appState.dashboardOverview;
  };

  const refreshSettingsData = async () => {
    const response = await authFetch("/settings");
    appState.settings = response?.data || null;
    return appState.settings;
  };

  const dispatchDataUpdated = () => {
    window.dispatchEvent(new Event("app:dataUpdated"));
  };

  window.ParkingApp = {
    API_BASE_URL,
    appState,
    getToken,
    getStoredUser,
    setSession,
    clearSession,
    redirectToLogin,
    request,
    authFetch,
    publicFetch,
    refreshDashboardData,
    refreshSettingsData,
    dispatchDataUpdated,
  };
})();
