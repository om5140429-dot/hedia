import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

puppeteer.use(StealthPlugin());

const HLS_PATTERN = /\.m3u8(\?|#|$)/i;
const MP4_PATTERN = /\.mp4(\?|#|$)/i;
const PLAY_SELECTOR = [
  "video",
  "button",
  "[role='button']",
  "[class*='play' i]",
  "[id*='play' i]",
  "[aria-label*='play' i]",
  "[title*='play' i]",
].join(",");
const PLAY_LABEL = /(^|[^a-z])play|تشغيل|مشاهدة/i;
const MAX_CLICKS_PER_FRAME = 5;
const ROUND_DELAY_MS = 2500;
const SCRAPE_TIMEOUT_MS = 45000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function clickPlayControls(page) {
  for (const frame of page.frames()) {
    const handles = await frame.$$(PLAY_SELECTOR).catch(() => []);
    let clicks = 0;
    for (const handle of handles) {
      if (clicks >= MAX_CLICKS_PER_FRAME) break;
      const target = await handle
        .evaluate((el) => {
          const rect = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          const visible =
            rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
          const isVideo = el.tagName === "VIDEO";
          if (isVideo) {
            el.muted = true;
            el.play().catch(() => {});
          }
          const label = `${el.innerText || ""} ${el.getAttribute("aria-label") || ""} ${el.title || ""} ${el.id || ""} ${el.getAttribute("class") || ""}`;
          return { visible, isVideo, label };
        })
        .catch(() => null);
      if (!target?.visible) continue;
      if (!target.isVideo && !PLAY_LABEL.test(target.label)) continue;
      const clicked = await handle.click({ delay: 50 }).then(
        () => true,
        () => false
      );
      if (clicked) clicks += 1;
    }
  }
}

export async function extractStreamUrl(pageUrl) {
  // تم تعديل مسار التنفيذ وإزالة الأعلام الخاصة بـ Docker لتناسب بيئة Termux على الأندرويد
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox", 
      "--disable-setuid-sandbox", 
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--autoplay-policy=no-user-gesture-required"
    ],
  });

  try {
    const page = await browser.newPage();
    const captured = { hls: null, mp4: null };

    browser.on("targetcreated", async (target) => {
      if (target.type() !== "page") return;
      const popup = await target.page().catch(() => null);
      if (popup && popup !== page) await popup.close().catch(() => {});
    });

    page.on("request", (request) => {
      const url = request.url();
      if (!captured.hls && HLS_PATTERN.test(url)) captured.hls = url;
      else if (!captured.mp4 && MP4_PATTERN.test(url)) captured.mp4 = url;
    });

    await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 60000 });

    const deadline = Date.now() + SCRAPE_TIMEOUT_MS;
    while (!captured.hls && Date.now() < deadline) {
      await clickPlayControls(page);
      await sleep(ROUND_DELAY_MS);
    }

    return captured.hls ?? captured.mp4;
  } finally {
    await browser.close();
  }
}
