
import asyncio
import sys
import os

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from crawlers.hybrid.hybrid_crawler import HybridCrawler

async def inspect_profile():
    crawler = HybridCrawler()
    # Use the URL provided by the user earlier: https://v.douyin.com/-h2_9kWnvzc/
    # This redirects to a video, from which we can get the author's sec_uid
    url = "https://v.douyin.com/-h2_9kWnvzc/" 
    print(f"Resolving URL: {url}")
    
    try:
        # 1. Get sec_user_id
        print("Fetching sec_user_id...")
        sec_user_id = await crawler.DouyinWebCrawler.get_sec_user_id(url)
        print(f"Got sec_user_id: {sec_user_id}")

        if sec_user_id:
            # 2. Fetch profile
            print("Fetching profile...")
            profile_res = await crawler.DouyinWebCrawler.handler_user_profile(sec_user_id)
            
            if profile_res and 'user' in profile_res:
                user = profile_res['user']
                import json
                with open('douyin_profile_dump.json', 'w', encoding='utf-8') as f:
                    json.dump(user, f, ensure_ascii=False, indent=2)
                print("Dumped user profile to douyin_profile_dump.json")
                
                print("\n--- Potential Interest Fields ---")
                interest_keys = ['follower_count', 'fans', 'follow', 'create_time', 'register_time', 'time']
                for k, v in user.items():
                    if any(i in k for i in interest_keys):
                        print(f"{k}: {v}")
                        
            else:
                print("No 'user' in response")
                print(profile_res)
        else:
             print("Failed to get sec_user_id")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(inspect_profile())
