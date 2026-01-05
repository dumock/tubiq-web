# main.py - Standalone Douyin Metadata Scraper
# Based on TubiQ/Douyin_TikTok_Download_API approach
# Extracts video metadata from Douyin share URLs using embedded JSON data

import re
import json
import urllib.parse
import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Douyin Worker", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Headers that mimic a mobile browser
HEADERS = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Referer": "https://www.douyin.com/",
}


async def extract_aweme_id(url: str) -> str:
    """Extract aweme_id (video ID) from various Douyin URL formats"""
    # Handle short URLs (v.douyin.com) - follow redirect
    if "v.douyin.com" in url or "vm.douyin.com" in url:
        async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
            response = await client.get(url, headers=HEADERS)
            url = str(response.url)
    
    # Extract aweme_id from full URL
    # Patterns: /video/123456, /note/123456, modal_id=123456
    patterns = [
        r'/video/(\d+)',
        r'/note/(\d+)',
        r'modal_id=(\d+)',
        r'/(\d{19})',  # 19-digit ID in path
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    
    return None


async def fetch_video_detail(aweme_id: str) -> dict:
    """Fetch video details from Douyin's web page"""
    # Douyin embeds video data in the page as JSON
    detail_url = f"https://www.douyin.com/video/{aweme_id}"
    
    async with httpx.AsyncClient(follow_redirects=True, timeout=20.0) as client:
        response = await client.get(detail_url, headers=HEADERS)
        html = response.text
        
        # Method 1: Extract from RENDER_DATA script tag
        render_data_match = re.search(
            r'<script id="RENDER_DATA" type="application/json">([^<]+)</script>',
            html
        )
        
        if render_data_match:
            try:
                # RENDER_DATA is URL-encoded JSON
                encoded_data = render_data_match.group(1)
                decoded_data = urllib.parse.unquote(encoded_data)
                data = json.loads(decoded_data)
                
                # Navigate the nested structure to find video data
                # Structure varies, but video data is usually in one of these paths
                for key in data:
                    if isinstance(data[key], dict):
                        # Look for aweme or detail in nested structure
                        item = data[key]
                        if "aweme" in str(item).lower():
                            # Found aweme data, extract it
                            return extract_video_from_render_data(data, aweme_id)
                
                return extract_video_from_render_data(data, aweme_id)
            except json.JSONDecodeError as e:
                print(f"[Worker] JSON decode error: {e}")
        
        # Method 2: Fallback to OG tags
        return extract_from_og_tags(html)


def extract_video_from_render_data(data: dict, aweme_id: str) -> dict:
    """Extract video info from RENDER_DATA structure"""
    result = {
        "success": True,
        "aweme_id": aweme_id,
        "title": "",
        "thumbnail_url": "",
        "author": "",
        "author_id": "",
        "view_count": 0,
        "like_count": 0,
        "create_time": None,
    }
    
    # Deep search for video data in the nested structure
    def find_aweme(obj, depth=0):
        if depth > 10:  # Prevent infinite recursion
            return None
        if isinstance(obj, dict):
            # Check if this is the aweme object
            if "desc" in obj and ("video" in obj or "images" in obj):
                return obj
            if "aweme" in obj:
                found = find_aweme(obj["aweme"], depth + 1)
                if found:
                    return found
            if "detail" in obj:
                found = find_aweme(obj["detail"], depth + 1)
                if found:
                    return found
            # Check all nested dicts
            for key, value in obj.items():
                if isinstance(value, (dict, list)):
                    found = find_aweme(value, depth + 1)
                    if found:
                        return found
        elif isinstance(obj, list):
            for item in obj:
                if isinstance(item, (dict, list)):
                    found = find_aweme(item, depth + 1)
                    if found:
                        return found
        return None
    
    aweme = find_aweme(data)
    
    if aweme:
        result["title"] = aweme.get("desc", "")
        
        # Extract cover/thumbnail
        video = aweme.get("video", {})
        if video:
            cover = video.get("cover", {})
            if isinstance(cover, dict):
                url_list = cover.get("url_list", [])
                if url_list:
                    result["thumbnail_url"] = url_list[0]
            elif isinstance(cover, str):
                result["thumbnail_url"] = cover
            
            # Fallback covers
            if not result["thumbnail_url"]:
                result["thumbnail_url"] = (
                    video.get("origin_cover", {}).get("url_list", [""])[0] or
                    video.get("dynamic_cover", {}).get("url_list", [""])[0] or
                    ""
                )
        
        # Extract author
        author = aweme.get("author", {})
        if author:
            result["author"] = author.get("nickname", "")
            result["author_id"] = author.get("unique_id", "") or author.get("sec_uid", "")
        
        # Extract statistics
        stats = aweme.get("statistics", {})
        if stats:
            result["view_count"] = stats.get("play_count", 0) or stats.get("digg_count", 0)
            result["like_count"] = stats.get("digg_count", 0)
        
        # Extract create time
        result["create_time"] = aweme.get("create_time")
    
    return result


def extract_from_og_tags(html: str) -> dict:
    """Fallback: Extract from Open Graph meta tags"""
    result = {
        "success": True,
        "title": "",
        "thumbnail_url": "",
        "author": "",
    }
    
    # og:title
    match = re.search(r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)["\']', html, re.I)
    if not match:
        match = re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:title["\']', html, re.I)
    if match:
        result["title"] = match.group(1).replace(" - Douyin", "").strip()
    
    # og:image
    match = re.search(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']', html, re.I)
    if not match:
        match = re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']', html, re.I)
    if match:
        result["thumbnail_url"] = match.group(1)
    
    return result


@app.get("/")
async def root():
    return {"status": "ok", "service": "douyin-worker-v2"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.get("/api/info")
async def get_info(url: str = Query(..., description="Douyin video URL")):
    """Get complete video metadata from Douyin URL"""
    if not url:
        raise HTTPException(status_code=400, detail="Missing url parameter")
    
    try:
        # Extract video ID
        aweme_id = await extract_aweme_id(url)
        
        if not aweme_id:
            # If can't extract ID, try direct scraping
            async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
                response = await client.get(url, headers=HEADERS)
                return extract_from_og_tags(response.text)
        
        # Fetch full video details
        result = await fetch_video_detail(aweme_id)
        return result
        
    except httpx.TimeoutException:
        return {"success": False, "error": "Request timeout"}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.get("/api/hybrid/video_data")
async def hybrid_video_data(
    url: str = Query(..., description="Douyin video URL"),
    minimal: bool = Query(False, description="Return minimal data")
):
    """TubiQ-compatible endpoint for video data"""
    result = await get_info(url)
    
    # Format response in TubiQ style
    if result.get("success", False):
        return {
            "code": 200,
            "data": {
                "aweme_id": result.get("aweme_id", ""),
                "desc": result.get("title", ""),
                "cover": result.get("thumbnail_url", ""),
                "origin_cover": result.get("thumbnail_url", ""),
                "author": {
                    "nickname": result.get("author", ""),
                    "unique_id": result.get("author_id", ""),
                },
                "statistics": {
                    "play_count": result.get("view_count", 0),
                    "digg_count": result.get("like_count", 0),
                },
                "create_time": result.get("create_time"),
            }
        }
    else:
        return {"code": 500, "error": result.get("error", "Unknown error")}


@app.get("/api/debug")
async def debug_url(url: str = Query(..., description="Douyin video URL")):
    """Debug endpoint to see raw data from Douyin page"""
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=20.0) as client:
            response = await client.get(url, headers=HEADERS)
            html = response.text
            final_url = str(response.url)
            
            # Check for RENDER_DATA
            render_match = re.search(
                r'<script id="RENDER_DATA" type="application/json">([^<]+)</script>',
                html
            )
            
            render_data_preview = None
            if render_match:
                encoded = render_match.group(1)[:500]  # First 500 chars
                try:
                    decoded = urllib.parse.unquote(encoded)
                    render_data_preview = decoded
                except:
                    render_data_preview = encoded
            
            # Check for SSR data
            ssr_match = re.search(r'window\.__SSR_DATA__\s*=\s*(\{.*?\});', html, re.S)
            ssr_preview = ssr_match.group(1)[:300] if ssr_match else None
            
            # OG tags
            og_title = re.search(r'og:title["\'][^>]+content=["\']([^"\']+)', html)
            og_image = re.search(r'og:image["\'][^>]+content=["\']([^"\']+)', html)
            
            return {
                "final_url": final_url,
                "html_length": len(html),
                "has_render_data": render_match is not None,
                "render_data_preview": render_data_preview,
                "has_ssr_data": ssr_match is not None,
                "ssr_preview": ssr_preview,
                "og_title": og_title.group(1) if og_title else None,
                "og_image": og_image.group(1) if og_image else None,
            }
    except Exception as e:
        return {"error": str(e)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
