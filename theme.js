(() => {
  const normalizeTheme = (theme) => (theme === "dark" ? "dark" : "light");

  const updateThemeButtons = (theme) => {
    document.querySelectorAll("[data-theme-toggle]").forEach((toggle) => {
      const nextTheme = theme === "dark" ? "light" : "dark";
      const label = toggle.querySelector("[data-theme-label]");

      toggle.setAttribute("aria-pressed", String(theme === "dark"));
      toggle.setAttribute("aria-label", `Switch to ${nextTheme} mode`);

      if (label) {
        label.textContent = `${nextTheme.charAt(0).toUpperCase()}${nextTheme.slice(1)} Mode`;
      }

      if (!toggle.dataset.themeBound) {
        toggle.dataset.themeBound = "true";
        toggle.addEventListener("click", () => {
          toggleTheme();
        });
      }
    });
  };

  function applyTheme(theme, options = {}) {
    const { emit = false } = options;
    const nextTheme = normalizeTheme(theme);

    document.documentElement.setAttribute("data-theme", nextTheme);

    try {
      localStorage.setItem("theme", nextTheme);
      localStorage.setItem("parkflow-theme", nextTheme);
    } catch {
      // Ignore storage access issues.
    }

    updateThemeButtons(nextTheme);

    if (emit) {
      window.dispatchEvent(new Event("theme:changed"));
    }
  }

  function loadTheme() {
    let storedTheme = "light";

    try {
      storedTheme = localStorage.getItem("theme") || localStorage.getItem("parkflow-theme") || "light";
    } catch {
      storedTheme = "light";
    }

    applyTheme(storedTheme);
  }

  function toggleTheme() {
    const currentTheme = normalizeTheme(document.documentElement.getAttribute("data-theme"));
    const nextTheme = currentTheme === "light" ? "dark" : "light";
    applyTheme(nextTheme, { emit: true });
  }

  loadTheme();

  document.addEventListener("DOMContentLoaded", () => {
    loadTheme();
    updateThemeButtons(normalizeTheme(document.documentElement.getAttribute("data-theme")));
  });

  window.Theme = {
    applyTheme,
    loadTheme,
    toggleTheme,
  };
})();
