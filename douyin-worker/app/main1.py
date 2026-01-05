# ==============================================================================
# Copyright (C) 2021 Evil0ctal
#
# This file is part of the Douyin_TikTok_Download_API project.
#
# Licensed under the Apache License 2.0
# http://www.apache.org/licenses/LICENSE-2.0
# ==============================================================================

# FastAPI APP
import uvicorn
from fastapi import FastAPI
from app.api.router import router as api_router

# PyWebIO APP
from app.web.app import MainView
from pywebio.platform.fastapi import asgi_app

# OS / YAML
import os
import yaml

# ──────────────────────────────────────────────────────────────────────────────
# 설정 로드
# 상위의 config.yaml 읽기
config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'config.yaml')
with open(config_path, 'r', encoding='utf-8') as file:
    config = yaml.safe_load(file)

Host_IP = config['API']['Host_IP']
Host_Port = config['API']['Host_Port']

# API Tags
tags_metadata = [
    {"name": "Hybrid-API", "description": "**(混合数据接口/Hybrid-API data endpoints)**"},
    {"name": "Douyin-Web-API", "description": "**(抖音Web数据接口/Douyin-Web-API data endpoints)**"},
    {"name": "TikTok-Web-API", "description": "**(TikTok-Web-API数据接口/TikTok-Web-API data endpoints)**"},
    {"name": "TikTok-App-API", "description": "**(TikTok-App-API数据接口/TikTok-App-API data endpoints)**"},
    {"name": "Bilibili-Web-API", "description": "**(Bilibili-Web-API数据接口/Bilibili-Web-API data endpoints)**"},
    {"name": "iOS-Shortcut", "description": "**(iOS快捷指令数据接口/iOS-Shortcut data endpoints)**"},
    {"name": "Download", "description": "**(下载数据接口/Download data endpoints)**"},
]

version = config['API']['Version']
update_time = config['API']['Update_Time']
environment = config['API']['Environment']

description = f"""
### [中文]

#### 关于
- **Github**: [Douyin_TikTok_Download_API](https://github.com/Evil0ctal/Douyin_TikTok_Download_API)
- **版本**: `{version}`
- **更新时间**: `{update_time}`
- **环境**: `{environment}`
- **文档**: [API Documentation](https://douyin.wtf/docs)
#### 备注
- 本项目仅供学习交流使用，不得用于违法用途，否则后果自负。
- 如果你不想自己部署，可以直接使用我们的在线API服务：[Douyin_TikTok_Download_API](https://douyin.wtf/docs)
- 如果你需要更稳定以及更多功能的API服务，可以使用付费API服务：[TikHub API](https://api.tikhub.io/)

### [English]

#### About
- **Github**: [Douyin_TikTok_Download_API](https://github.com/Evil0ctal/Douyin_TikTok_Download_API)
- **Version**: `{version}`
- **Last Updated**: `{update_time}`
- **Environment**: `{environment}`
- **Documentation**: [API Documentation](https://douyin.wtf/docs)
#### Note
- This project is for learning and communication only.
"""

docs_url = config['API']['Docs_URL']
redoc_url = config['API']['Redoc_URL']

app = FastAPI(
    title="Douyin TikTok Download API",
    description=description,
    version=version,
    openapi_tags=tags_metadata,
    docs_url=docs_url,
    redoc_url=redoc_url,
)

# ── 기본 API 라우터
app.include_router(api_router, prefix="/api")

# ── 서버 썸네일 라우터 추가 (/api/thumbnail)
# server_thumbnail.py 는 프로젝트 루트( start.py 와 같은 위치 )에 있어야 함
try:
    from server_thumbnail import router as thumb_router
    app.include_router(thumb_router)  # prefix 없이 등록 → /api/thumbnail 그대로 사용
except Exception as e:
    # 썸네일 라우터가 없더라도 앱은 뜨도록
    print("[server_thumbnail] include 실패:", e)

# ── PyWebIO
if config['Web']['PyWebIO_Enable']:
    webapp = asgi_app(lambda: MainView().main_view())
    app.mount("/", webapp)

if __name__ == '__main__':
    uvicorn.run(app, host=Host_IP, port=Host_Port)
