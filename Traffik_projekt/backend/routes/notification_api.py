from flask import Blueprint, request, jsonify
from supabase import create_client
import requests
import os

notification_api = Blueprint("notification_api", __name__, url_prefix="/api")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

TRAFIKVERKET_API = os.getenv("TRAFIKVERKET_PROXY_URL", "http://localhost:5000/trafikinfo")
SMS_SERVER_URL = os.getenv("RENDER_SMS_URL", "http://localhost:3000/send-sms")

@notification_api.route("/send_sms_for_deviation", methods=["POST", "OPTIONS"])
def send_sms_for_deviation():
    print("✅ Route: /api/send_sms_for_deviation REACHED")

    if request.method == "OPTIONS":
        return jsonify({"ok": True}), 200

    try:
        data = request.get_json()
        dev_id = data.get("devId")
        county_no = data.get("countyNo")
        print("➡️ county_no från frontend:", county_no)

        if not dev_id or not county_no:
            return jsonify({"error": "devId och countyNo krävs"}), 400

        # Hämta plats-ID från Supabase (matcha county_no som sträng)
        location_resp = supabase.table("location") \
            .select("*") \
            .execute()

        print("🧪 Hela location_resp från Supabase:", location_resp)

        print("🧪 Alla län i location-tabellen:")
        location_id = None
        for row in location_resp.data:
            print(f"🔎 county_no={row['county_no']} (type: {type(row['county_no'])}), matchar mot {county_no} ({type(county_no)})")
            if str(row["county_no"]) == str(county_no):
                location_id = row["location_id"]
                break

        if not location_id:
            return jsonify({"error": f"Inget län hittat med county_no = {county_no}"}), 404

        print("✅ Hittad plats:", location_id)


        # Hämta aktiva prenumeranter
        subs_resp = supabase.table("subscriptions").select("user_id").eq("location_id", location_id).eq("active", True).execute()
        print("📋 subscriptions:", subs_resp.data)
        if not subs_resp.data:
            return jsonify({"message": "Inga aktiva prenumeranter"}), 200

        recipients = []
        for sub in subs_resp.data:
            user_id = sub["user_id"]

            # Undvik dubblett
            sms_check = supabase.table("sms").select("sms_id").eq("user_id", user_id).eq("sms_id", dev_id).execute()
            if sms_check.data:
                continue

            # Hämta telefonnummer
            user_resp = supabase.table("users").select("phone").eq("user_id", user_id).execute()
            if not user_resp.data:
                continue

            phone = user_resp.data[0].get("phone")
            if phone:
                recipients.append({
                    "user_id": user_id,
                    "phone": phone
                })

        print("📲 Mottagare:", recipients)

        if not recipients:
            return jsonify({"message": "Alla har redan fått detta sms eller saknar telefonnummer"}), 200

        # Skicka SMS
        numbers = [r["phone"] for r in recipients]
        message = f"🚨 Ny trafikstörning i län {county_no}. Se mer på trafikinfo."

        sms_res = requests.post(SMS_SERVER_URL, json={
            "to": numbers,
            "message": message,
            "from": "TrafikInfo"
        })
        sms_res.raise_for_status()

        # Logga SMS
        for r in recipients:
            supabase.table("sms").insert({
                "user_id": r["user_id"],
                "sms_id": dev_id,
                "status": "sent"
            }).execute()

        return jsonify({
            "message": f"Skickade till {len(recipients)} mottagare",
            "count": len(recipients)
        }), 200

    except Exception as e:
        print("❌ Fel i utskick:", e)
        return jsonify({"error": "Fel vid sms-utskick", "details": str(e)}), 500
