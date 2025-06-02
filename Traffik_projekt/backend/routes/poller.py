import os
import time
import requests
from supabase import create_client
from dotenv import load_dotenv

# 🧪 Ladda miljövariabler från .env
load_dotenv()

# 🌍 Miljövariabler
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
TRAFIKINFO_URL = os.getenv("TRAFIKVERKET_PROXY_URL", "http://localhost:5000/trafikinfo")
SEND_SMS_URL = os.getenv("RENDER_SMS_URL", "http://localhost:5000/api/send_sms_for_deviation")
API_KEY = os.getenv("X-API-KEY")
INTERVAL_SECONDS = 600  # 10 minuter

# ✅ Kontrollera nycklar
if not SUPABASE_URL or not SUPABASE_KEY:
    raise Exception("❌ Saknar SUPABASE_URL eller SUPABASE_KEY – kontrollera .env!")

# 🔌 Initiera klient
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def already_sent(dev_id):
    res = supabase.table("notifications").select("external_id").eq("external_id", dev_id).execute()
    return len(res.data) > 0

def get_subscribers(county_no):
    loc_resp = supabase.table("location").select("location_id").eq("county_no", county_no).execute()
    if not loc_resp.data:
        return []

    location_id = loc_resp.data[0]["location_id"]

    res = supabase.table("subscriptions") \
                  .select("user_id") \
                  .eq("location_id", location_id) \
                  .eq("active", True) \
                  .execute()
    return [row["user_id"] for row in res.data]

# 📦 Körs både manuellt från annan fil och i __main__-loop
def poll_once():
    for county_no in range(1, 26):
        print(f"📡 Hämtar data för län {county_no}...")
        try:
            res = requests.get(TRAFIKINFO_URL, params={"county": county_no})
            res.raise_for_status()
            deviations = res.json()

            for dev in deviations:
                dev_id = dev.get("Id")
                if not dev_id or already_sent(dev_id):
                    continue

                subscribers = get_subscribers(county_no)
                if not subscribers:
                    continue

                print(f"🚧 Skickar SMS för {dev_id} till {len(subscribers)} prenumeranter...")

                headers = {
                    "Content-Type": "application/json",
                    "X-API-KEY": API_KEY
                }

                send_res = requests.post(SEND_SMS_URL, json={
                    "devId": dev_id,
                    "countyNo": county_no
                }, headers=headers)

                if send_res.ok:
                    supabase.table("notifications").insert({
                        "external_id": dev_id,
                        "county_id": county_no
                    }).execute()
                    print("✅ SMS skickat och notis loggad")
                else:
                    print(f"⚠️ Fel vid SMS: {send_res.status_code} - {send_res.text}")

        except Exception as e:
            print(f"❌ Fel vid polling av län {county_no}: {e}")

# 🚀 Startar som fristående script
if __name__ == "__main__":
    print("🚀 Startar trafiknotis-poller")
    while True:
        poll_once()
        print(f"⏳ Väntar {INTERVAL_SECONDS} sekunder...\n")
        time.sleep(INTERVAL_SECONDS)
