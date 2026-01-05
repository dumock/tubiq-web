# routes_tiktok.py
from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import List, Dict, Any
import json, urllib.parse, urllib.request
from playwright.sync_api import sync_playwright

router = APIRouter(prefix="/api/tiktok/web", tags=["tiktok-web"])

MOBILE_UA = (
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Mobile Safari/537.36"
)

def _oembed(url: str) -> Dict[str, Any]:
    try:
        enc = urllib.parse.quote(url, safe="")
        with urllib.request.urlopen(f"https://www.tiktok.com/oembed?url={enc}", timeout=8) as r:
            return json.loads(r.read().decode("utf-8"))
    except Exception:
        return {}

def _collect(page, limit: int):
    js = r"""
    () => {
      const seen = new Set(), out = [];
      for (const a of document.querySelectorAll('a[href*="/video/"]')) {
        const href = a.getAttribute('href') || '';
        const m = href.match(/\/video\/(\d+)/);
        if (m && !seen.has(m[1])) { seen.add(m[1]); out.push(m[1]); }
      }
      return out;
    }
    """
    ids = []
    for _ in range(30):
        ids = list(dict.fromkeys(ids + (page.evaluate(js) or [])))
        if len(ids) >= limit: break
        page.mouse.wheel(0, 2000)
        page.wait_for_timeout(900)
    return ids[:limit]

@router.get("/scrape_user_posts")
def scrape_user_posts(handle: str = Query(..., min_length=1), count: int = 12):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)  # 서버에선 headless + Xvfb 권장
        ctx = browser.new_context(
            user_agent=MOBILE_UA,
            viewport={"width": 412, "height": 915},
            device_scale_factor=2.625,
            is_mobile=True, has_touch=True,
            locale="en-US", timezone_id="America/Los_Angeles",
            extra_http_headers={"Accept-Language": "en-US,en;q=0.9,ko;q=0.8",
                                "Referer": "https://www.tiktok.com/"},
        )
        page = ctx.new_page()
        # 쿠키 예열
        page.goto("https://www.tiktok.com/?lang=en", wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(800)
        for sel in [
            'button:has-text("Accept all")', 'button:has-text("I agree")',
            'button:has-text("동의")', '[data-e2e="cookie-banner-accept-button"]',
        ]:
            try:
                page.locator(sel).first.click(timeout=600)
                page.wait_for_timeout(300)
                break
            except: pass

        # 프로필 진입
        page.goto(f"https://www.tiktok.com/@{handle}?lang=en", wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(1200)

        # 내장 JSON 시도
        state_str = page.evaluate("""() => {
          const a = document.querySelector('#SIGI_STATE');
          if (a) return a.textContent;
          const b = document.querySelector('#__UNIVERSAL_DATA_FOR_REHYDRATION__');
          return b ? b.textContent : null;
        }""")
        items: List[Dict[str, Any]] = []

        def norm_from_state(state: Dict[str, Any]) -> List[Dict[str, Any]]:
            itemlist = (state.get("ItemList") or {}).get("user-posts") or {}
            sec = (state.get("UserPage") or {}).get("secUid")
            ids = []
            if sec and sec in itemlist:
                ids = (itemlist[sec] or {}).get("list") or []
            else:
                for v in itemlist.values():
                    if isinstance(v, dict) and "list" in v:
                        ids = v["list"]; break
            modules = state.get("ItemModule") or {}
            out = []
            for vid in (ids or [])[:count]:
                it = modules.get(str(vid)) or {}
                desc = it.get("desc") or it.get("title") or (it.get("shareInfo") or {}).get("shareTitle") or ""
                video = it.get("video") or {}
                cov = (video.get("cover") or video.get("originCover") or {})
                url_list = cov.get("urlList") or cov.get("url_list") or []
                cover = url_list[0] if url_list else (cov.get("url") or "")
                out.append({
                    "aweme_id": str(vid),
                    "desc": desc,
                    "author": {"unique_id": handle},
                    "video": {"cover": {"url_list": [cover] if cover else []}},
                    "statistics": {"play_count": 0},
                    "video_url": f"https://www.tiktok.com/@{handle}/video/{vid}",
                })
            return out

        if state_str:
            try:
                items = norm_from_state(json.loads(state_str))
            except: pass

        # DOM 폴백
        if not items:
            ids = _collect(page, count)
            for vid in ids:
                url = f"https://www.tiktok.com/@{handle}/video/{vid}"
                meta = _oembed(url)
                items.append({
                    "aweme_id": str(vid),
                    "desc": meta.get("title", ""),
                    "author": {"unique_id": handle},
                    "video": {"cover": {"url_list": [meta.get("thumbnail_url","")] if meta.get("thumbnail_url") else []}},
                    "statistics": {"play_count": 0},
                    "video_url": url,
                })

        ctx.close(); browser.close()
    return {"status_code": 0, "aweme_list": items}
