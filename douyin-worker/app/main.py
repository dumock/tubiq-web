# app/main.py
# ==============================================================================
# Copyright (C) 2021 Evil0ctal
# Licensed under the Apache License 2.0
# ==============================================================================

import os
from urllib.parse import urlencode

import uvicorn
import yaml
from fastapi import FastAPI
from fastapi.responses import RedirectResponse

# ──────────────────────────────────────────────────────────────────────────────
# 설정 로드 (프로젝트 루트의 config.yaml: servers/douyin/config.yaml)
CONFIG_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config.yaml")
with open(CONFIG_PATH, "r", encoding="utf-8") as f:
    config = yaml.safe_load(f)

Host_IP     = config["API"]["Host_IP"]
Host_Port   = config["API"]["Host_Port"]
version     = config["API"]["Version"]
update_time = config["API"]["Update_Time"]
environment = config["API"]["Environment"]
docs_url    = config["API"]["Docs_URL"]
redoc_url   = config["API"]["Redoc_URL"]

tags_metadata = [
    {"name": "Hybrid-API",        "description": "**(混合数据接口/Hybrid-API data endpoints)**"},
    {"name": "Douyin-Web-API",    "description": "**(抖音Web数据接口/Douyin-Web-API data endpoints)**"},
    {"name": "TikTok-Web-API",    "description": "**(TikTok-Web-API数据接口/TikTok-Web-API data endpoints)**"},
    {"name": "TikTok-App-API",    "description": "**(TikTok-App-API数据接口/TikTok-App-API data endpoints)**"},
    {"name": "Bilibili-Web-API",  "description": "**(Bilibili-Web-API数据接口/Bilibili-Web-API data endpoints)**"},
    {"name": "iOS-Shortcut",      "description": "**(iOS快捷指令数据接口/iOS-Shortcut data endpoints)**"},
    {"name": "Download",          "description": "**(下载数据接口/Download data endpoints)**"},
]

description = f"""
### [中文]
- **Github**: Douyin_TikTok_Download_API
- **版本**: `{version}`  |  **更新时间**: `{update_time}`  |  **环境**: `{environment}`

### [English]
- **Version**: `{version}`  |  **Last Updated**: `{update_time}`  |  **Environment**: `{environment}`
"""

# ──────────────────────────────────────────────────────────────────────────────
# 1) FastAPI 인스턴스 생성(한 번만 생성)
app = FastAPI(
    title="Douyin TikTok Download API",
    description=description,
    version=version,
    openapi_tags=tags_metadata,
    docs_url=docs_url,
    redoc_url=redoc_url,
)

# ──────────────────────────────────────────────────────────────────────────────
# 2) 라우터 임포트 및 등록
#    ※ include는 반드시 app 생성 이후에 해야 한다.
#    ※ 기존 기본 API 라우터 + 우리가 추가한 TikTok Web 라우터
try:
    from app.api.router import router as api_router              # 기존 라우터
    app.include_router(api_router, prefix="/api")
except Exception as e:
    print("[router] 기본 API 라우터 include 실패:", e)

try:
    # 우리가 추가한 TikTok Web 라우터(routes_tiktok.py)
    # routes_tiktok.py 내부에서 prefix="/api/tiktok/web" 로 선언되어 있다면
    # 여기서는 프리픽스 없이 include 하면 됨.
    from app.routes_tiktok import router as tiktok_router
    app.include_router(tiktok_router)
except Exception as e:
    print("[router] TikTok 라우터 include 실패:", e)

# ──────────────────────────────────────────────────────────────────────────────
# 3) 서버 썸네일 라우터 (/api/thumbnail) 포함
#    server_thumbnail.py 는 프로젝트 루트(start.py와 같은 폴더)에 있어야 함.
try:
    from server_thumbnail import router as thumb_router
    app.include_router(thumb_router)  # 내부에서 /api/thumbnail 정의
except Exception as e:
    print("[server_thumbnail] include 실패:", e)

# 호환용 별칭: /api/thumb → /api/thumbnail (307 임시 리다이렉트)
@app.get("/api/thumb")
def alias_thumb(url: str, w: int = 480, ss: float = 0.7):
    qs = urlencode({"url": url, "w": w, "ss": ss})
    return RedirectResponse(url=f"/api/thumbnail?{qs}", status_code=307)

# ──────────────────────────────────────────────────────────────────────────────
# 4) 헬스체크(로컬/외부 감시용)
@app.get("/health")
def health():
    return {"ok": True, "version": version, "env": environment}

# ──────────────────────────────────────────────────────────────────────────────
# 5) (옵션) PyWebIO 마운트
try:
    from app.web.app import MainView
    from pywebio.platform.fastapi import asgi_app
    if config.get("Web", {}).get("PyWebIO_Enable"):
        webapp = asgi_app(lambda: MainView().main_view())
        # 루트로 마운트해도 /docs, /redoc, /api/* 는 그대로 유지됨
        app.mount("/", webapp)
except Exception as e:
    # PyWebIO가 필요 없거나 미설치면 그냥 넘어감
    print("[PyWebIO] 비활성 또는 include 실패:", e)

# ──────────────────────────────────────────────────────────────────────────────
# 6) 단독 실행용 엔트리포인트(개발/테스트)
if __name__ == "__main__":
    uvicorn.run(app, host=Host_IP, port=Host_Port)
