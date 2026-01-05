# main.py - Douyin Metadata Scraper API
import re
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Douyin Worker", version="1.0.0")

# CORS for cross-origin requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mobile User-Agent for better compatibility with Douyin
HEADERS = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}


def extract_og_meta(html: str, prop: str) -> str:
    """Extract Open Graph meta tag content"""
    pattern = rf'<meta[^>]+property=["\']og:{prop}["\'][^>]+content=["\']([^"\']+)["\']'
    match = re.search(pattern, html, re.I)
    if match:
        return match.group(1)
    # Try alternate format
    pattern = rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:{prop}["\']'
    match = re.search(pattern, html, re.I)
    return match.group(1) if match else ""


def extract_title_from_html(html: str) -> str:
    """Extract title from HTML"""
    # Try og:title first
    title = extract_og_meta(html, "title")
    if title and "Douyin" not in title:
        return title.replace(" - Douyin", "").strip()
    
    # Fallback to <title> tag
    match = re.search(r'<title[^>]*>([^<]+)</title>', html, re.I)
    if match:
        title = match.group(1).replace(" - Douyin", "").strip()
        return title
    return "No Title"


async def scrape_douyin(url: str) -> dict:
    """Scrape Douyin video metadata using HTTP requests (no browser)"""
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
            response = await client.get(url, headers=HEADERS)
            
            if response.status_code != 200:
                return {"success": False, "error": f"HTTP {response.status_code}"}
            
            html = response.text
            final_url = str(response.url)
            
            # Extract metadata
            title = extract_title_from_html(html)
            thumbnail = extract_og_meta(html, "image")
            author = extract_og_meta(html, "site_name") or "Douyin"
            description = extract_og_meta(html, "description")
            
            # Try to get author from description or other meta
            if author == "Douyin" or not author:
                # Sometimes author is in description like "@username"
                author_match = re.search(r'@([^\s]+)', description or "")
                if author_match:
                    author = author_match.group(1)
            
            return {
                "success": True,
                "title": title,
                "thumbnail_url": thumbnail,
                "author": author,
                "description": description,
                "url": final_url
            }
            
    except httpx.TimeoutException:
        return {"success": False, "error": "Request timeout"}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.get("/")
async def root():
    return {"status": "ok", "service": "douyin-worker-python"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.get("/api/info")
async def get_info(url: str):
    """Get Douyin video metadata"""
    if not url:
        raise HTTPException(status_code=400, detail="Missing url parameter")
    
    result = await scrape_douyin(url)
    return result


@app.get("/api/thumb")
async def get_thumb(url: str):
    """Get thumbnail URL for Douyin video (compatibility endpoint)"""
    if not url:
        raise HTTPException(status_code=400, detail="Missing url parameter")
    
    result = await scrape_douyin(url)
    if result.get("success"):
        return {"thumbnail_url": result.get("thumbnail_url", "")}
    return result


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
