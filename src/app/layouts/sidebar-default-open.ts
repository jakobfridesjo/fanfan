const SIDEBAR_COOKIE_NAME = "sidebar_state";

export function getSidebarDefaultOpen(
  cookie = typeof document === "undefined" ? "" : document.cookie
) {
  const sidebarState = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SIDEBAR_COOKIE_NAME}=`))
    ?.slice(SIDEBAR_COOKIE_NAME.length + 1);

  if (sidebarState === "true") {
    return true;
  }

  if (sidebarState === "false") {
    return false;
  }

  return true;
}
