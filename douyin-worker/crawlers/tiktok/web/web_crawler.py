# ==============================================================================
# Copyright (C) 2021 Evil0ctal
#
# This file is part of the Douyin_TikTok_Download_API project.
#
# This project is licensed under the Apache License 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at:
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
# ==============================================================================
# 　　　　 　　  ＿＿
# 　　　 　　 ／＞　　フ
# 　　　 　　| 　_　 _ l
# 　 　　 　／` ミ＿xノ
# 　　 　 /　　　 　 |       Feed me Stars ⭐ ️
# 　　　 /　 ヽ　　 ﾉ
# 　 　 │　　|　|　|
# 　／￣|　　 |　|　|
# 　| (￣ヽ＿_ヽ_)__)
# 　＼二つ
# ==============================================================================
#
# Contributor Link:
# - https://github.com/Evil0ctal
# - https://github.com/Johnserf-Seed
#
# ==============================================================================

import asyncio  # 异步I/O
import time  # 时间操作
import yaml  # 配置文件
import os  # 系统操作

# --- [ADD] 모바일 UA/Referer 고정 ---
def _mobile_headers(extra: dict | None = None) -> dict:
    base = {
        "User-Agent": (
            "Mozilla/5.0 (Linux; Android 10; SM-G973F) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/114.0.0.0 Mobile Safari/537.36"
        ),
        "Referer": "https://www.tiktok.com/",
        "Accept-Language": "en-US,en;q=0.9",
    }
    if extra:
        base.update(extra)
    return base

# 基础爬虫客户端和TikTokAPI端点
from crawlers.base_crawler import BaseCrawler
from crawlers.tiktok.web.endpoints import TikTokAPIEndpoints
from crawlers.utils.utils import extract_valid_urls

# TikTok加密参数生成器
from crawlers.tiktok.web.utils import (
    AwemeIdFetcher,
    BogusManager,
    SecUserIdFetcher,
    TokenManager,
)

# TikTok接口数据请求模型
from crawlers.tiktok.web.models import (
    UserProfile,
    UserPost,
    UserLike,
    UserMix,
    UserCollect,
    PostDetail,
    UserPlayList,
    PostComment,
    PostCommentReply,
    UserFans,
    UserFollow,
)

# 配置文件路径
path = os.path.abspath(os.path.dirname(__file__))

# 读取配置文件
with open(f"{path}/config.yaml", "r", encoding="utf-8") as f:
    config = yaml.safe_load(f)


class TikTokWebCrawler:
    def __init__(self):
        self.proxy_pool = None

    # 从配置文件中获取TikTok的请求头/代理
    async def get_tiktok_headers(self):
        tiktok_config = config["TokenManager"]["tiktok"]
        kwargs = {
            "headers": {
                "User-Agent": tiktok_config["headers"]["User-Agent"],
                "Referer": tiktok_config["headers"]["Referer"],
                "Cookie": tiktok_config["headers"]["Cookie"],
            },
            "proxies": {
                "http://": tiktok_config["proxies"]["http"],
                "https://": tiktok_config["proxies"]["https"],
            },
        }
        return kwargs

    """-------------------------------------------------------handler接口列表-------------------------------------------------------"""

    # 获取单个作品数据
    async def fetch_one_video(self, itemId: str):
        kwargs = await self.get_tiktok_headers()
        base_crawler = BaseCrawler(proxies=kwargs["proxies"], crawler_headers=kwargs["headers"])
        async with base_crawler as crawler:
            params = PostDetail(itemId=itemId)
            endpoint = BogusManager.model_2_endpoint(
                TikTokAPIEndpoints.POST_DETAIL, params.dict(), kwargs["headers"]["User-Agent"]
            )
            response = await crawler.fetch_get_json(endpoint)
        return response

    # 获取用户的个人信息
    # --- [REWORK A案] HTML 하이드레이션 파싱: www → m 폴백, msToken/세션쿠키 부트스트랩, 다중 패턴 파싱 ---
    async def fetch_user_profile(self, secUid: str, uniqueId: str):
        """
        Return:
            {
              "userInfo": {"user": {...}, "stats": {...}},
              "shareMeta": {...}
            }
        """
        import re, json

        # 0) 공용 파서
        def _extract_state(text: str):
            patterns = [
                r'window\.__INIT_PROPS__\s*=\s*(\{.*?\})\s*;?</script>',
                r'window\.__INIT_STATE__\s*=\s*(\{.*?\})\s*;?</script>',
                r'<script id="SIGI_STATE"[^>]*>(\{.*?\})</script>',
                r'<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*type="application/json"[^>]*>(\{.*?\})</script>',
                r'({"UserModule":\s*\{.*?"stats"\s*:\s*\{.*?\}\s*\}.*?})',
            ]
            for pat in patterns:
                m = re.search(pat, text, re.DOTALL)
                if not m:
                    continue
                raw = (
                    m.group(1)
                    .replace("&quot;", '"')
                    .replace("&amp;", "&")
                    .replace("\\u003c", "<")
                    .replace("\\u003e", ">")
                    .replace("\\u0026", "&")
                    .replace("\n", "")
                    .replace("\r", "")
                )
                try:
                    return json.loads(raw)
                except Exception:
                    raw = re.sub(r",\s*}", "}", raw)
                    raw = re.sub(r",\s*]", "]", raw)
                    try:
                        return json.loads(raw)
                    except Exception:
                        pass
            return None

        # 1) URL 결정 (uniqueId 우선) + 언어 고정
        if uniqueId:
            url_www = f"https://www.tiktok.com/@{uniqueId}?lang=en"
        elif secUid:
            url_www = f"https://www.tiktok.com/user/{secUid}?lang=en"
        else:
            return {"userInfo": {"user": {}, "stats": {}}, "shareMeta": {}}
        url_m = url_www.replace("www.", "m.")

        # 2) 헤더/쿠키 준비
        kwargs = await self.get_tiktok_headers()
        try:
            ms_token = TokenManager().gen_real_msToken()
        except Exception:
            ms_token = ""
        hdrs = _mobile_headers(
            {
                "Cookie": f"msToken={ms_token};" if ms_token else "",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Cache-Control": "no-cache",
                "sec-fetch-site": "same-origin",
                "sec-fetch-mode": "navigate",
                "sec-fetch-user": "?1",
                "sec-fetch-dest": "document",
                "Upgrade-Insecure-Requests": "1",
            }
        )

        # 3) 세션 부트스트랩 + www → m 순차 시도
        state = None
        try:
            import httpx
            async with httpx.AsyncClient(
                headers=hdrs, timeout=20, follow_redirects=True, proxies=kwargs["proxies"]
            ) as client:
                # ttwid 등 세션 쿠키 유도
                try:
                    await client.get("https://www.tiktok.com/robots.txt")
                except Exception:
                    pass

                r1 = await client.get(url_www)
                if r1.status_code == 200:
                    state = _extract_state(r1.text)

                if not state:
                    r2 = await client.get(url_m)
                    if r2.status_code == 200:
                        state = _extract_state(r2.text)
        except Exception:
            state = None

        if not state:
            return {"userInfo": {"user": {}, "stats": {}}, "shareMeta": {}}

        # 4) 공통 스키마에서 user/stats/메타 추출
        user_obj, stats_obj, share_meta = {}, {}, {}
        um = state.get("UserModule") or {}
        if um:
            users = um.get("users") or {}
            stats = um.get("stats") or {}
            if uniqueId and uniqueId in users:
                user_obj = users.get(uniqueId) or {}
                stats_obj = stats.get(uniqueId) or {}
            if not user_obj and isinstance(users, dict) and users:
                user_obj = next(iter(users.values()))
            if not stats_obj and isinstance(stats, dict) and stats:
                stats_obj = next(iter(stats.values()))

        if not user_obj and "userInfo" in state:
            uinfo = state.get("userInfo") or {}
            if isinstance(uinfo, dict):
                user_obj = (uinfo.get("user") or {}) or user_obj
                stats_obj = (uinfo.get("stats") or {}) or stats_obj
            share_meta = state.get("shareMeta") or {}

        return {
            "userInfo": {"user": user_obj or {}, "stats": stats_obj or {}},
            "shareMeta": share_meta or {},
        }

    # 获取用户的作品列表
    async def fetch_user_post(self, secUid: str, cursor: int = 0, count: int = 35, coverFormat: int = 2):
        kwargs = await self.get_tiktok_headers()
        base_crawler = BaseCrawler(proxies=kwargs["proxies"], crawler_headers=kwargs["headers"])
        async with base_crawler as crawler:
            params = UserPost(secUid=secUid, cursor=cursor, count=count, coverFormat=coverFormat)
            endpoint = BogusManager.model_2_endpoint(
                TikTokAPIEndpoints.USER_POST, params.dict(), kwargs["headers"]["User-Agent"]
            )
            response = await crawler.fetch_get_json(endpoint)
        return response

    # 获取用户的点赞列表
    async def fetch_user_like(self, secUid: str, cursor: int = 0, count: int = 30, coverFormat: int = 2):
        kwargs = await self.get_tiktok_headers()
        base_crawler = BaseCrawler(proxies=kwargs["proxies"], crawler_headers=kwargs["headers"])
        async with base_crawler as crawler:
            params = UserLike(secUid=secUid, cursor=cursor, count=count, coverFormat=coverFormat)
            endpoint = BogusManager.model_2_endpoint(
                TikTokAPIEndpoints.USER_LIKE, params.dict(), kwargs["headers"]["User-Agent"]
            )
            response = await crawler.fetch_get_json(endpoint)
        return response

    # 获取用户的收藏列表
    async def fetch_user_collect(self, cookie: str, secUid: str, cursor: int = 0, count: int = 30, coverFormat: int = 2):
        kwargs = await self.get_tiktok_headers()
        kwargs["headers"]["Cookie"] = cookie
        base_crawler = BaseCrawler(proxies=kwargs["proxies"], crawler_headers=kwargs["headers"])
        async with base_crawler as crawler:
            params = UserCollect(cookie=cookie, secUid=secUid, cursor=cursor, count=count, coverFormat=coverFormat)
            endpoint = BogusManager.model_2_endpoint(
                TikTokAPIEndpoints.USER_COLLECT, params.dict(), kwargs["headers"]["User-Agent"]
            )
            response = await crawler.fetch_get_json(endpoint)
        return response

    # 获取用户的播放列表
    async def fetch_user_play_list(self, secUid: str, cursor: int = 0, count: int = 30):
        kwargs = await self.get_tiktok_headers()
        base_crawler = BaseCrawler(proxies=kwargs["proxies"], crawler_headers=kwargs["headers"])
        async with base_crawler as crawler:
            params = UserPlayList(secUid=secUid, cursor=cursor, count=count)
            endpoint = BogusManager.model_2_endpoint(
                TikTokAPIEndpoints.USER_PLAY_LIST, params.dict(), kwargs["headers"]["User-Agent"]
            )
            response = await crawler.fetch_get_json(endpoint)
        return response

    # 获取用户的合辑列表
    async def fetch_user_mix(self, mixId: str, cursor: int = 0, count: int = 30):
        kwargs = await self.get_tiktok_headers()
        base_crawler = BaseCrawler(proxies=kwargs["proxies"], crawler_headers=kwargs["headers"])
        async with base_crawler as crawler:
            params = UserMix(mixId=mixId, cursor=cursor, count=count)
            endpoint = BogusManager.model_2_endpoint(
                TikTokAPIEndpoints.USER_MIX, params.dict(), kwargs["headers"]["User-Agent"]
            )
            response = await crawler.fetch_get_json(endpoint)
        return response

    # 获取作品的评论列表
    async def fetch_post_comment(self, aweme_id: str, cursor: int = 0, count: int = 20, current_region: str = ""):
        kwargs = await self.get_tiktok_headers()
        base_crawler = BaseCrawler(proxies=kwargs["proxies"], crawler_headers=kwargs["headers"])
        async with base_crawler as crawler:
            params = PostComment(aweme_id=aweme_id, cursor=cursor, count=count, current_region=current_region)
            endpoint = BogusManager.model_2_endpoint(
                TikTokAPIEndpoints.POST_COMMENT, params.dict(), kwargs["headers"]["User-Agent"]
            )
            response = await crawler.fetch_get_json(endpoint)
        return response

    # 获取作品的评论回复列表
    async def fetch_post_comment_reply(
        self, item_id: str, comment_id: str, cursor: int = 0, count: int = 20, current_region: str = ""
    ):
        kwargs = await self.get_tiktok_headers()
        base_crawler = BaseCrawler(proxies=kwargs["proxies"], crawler_headers=kwargs["headers"])
        async with base_crawler as crawler:
            params = PostCommentReply(
                item_id=item_id, comment_id=comment_id, cursor=cursor, count=count, current_region=current_region
            )
            endpoint = BogusManager.model_2_endpoint(
                TikTokAPIEndpoints.POST_COMMENT_REPLY, params.dict(), kwargs["headers"]["User-Agent"]
            )
            response = await crawler.fetch_get_json(endpoint)
        return response

    # 获取用户的粉丝列表
    async def fetch_user_fans(self, secUid: str, count: int = 30, maxCursor: int = 0, minCursor: int = 0):
        kwargs = await self.get_tiktok_headers()
        base_crawler = BaseCrawler(proxies=kwargs["proxies"], crawler_headers=kwargs["headers"])
        async with base_crawler as crawler:
            params = UserFans(secUid=secUid, count=count, maxCursor=maxCursor, minCursor=minCursor)
            endpoint = BogusManager.model_2_endpoint(
                TikTokAPIEndpoints.USER_FANS, params.dict(), kwargs["headers"]["User-Agent"]
            )
            response = await crawler.fetch_get_json(endpoint)
        return response

    # 获取用户的关注列表
    async def fetch_user_follow(self, secUid: str, count: int = 30, maxCursor: int = 0, minCursor: int = 0):
        kwargs = await self.get_tiktok_headers()
        base_crawler = BaseCrawler(proxies=kwargs["proxies"], crawler_headers=kwargs["headers"])
        async with base_crawler as crawler:
            params = UserFollow(secUid=secUid, count=count, maxCursor=maxCursor, minCursor=minCursor)
            endpoint = BogusManager.model_2_endpoint(
                TikTokAPIEndpoints.USER_FOLLOW, params.dict(), kwargs["headers"]["User-Agent"]
            )
            response = await crawler.fetch_get_json(endpoint)
        return response

    """-------------------------------------------------------utils接口列表-------------------------------------------------------"""

    # 生成真实msToken
    async def fetch_real_msToken(self):
        result = {"msToken": TokenManager().gen_real_msToken()}
        return result

    # 生成ttwid
    async def gen_ttwid(self, cookie: str):
        result = {"ttwid": TokenManager().gen_ttwid(cookie)}
        return result

    # 生成xbogus
    async def gen_xbogus(self, url: str, user_agent: str):
        url = BogusManager.xb_str_2_endpoint(user_agent, url)
        result = {"url": url, "x_bogus": url.split("&X-Bogus=")[1], "user_agent": user_agent}
        return result

    # 提取单个用户id
    async def get_sec_user_id(self, url: str):
        return await SecUserIdFetcher.get_secuid(url)

    # 提取列表用户id
    async def get_all_sec_user_id(self, urls: list):
        urls = extract_valid_urls(urls)
        return await SecUserIdFetcher.get_all_secuid(urls)

    # 提取单个作品id
    async def get_aweme_id(self, url: str):
        return await AwemeIdFetcher.get_aweme_id(url)

    # 提取列表作品id
    async def get_all_aweme_id(self, urls: list):
        urls = extract_valid_urls(urls)
        return await AwemeIdFetcher.get_all_aweme_id(urls)

    # 获取用户unique_id
    async def get_unique_id(self, url: str):
        return await SecUserIdFetcher.get_uniqueid(url)

    # 获取列表unique_id列表
    async def get_all_unique_id(self, urls: list):
        urls = extract_valid_urls(urls)
        return await SecUserIdFetcher.get_all_uniqueid(urls)

    """-------------------------------------------------------main接口列表-------------------------------------------------------"""

    async def main(self):
        # 데모 실행용 자리(필요시 주석 해제)
        pass


if __name__ == "__main__":
    TikTokWebCrawler = TikTokWebCrawler()
    start = time.time()
    asyncio.run(TikTokWebCrawler.main())
    end = time.time()
    print(f"耗时：{end - start}")
