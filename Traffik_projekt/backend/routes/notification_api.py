from flask import Blueprint, request, jsonify
from supabase import create_client
import requests
import os

notification_api = Blueprint("notification_api", __name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Din proxy till Trafikverket, eller direkt om ni kör mot det publika API:et
TRAFIKVERKET_API = os.getenv("TRAFIKVERKET_PROXY_URL", "http://localhost:5000/trafikinfo")
SMS_SERVER_URL = os.getenv("SMS_SERVER_URL", "http://localhost:3000/send-sms")

# County-name → Trafikverket-kod
COUNTY_NAME_TO_NUMBER = {
    "Stockholm": 1,
    "Uppsala": 3,
    "Södermanland": 4,
    "Östergötland": 5,
    "Jönköping": 6,
    "Kronoberg": 7,
    "Kalmar": 8,
    "Gotland": 9,
    "Blekinge": 10,
    "Skåne": 12,
    "Halland": 13,
    "Västra Götaland": 14,
    "Värmland": 17,
    "Örebro": 18,
    "Västmanland": 19,
    "Dalarna": 20,
    "Gävleborg": 21,
    "Västernorrland": 22,
    "Jämtland": 23,
    "Västerbotten": 24,
    "Norrbotten": 25,
}


@notification_api.route("/api/deviations")
def get_deviations():
    region = request.args.get("region")
    county_number = COUNTY_NAME_TO_NUMBER.get(region)

    if not county_number:
        return jsonify({"error": "Invalid region"}), 400

    try:
        url = f"{TRAFIKVERKET_API}?county={county_number}&messageTypeValue=Accident,Roadwork"
        response = requests.get(url)
        response.raise_for_status()
        result = response.json()

        # För enkelhet: skicka vidare deviation-objekt
        deviations = []
        for s in result.get("RESPONSE", {}).get("RESULT", []):
            for situation in s.get("Situation", []):
                deviations.extend(situation.get("Deviation", []))

        return jsonify(deviations[:5])  # Begränsa till 5 för test

    except Exception as e:
        print("❌ Fel vid hämtning:", e)
        return jsonify({"error": "Kunde inte hämta data"}), 500


@notification_api.route("/api/send_sms_for_deviation", methods=["POST"])
def send_sms_for_deviation():
    data = request.get_json()
    dev_id = data.get("devId")
    region = data.get("region")

    if not dev_id or not region:
        return jsonify({"error": "devId and region required"}), 400

    try:
        # 1. Hämta prenumeranter för region
        location_resp = supabase.table("location").select("location_id").eq("region", region).execute()
        if not location_resp.data:
            return jsonify({"error": f"Ingen plats hittad för region {region}"}), 404

        location_id = location_resp.data[0]["location_id"]

        subs_resp = supabase.table("subscriptions").select("user_id").eq("location_id", location_id).eq("active", True).execute()
        if not subs_resp.data:
            return jsonify({"message": "Inga aktiva prenumeranter"}), 200

        recipients = []
        for sub in subs_resp.data:
            user_id = sub["user_id"]

            # Kolla om sms redan skickats
            sms_check = supabase.table("sms").select("id").eq("user_id", user_id).eq("sms_id", dev_id).execute()
            if sms_check.data:
                continue

            # Hämta telefonnummer
            user_resp = supabase.table("users").select("phone").eq("user_id", user_id).execute()
            if not user_resp.data:
                continue

            recipients.append({
                "user_id": user_id,
                "phone": user_resp.data[0]["phone"]
            })

        if not recipients:
            return jsonify({"message": "Alla har redan fått detta sms"}), 200

        # 2. Skicka SMS via server.js
        numbers = [r["phone"] for r in recipients]
        message = f"🚨 Ny trafikstörning i {region}. Se mer på trafikinfo."

        sms_res = requests.post(SMS_SERVER_URL, json={
            "to": numbers,
            "message": message,
            "from": "TrafikInfo"
        })
        sms_res.raise_for_status()

        # 3. Logga SMS i supabase
        for r in recipients:
            supabase.table("sms").insert({
                "user_id": r["user_id"],
                "sms_id": dev_id,
                "status": "sent"
            }).execute()

        return jsonify({
            "message": f"Skickade till {len(recipients)} mottagare",
            "count": len(recipients)
        })

    except Exception as e:
        print("❌ Fel i utskick:", e)
        return jsonify({"error": "Fel vid sms-utskick", "details": str(e)}), 500
