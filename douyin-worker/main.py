# main.py - Bridge to TubiQ Crawler
import sys
import os
import asyncio
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

# Ensure we can import from the local directory
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from crawlers.hybrid.hybrid_crawler import HybridCrawler
except ImportError as e:
    print(f"Error importing HybridCrawler: {e}")
    # Fallback/Debug mode if import fails due to missing dependencies
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
    return {"status": status, "service": "douyin-worker-tubiq-engine"}

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
        # The main() method usually expects arguments or runs a batch
        # We need to call the specific method for single video
        
        # Based on hybrid_crawler.py analysis:
        # result = await self.hybrid_parsing_single_video(url, minimal=minimal)
        
        data = await crawler.hybrid_parsing_single_video(url, minimal=True)
        
        # Check if data extraction was successful
        # TubiQ returns a dict, we need to adapt it
        
        if not data:
            return {"success": False, "error": "No data returned"}
            
        # Map to expected schema
        # TubiQ data structure (based on models.py/web_crawler.py):
        # {
        #   'platform': 'douyin',
        #   'aweme_id': ...,
        #   'desc': ...,
        #   'cover': ...,
        #   'author': { 'nickname': ..., 'unique_id': ... },
        #   'statistics': { 'play_count': ..., 'digg_count': ... }
        # }
        
        title = data.get("desc", "") or data.get("title", "")
        thumbnail = data.get("cover", "") or data.get("origin_cover", "")
        
        author_data = data.get("author", {})
        author_name = author_data.get("nickname", "") if isinstance(author_data, dict) else str(author_data)
        
        stats = data.get("statistics", {})
        view_count = stats.get("play_count", 0) if isinstance(stats, dict) else 0
        
        return {
            "success": True,
            "title": title,
            "thumbnail_url": thumbnail,
            "author": author_name,
            "view_count": view_count,
            "original_data": data  # Return full data for debugging
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
