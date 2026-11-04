// Minimal user-agent parsing for device, browser and OS breakdowns.

export type DeviceInfo = { deviceType: "desktop" | "mobile" | "tablet"; browser: string; os: string };

export function parseUserAgent(ua: string | null | undefined): DeviceInfo {
  const s = ua ?? "";

  const tablet = /iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(s) || (/Macintosh/.test(s) && /Mobile\//.test(s));
  const mobile = !tablet && /Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(s);
  const deviceType = tablet ? "tablet" : mobile ? "mobile" : "desktop";

  const browser = /Edg\//.test(s)
    ? "Edge"
    : /OPR\/|Opera/.test(s)
      ? "Opera"
      : /SamsungBrowser/.test(s)
        ? "Samsung Internet"
        : /Firefox\/|FxiOS/.test(s)
          ? "Firefox"
          : /Chrome\/|CriOS/.test(s)
            ? "Chrome"
            : /Safari\//.test(s)
              ? "Safari"
              : "Other";

  const os = /Windows NT/.test(s)
    ? "Windows"
    : /iPhone|iPad|iPod/.test(s)
      ? "iOS"
      : /Android/.test(s)
        ? "Android"
        : /Mac OS X|Macintosh/.test(s)
          ? "macOS"
          : /CrOS/.test(s)
            ? "ChromeOS"
            : /Linux/.test(s)
              ? "Linux"
              : "Other";

  return { deviceType, browser, os };
}
