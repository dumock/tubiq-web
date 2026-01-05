# Bridge to TubiQ Crawler
import sys
import os
import asyncio
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

# Ensure we can import from the local directory
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import_error = None
try:
    from crawlers.hybrid.hybrid_crawler import HybridCrawler
except Exception as e:
    import traceback
    import_error = f"{str(e)}\n{traceback.format_exc()}"
    print(f"Error importing HybridCrawler: {e}")
    HybridCrawler = None

app = FastAPI(title="Douyin Worker (TubiQ Engine)", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global crawler instance
crawler = HybridCrawler() if HybridCrawler else None

@app.get("/")
async def root():
    status = "ready" if crawler else "error (import failed)"
    return {
        "status": status, 
        "service": "douyin-worker-tubiq-engine",
        "import_error": import_error
    }

@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.get("/api/info")
async def get_info(url: str = Query(..., description="Douyin video URL")):
    """Get video metadata using TubiQ crawler engine"""
    if not url:
        raise HTTPException(status_code=400, detail="Missing url parameter")
    
    if not crawler:
        return {"success": False, "error": "Crawler engine not initialized"}

    try:
        # TubiQ crawler main entry point
        # Try video parsing first
        try:
            data = await crawler.hybrid_parsing_single_video(url, minimal=True)
        except Exception:
            data = None

        # If video parsing failed, try profile parsing
        if not data:
            print(f"[Worker] Video parsing failed for {url}, trying profile parsing...")
            try:
                # 1. Get sec_user_id (handles redirects)
                sec_user_id = await crawler.DouyinWebCrawler.get_sec_user_id(url)
                if sec_user_id:
                     # 2. Fetch profile
                    profile_res = await crawler.DouyinWebCrawler.handler_user_profile(sec_user_id)
                    if profile_res and 'user' in profile_res:
                        user = profile_res['user']
                        # Map profile to expected format
                        # return success with author info
                        return {
                            "success": True,
                            "title": user.get('nickname', 'Douyin User'),
                            "thumbnail_url": user.get('avatar_larger', {}).get('url_list', [None])[0] or user.get('avatar_thumb', {}).get('url_list', [None])[0],
                            "author": user.get('nickname', ''),
                            "author_id": user.get('unique_id') or user.get('short_id') or str(sec_user_id),
                            "view_count": 0,
                            "is_profile": True,
                            "original_data": profile_res
                        }
            except Exception as e:
                print(f"[Worker] Profile parsing failed: {e}")
                pass
        
        # Check if data extraction was successful (video)
        if not data:
            return {"success": False, "error": "No data returned (Video or Profile)"}
            
        # Map to expected schema (Video)
        title = data.get("desc", "") or data.get("title", "")
        # ... (rest of video mapping)
        thumbnail = data.get("cover", "") or data.get("origin_cover", "")
        
        author_data = data.get("author", {})
        author_name = author_data.get("nickname", "") if isinstance(author_data, dict) else str(author_data)
        author_id = author_data.get("unique_id", "") if isinstance(author_data, dict) else ""
        
        stats = data.get("statistics", {})
        view_count = stats.get("play_count", 0) if isinstance(stats, dict) else 0
        
        return {
            "success": True,
            "title": title,
            "thumbnail_url": thumbnail,
            "author": author_name,
            "author_id": author_id,
            "view_count": view_count,
            "original_data": data
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}

@app.get("/api/hybrid/video_data")
async def hybrid_data(url: str = Query(...), minimal: bool = False):
    """Direct proxy to TubiQ crawler output"""
    if not crawler:
        return {"code": 500, "error": "Crawler not initialized"}
        
    try:
        data = await crawler.hybrid_parsing_single_video(url, minimal=minimal)
        return {"code": 200, "data": data} if data else {"code": 404, "error": "Not found"}
    except Exception as e:
        return {"code": 500, "error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
