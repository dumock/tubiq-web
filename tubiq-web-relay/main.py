# main.py — TubiQ Relay API (Supabase + SSE, Pure Relay)
# ---------------------------------------------------------------------------
# ✅ v8.0 (수정)
# - ✅ REMOVED: MongoDB persistence (User request)
# - ✅ REFACTORED: API Key identification (Pure memory/environment)
# - ✅ SSE: Real-time only (No replay history)
# ---------------------------------------------------------------------------

import os, time, json, hashlib, asyncio, logging, re, uuid
from typing import List, Optional, Dict, Any, Tuple

from fastapi import FastAPI, Header, HTTPException, Body, Depends, Request
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import httpx

# ---------- 환경설정(기본값) ----------
os.environ.setdefault("EMIT_SSE_ON_DUP", "1")
os.environ.setdefault("SSE_KEEPALIVE_SEC", "5")

DEFAULT_API_KEY = os.getenv("DEFAULT_API_KEY", "DEMO_API_KEY_123")
APP_TITLE = os.getenv("APP_TITLE", "tubiq-web-relay")
APP_DEBUG = bool(int(os.getenv("APP_DEBUG", "0")))

SSE_KEEPALIVE_SEC = int(os.getenv("SSE_KEEPALIVE_SEC", "5"))
SSE_INITIAL_RETRY = int(os.getenv("SSE_INITIAL_RETRY", "5000"))

VALID_API_KEYS = [s.strip() for s in os.getenv("VALID_API_KEYS", "").split(",") if s.strip()]
VALID_API_TOKENS = [s.strip() for s in os.getenv("VALID_API_TOKENS", "").split(",") if s.strip()]
REQUIRE_SSE_TOKEN = os.getenv("REQUIRE_SSE_TOKEN", "false").lower() == "true"
ALLOWED_ACCOUNT_IDS = [s.strip() for s in os.getenv("ALLOWED_ACCOUNT_IDS", "").split(",") if s.strip()]
DEFAULT_ACCOUNT_ID = os.getenv("DEFAULT_ACCOUNT_ID", "dumock")

# ---------- ✅ Supabase 설정 ----------
SUPABASE_URL = (os.getenv("SUPABASE_URL") or "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_TABLE_CHANNELS = os.getenv("SUPABASE_TABLE_CHANNELS", "channels")

# ✅ videos 저장 테이블명: 강제로 relay_videos 고정
SUPABASE_TABLE_VIDEOS = "relay_videos"

# ✅ on_conflict는 "컬럼 리스트"여야 함
SUPABASE_UPSERT_ON_CONFLICT = ",".join(
    [c.strip() for c in os.getenv("SUPABASE_UPSERT_ON_CONFLICT", "account_id,platform,external_id").split(",") if c.strip()]
)

SUPABASE_TIMEOUT_SEC = float(os.getenv("SUPABASE_TIMEOUT_SEC", "6"))
SUPABASE_VIDEOS_MODE = "relay"  # "relay" | "web"

SUPABASE_DEFAULT_USER_ID = os.getenv("SUPABASE_DEFAULT_USER_ID", "").strip()
SUPABASE_DEFAULT_CHANNEL_ID = os.getenv("SUPABASE_DEFAULT_CHANNEL_ID", "").strip()

# ---------- FastAPI ----------
app = FastAPI(title=APP_TITLE, debug=APP_DEBUG)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ALLOW_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

log = logging.getLogger(__name__)

# ---------- 유틸 ----------
def sha256(s: str) -> str:
    return hashlib.sha256((s or "").encode("utf-8")).hexdigest()

def normalize_url(url: str) -> str:
    return (url or "").strip()

def detect_kind(url: str) -> str:
    u = (url or "").strip().lower()
    if u.startswith("@") and " " not in u and "/" not in u:
        return "channel"
    if "youtube.com/@" in u or "/channel/" in u or "/user/" in u or "/c/" in u:
        return "channel"
    if "/shorts/" in u or "watch?v=" in u or "youtu.be/" in u:
        return "video"
    return "video"

def detect_platform(url: str, hinted: Optional[str] = None) -> str:
    if hinted:
        return hinted
    u = (url or "").lower()
    if "youtube.com" in u or "youtu.be" in u:
        return "youtube"
    if "tiktok.com" in u:
        return "tiktok"
    if "douyin.com" in u:
        return "douyin"
    if "instagram.com" in u:
        return "instagram"
    return "unknown"

_YT_VIDEO_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")

def parse_youtube_ids(url: str) -> Dict[str, Optional[str]]:
    u = (url or "").strip()
    low = u.lower()
    out = {"video_id": None, "channel_id": None, "handle": None}

    if low.startswith("@") and " " not in low and "/" not in low:
        out["handle"] = u.strip("@")
        return out

    if "youtu.be/" in low:
        try:
            part = u.split("youtu.be/", 1)[1]
            vid = part.split("?", 1)[0].split("/", 1)[0]
            if _YT_VIDEO_ID_RE.match(vid):
                out["video_id"] = vid
        except Exception:
            pass

    if "watch?v=" in low:
        try:
            vid = u.split("watch?v=", 1)[1].split("&", 1)[0]
            if _YT_VIDEO_ID_RE.match(vid):
                out["video_id"] = vid
        except Exception:
            pass

    if "/shorts/" in low:
        try:
            vid = u.split("/shorts/", 1)[1].split("?", 1)[0].split("/", 1)[0]
            if _YT_VIDEO_ID_RE.match(vid):
                out["video_id"] = vid
        except Exception:
            pass

    if "/channel/" in low:
        try:
            cid = u.split("/channel/", 1)[1].split("?", 1)[0].split("/", 1)[0]
            if cid:
                out["channel_id"] = cid
        except Exception:
            pass

    if "youtube.com/@" in low:
        try:
            h = u.split("youtube.com/@", 1)[1].split("?", 1)[0].split("/", 1)[0]
            if h:
                out["handle"] = h
        except Exception:
            pass

    if "/user/" in low:
        try:
            h = u.split("/user/", 1)[1].split("?", 1)[0].split("/", 1)[0]
            if h and not out["handle"]:
                out["handle"] = h
        except Exception:
            pass

    if "/c/" in low:
        try:
            h = u.split("/c/", 1)[1].split("?", 1)[0].split("/", 1)[0]
            if h and not out["handle"]:
                out["handle"] = h
        except Exception:
            pass

    return out

def is_valid_uuid(val: Any) -> bool:
    if not val: return False
    try:
        uuid.UUID(str(val))
        return True
    except Exception:
        return False

def best_external_id(kind: str, platform: str, url: str, hinted_channel: Optional[str], hinted_video: Optional[str]) -> Optional[str]:
    if kind == "video":
        if hinted_video:
            return hinted_video
        if platform == "youtube":
            ids = parse_youtube_ids(url)
            return ids.get("video_id") or None
        return None

    if hinted_channel:
        return hinted_channel
    if platform == "youtube":
        ids = parse_youtube_ids(url)
        return ids.get("channel_id") or (f"@{ids['handle']}" if ids.get("handle") else None)
    return None

# ---------- 인증 ----------
def _extract_creds(req: Request) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    h, q = req.headers, req.query_params
    api_key = h.get("x-api-key") or h.get("X-Api-Key") or q.get("api_key")
    token = h.get("x-sse-token") or q.get("sse_token")
    account_id = h.get("x-account-id") or q.get("account_id")
    return api_key, token, account_id

def _identify_user(api_key: str) -> str:
    # 몽고디비 제거: API 키 자체를 해시하거나 특정 규칙으로 ID 생성
    if not api_key:
        raise HTTPException(status_code=401, detail="Missing API Key")
    
    # VALID_API_KEYS 설정이 있으면 검증
    if VALID_API_KEYS and api_key not in VALID_API_KEYS and api_key != DEFAULT_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API Key")
    
    # API 키 기반의 고정 ID 반환
    return hashlib.md5(api_key.encode()).hexdigest()[:12]

def require_user(
    x_api_key: Optional[str] = Header(None, alias="X-Api-Key"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
    request: Request = None,
) -> Dict[str, Any]:
    key = x_api_key or (authorization.split(" ", 1)[1] if authorization and " " in authorization else None)
    if not key and request is not None:
        extracted_key, _, _ = _extract_creds(request)
        key = extracted_key
    if not key:
        raise HTTPException(status_code=401, detail="missing credentials")

    internal_uid = _identify_user(key)
    _, _, acct_from_req = _extract_creds(request) if request else (None, None, None)
    account_id = (acct_from_req or DEFAULT_ACCOUNT_ID or internal_uid).strip()
    return {"api_key": key, "user_id": internal_uid, "route_id": account_id, "account_id": account_id}

# ---------- 모델 ----------
class ShareIn(BaseModel):
    url: str
    kind: Optional[str] = None
    platform: Optional[str] = None
    normalized_channel_id: Optional[str] = None
    normalized_video_id: Optional[str] = None
    source: Optional[str] = None
    ts: Optional[int] = None
    memo: Optional[str] = None  # ✅ NEW: memo from Q-Sharer app

# ---------- SSE 채널 ----------
_channels: Dict[str, asyncio.Queue[str]] = {}
def _q_for(route_id: str) -> asyncio.Queue:
    if route_id not in _channels:
        _channels[route_id] = asyncio.Queue(maxsize=2000)
    return _channels[route_id]

def _sse_format(event: str, data_obj: Dict[str, Any], eid: str) -> str:
    return f"id: {eid}\nevent: {event}\ndata: {json.dumps(data_obj, ensure_ascii=False)}\n\n"

# ---------- ✅ Supabase 저장 ----------
def _supabase_ready() -> bool:
    return bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)

_COL_MISSING_RE = re.compile(r'column\s+"([^"]+)"\s+of\s+relation\s+"([^"]+)"\s+does\s+not\s+exist', re.IGNORECASE)

def _strip_missing_columns_from_error(err_text: str) -> Optional[str]:
    if not err_text:
        return None
    m = _COL_MISSING_RE.search(err_text)
    return m.group(1) if m else None

def _looks_like_42p10(err_text: str) -> bool:
    if not err_text:
        return False
    return ("42P10" in err_text) or ('"code":"42P10"' in err_text) or ("there is no unique or exclusion constraint" in err_text)

def _looks_like_unique_violation(err_text: str) -> bool:
    if not err_text:
        return False
    return ("23505" in err_text) or ("duplicate key value violates unique constraint" in err_text)

async def _supabase_post(*, url: str, headers: Dict[str, str], params: Dict[str, str], payload: Dict[str, Any]) -> httpx.Response:
    print(f"[SUPA] POST {url} with payload {json.dumps(payload)[:200]}...")
    async with httpx.AsyncClient(timeout=SUPABASE_TIMEOUT_SEC) as client:
        resp = await client.post(url, headers=headers, params=params, json=[payload])
        print(f"[SUPA] Response: {resp.status_code}")
        if resp.status_code >= 400:
            print(f"[SUPA] Error Body: {resp.text}")
        return resp

async def supabase_upsert_item(*, table: str, row: Dict[str, Any], on_conflict: str) -> Tuple[bool, Optional[str]]:
    if not _supabase_ready():
        return False, "supabase_not_configured"

    url = f"{SUPABASE_URL}/rest/v1/{table}"

    base_headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }

    headers_upsert = dict(base_headers)
    headers_upsert["Prefer"] = "resolution=merge-duplicates,return=representation"

    headers_insert = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

    current = dict(row)
    removed: List[str] = []

    params_upsert = {"on_conflict": on_conflict}

    for _ in range(1, 4):
        try:
            resp = await _supabase_post(url=url, headers=headers_upsert, params=params_upsert, payload=current)

            if 200 <= resp.status_code < 300:
                return True, None

            body = resp.text or ""
            short = body[:500] + ("..." if len(body) > 500 else "")

            if resp.status_code == 409 and _looks_like_unique_violation(body):
                return True, None

            if resp.status_code == 400:
                missing_col = _strip_missing_columns_from_error(body)
                if missing_col and missing_col in current:
                    removed.append(missing_col)
                    current.pop(missing_col, None)
                    continue

                if _looks_like_42p10(body):
                    try:
                        resp2 = await _supabase_post(
                            url=url, 
                            headers=headers_insert, 
                            params={}, 
                            payload=current
                        )
                        if 200 <= resp2.status_code < 300:
                            return True, None

                        body2 = resp2.text or ""
                        short2 = body2[:500] + ("..." if len(body2) > 500 else "")

                        if resp2.status_code in (400, 409) and (_looks_like_unique_violation(body2) or "23505" in body2):
                            return True, None

                        return False, f"supabase_http_{resp2.status_code} (fallback_plain_insert): {short2}"
                    except Exception as e2:
                        return False, f"supabase_exception (fallback_plain_insert): {e2}"

            return False, f"supabase_http_{resp.status_code}: {short}"

        except Exception as e:
            return False, f"supabase_exception: {e}"

    return False, f"supabase_http_400: column_mismatch_auto_removed={removed} but still failing"

def _build_supabase_row_for_relay(*, route_id: str, platform: str, external_id: str, url_norm: str, source: str, created_at_ms: int, memo: Optional[str] = None) -> Dict[str, Any]:
    row = {
        "account_id": route_id,
        "platform": platform,
        "external_id": external_id,
        "url": url_norm,
        "source": source,
        "created_at": created_at_ms,
        "memo": memo,  # ✅ NEW: memo field
    }
    if is_valid_uuid(route_id):
        row["user_id"] = route_id
    else:
        # If not UUID, we still want to save it to relay_videos 
        # but user_id column (UUID) must be omitted or null.
        row["user_id"] = None
    return row

def _build_supabase_row_for_web_videos(*, platform: str, external_id: str, source: str, created_at_ms: int) -> Tuple[Dict[str, Any], Optional[str]]:
    if platform != "youtube":
        return {}, "SUPABASE_VIDEOS_MODE=web is youtube-only right now"
    if not SUPABASE_DEFAULT_USER_ID or not SUPABASE_DEFAULT_CHANNEL_ID:
        return {}, "missing SUPABASE_DEFAULT_USER_ID or SUPABASE_DEFAULT_CHANNEL_ID for web/videos"

    row = {
        "user_id": SUPABASE_DEFAULT_USER_ID,
        "channel_id": SUPABASE_DEFAULT_CHANNEL_ID,
        "youtube_video_id": external_id,
        "title": None,
        "thumbnail_url": None,
        "source": source,
        "collected_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(created_at_ms / 1000.0)),
    }
    return row, None

# ---------- 라우트 ----------
@app.on_event("startup")
def on_startup():
    print("[INIT] Startup complete (MongoDB dependencies removed).")
    print(f"[CONFIG] SUPABASE_TABLE_VIDEOS={SUPABASE_TABLE_VIDEOS} SUPABASE_VIDEOS_MODE={SUPABASE_VIDEOS_MODE}")
    print(f"[CONFIG] SUPABASE_UPSERT_ON_CONFLICT={SUPABASE_UPSERT_ON_CONFLICT}")
    print(f"[CONFIG] SUPABASE_URL={SUPABASE_URL}")
    print(f"[CONFIG] SUPABASE_KEY_LEN={len(SUPABASE_SERVICE_ROLE_KEY) if SUPABASE_SERVICE_ROLE_KEY else 0}")

@app.get("/")
def root():
    return {"ok": True, "status": "alive", "t": time.time()}

@app.get("/healthz")
def healthz():
    return {"ok": True, "status": "healthy", "t": time.time()}

@app.get("/health")
def health():
    return {"status": "ok", "t": time.time()}

@app.post("/share", summary="링크 적재 후 SSE 푸시 (Supabase Only)")
async def share(data: ShareIn = Body(...), user=Depends(require_user), req: Request = None):
    route_id = user["route_id"]
    url_norm = normalize_url(data.url)
    if not url_norm:
        raise HTTPException(400, "empty url")

    kind = (data.kind or detect_kind(url_norm)).lower()
    if kind not in ("channel", "video"):
        raise HTTPException(400, "invalid kind")

    created_at_ms = data.ts or int(time.time() * 1000)
    platform = detect_platform(url_norm, data.platform)
    external_id = best_external_id(
        kind=kind,
        platform=platform,
        url=url_norm,
        hinted_channel=data.normalized_channel_id,
        hinted_video=data.normalized_video_id,
    )

    print(f"[SHARE] route_id={route_id} kind={kind} url={url_norm} platform={platform} external_id={external_id}")

    supa_ok = None
    supa_err = None

    if external_id:
        if kind == "channel":
            table = SUPABASE_TABLE_CHANNELS
            supa_row = _build_supabase_row_for_relay(
                route_id=route_id,
                platform=platform,
                external_id=external_id,
                url_norm=url_norm,
                source=(data.source or "android_sharer"),
                created_at_ms=created_at_ms,
                memo=data.memo,  # ✅ NEW
            )
        else:
            if SUPABASE_VIDEOS_MODE == "web":
                table = SUPABASE_TABLE_VIDEOS
                supa_row, why = _build_supabase_row_for_web_videos(
                    platform=platform,
                    external_id=external_id,
                    source=(data.source or "android_sharer"),
                    created_at_ms=created_at_ms,
                )
                if why:
                    supa_ok, supa_err = False, why
                    supa_row = None
            else:
                table = SUPABASE_TABLE_VIDEOS
                supa_row = _build_supabase_row_for_relay(
                    route_id=route_id,
                    platform=platform,
                    external_id=external_id,
                    url_norm=url_norm,
                    source=(data.source or "android_sharer"),
                    created_at_ms=created_at_ms,
                    memo=data.memo,  # ✅ NEW
                )

        if supa_row:
            supa_ok, supa_err = await supabase_upsert_item(
                table=table,
                row=supa_row,
                on_conflict=SUPABASE_UPSERT_ON_CONFLICT,
            )
            if not supa_ok:
                print(f"[SHARE] Supabase Save FAILED for {external_id}: {supa_err}")
            else:
                print(f"[SHARE] Supabase Save SUCCESS for {external_id}")

    event_name = "channel_added" if kind == "channel" else "video_added"
    payload = {
        "kind": kind,
        "platform": platform,
        "external_id": external_id,
        "url": url_norm,
        "source": (data.source or "android_sharer"),
        "ts": created_at_ms,
        "supabase": bool(supa_ok) if supa_ok is not None else False,
    }

    eid = str(int(time.time() * 1000))
    try:
        await _q_for(route_id).put(_sse_format(event_name, payload, eid=eid))
    except asyncio.QueueFull:
        pass

    return JSONResponse(
        {"ok": True, "kind": kind, "platform": platform, "external_id": external_id,
         "supabase_ok": supa_ok, "supabase_err": supa_err}
    )

@app.get("/events")
async def events(
    req: Request,
    user=Depends(require_user),
):
    route_id = user["route_id"]
    queue = _q_for(route_id)

    async def gen():
        yield f"retry: {SSE_INITIAL_RETRY}\n\n"
        yield "event: ready\ndata: {}\n\n"

        keep = 0
        while True:
            if await req.is_disconnected():
                break
            try:
                msg = await asyncio.wait_for(queue.get(), timeout=SSE_KEEPALIVE_SEC)
                yield msg
            except asyncio.TimeoutError:
                keep += 1
                yield f": keep-{keep}\n\n"

    headers = {
        "Cache-Control": "no-cache",
        "Content-Type": "text/event-stream",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    return StreamingResponse(gen(), headers=headers)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8080)), access_log=True)
