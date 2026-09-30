// Shared by the server layout and the client theme hook (no "use client" here on purpose).
export const THEME_STORAGE_KEY = "rasoisaathi-theme";

/** Runs before first paint (see app/layout.js) so there's no light-to-dark flash. */
export const themeBootScript = `try{document.documentElement.setAttribute("data-theme",localStorage.getItem("${THEME_STORAGE_KEY}")==="dark"?"dark":"light")}catch(e){}`;
