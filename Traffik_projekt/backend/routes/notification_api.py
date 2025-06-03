import time
from flask import Blueprint, request, jsonify
from supabase import create_client
import requests
import os
import random
from datetime import datetime, timedelta

notification_api = Blueprint("notification_api", __name__, url_prefix="/api")

# 🔐 Supabase-anslutning
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# 🔗 Externa tjänster
TRAFIKVERKET_API = os.getenv("TRAFIKVERKET_PROXY_URL", "http://localhost:5000/trafikinfo")
SMS_SERVER_URL = os.getenv("RENDER_SMS_URL", "http://localhost:3000/send-sms")
EMAIL_SERVER_URL = os.getenv("RENDER_EMAIL_URL", "http://localhost:3000/send-email")
API_KEY = os.getenv("X-API-KEY")  # 🔐 Hämtas från .env

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

        location_resp = supabase.table("location").select("*").execute()
        location_id = next((row["location_id"] for row in location_resp.data if str(row["county_no"]) == str(county_no)), None)

        if not location_id:
            return jsonify({"error": f"Inget län hittat med county_no = {county_no}"}), 404

        print("✅ Hittad plats:", location_id)

        subs_resp = supabase.table("subscriptions").select("user_id") \
            .eq("location_id", location_id).eq("active", True).execute()
        if not subs_resp.data:
            return jsonify({"message": "Inga aktiva prenumeranter"}), 200

        try:
            trv_res = requests.get(f"{TRAFIKVERKET_API}?id={dev_id}")
            trv_data = trv_res.json()
            deviation = next((d for d in trv_data if d.get("Id") == dev_id), {})
        except Exception as err:
            print("⚠️ Kunde inte hämta devId-data:", err)
            deviation = {}

        header = deviation.get("Header", "Trafikstörning") or "Trafikstörning"
        message_text = deviation.get("Message", "")
        link = f"https://www.trafikverket.se/trafikinformation/"

        # Fallback om ingen meddelandetext finns
        if message_text:
            sentences = message_text.split(". ")
            short_details = ". ".join(sentences[:2]).strip()

            max_text_length = 160 - len(link) - 20
            if len(short_details) > max_text_length:
                short_details = short_details[:max_text_length].rstrip() + "…"
        else:
            short_details = "Se mer information på Trafikverkets hemsida."

        # Sätt ihop meddelandet
        composed_message = (
            f"🚧 {header.strip()[:60]}\n"
            f"{short_details}\n"
            f"Läs mer: {link}"
        )


        recipients = []
        for sub in subs_resp.data:
            user_id = sub["user_id"]

            already_sent = supabase.table("notifications").select("id") \
                .eq("user_id", user_id).eq("external_id", dev_id).eq("channel", "sms").execute()
            if already_sent.data:
                continue

            user_resp = supabase.table("users").select("phone") \
                .eq("user_id", user_id).execute()
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

        sms_payload = {
            "to": [r["phone"] for r in recipients],
            "message": composed_message,
            "from": "TrafikInfo",
            "shortLinks": True
        }

        headers = {
            "Content-Type": "application/json",
            "X-API-KEY": API_KEY
        }

        print("📤 Payload till HelloSMS:", sms_payload)
        sms_res = requests.post(SMS_SERVER_URL, json=sms_payload, headers=headers)
        sms_res.raise_for_status()

        for r in recipients:
            supabase.table("notifications").insert({
                "user_id": r["user_id"],
                "external_id": dev_id,
                "channel": "sms",
                "status": "sent"
            }).execute()

        return jsonify({
            "message": f"Skickade till {len(recipients)} mottagare",
            "count": len(recipients)
        }), 200

    except Exception as e:
        print("❌ Fel i sms-utskick:", e)
        return jsonify({"error": "Fel vid sms-utskick", "details": str(e)}), 500


@notification_api.route("/send_email_for_deviation", methods=["POST", "OPTIONS"])
def send_email_for_deviation():
    print("✅ Route: /api/send_email_for_deviation REACHED")

    if request.method == "OPTIONS":
        return jsonify({"ok": True}), 200

    try:
        data = request.get_json()
        dev_id = data.get("devId")
        county_no = data.get("countyNo")
        print("➡️ county_no från frontend:", county_no)

        if not dev_id or not county_no:
            return jsonify({"error": "devId och countyNo krävs"}), 400

        location_resp = supabase.table("location").select("*").execute()
        location_id = next((row["location_id"] for row in location_resp.data if str(row["county_no"]) == str(county_no)), None)

        if not location_id:
            return jsonify({"error": f"Inget län hittat med county_no = {county_no}"}), 404

        print("✅ Hittad plats:", location_id)

        subs_resp = supabase.table("subscriptions").select("user_id") \
            .eq("location_id", location_id).eq("active", True).execute()
        if not subs_resp.data:
            return jsonify({"message": "Inga aktiva e-postprenumeranter"}), 200

        recipients = []
        for sub in subs_resp.data:
            user_id = sub["user_id"]

            already_sent = supabase.table("notifications").select("id") \
                .eq("user_id", user_id).eq("external_id", dev_id).eq("channel", "email").execute()
            if already_sent.data:
                continue

            user_resp = supabase.table("users").select("email").eq("user_id", user_id).execute()
            if not user_resp.data:
                continue

            email = user_resp.data[0].get("email")
            if email:
                recipients.append({
                    "user_id": user_id,
                    "email": email
                })

        print("📧 Mottagare:", recipients)

        if not recipients:
            return jsonify({"message": "Alla har redan fått mail eller saknar e-post"}), 200

        subject = f"🚨 Ny trafikstörning i län {county_no}"
        message = f"Trafikhändelse med ID {dev_id} rapporterad.\nSe mer på https://trafikinfo.trafikverket.se"

        payload = {
            "to": [r["email"] for r in recipients],
            "subject": subject,
            "message": message
        }

        headers = {
            "Content-Type": "application/json",
            "X-API-KEY": API_KEY  # 🔐 Nyckel till e-postservern
        }

        print("📤 Payload till mailserver:", payload)
        email_res = requests.post(EMAIL_SERVER_URL, json=payload, headers=headers)
        email_res.raise_for_status()

        for r in recipients:
            supabase.table("notifications").insert({
                "user_id": r["user_id"],
                "external_id": dev_id,
                "channel": "email",
                "status": "sent"
            }).execute()

        return jsonify({
            "message": f"Skickade mail till {len(recipients)} mottagare",
            "count": len(recipients)
        }), 200

    except Exception as e:
        print("❌ Fel i e-postutskick:", e)
        return jsonify({"error": "Fel vid mail-utskick", "details": str(e)}), 500


@notification_api.route("/notifications", methods=["GET"])
def list_notifications():
    try:
        response = supabase.table("notifications").select("*").order("created_at", desc=True).limit(50).execute()
        return jsonify(response.data)
    except Exception as e:
        print("❌ Fel vid hämtning av notifikationer:", e)
        return jsonify({"error": "Kunde inte hämta notifikationer", "details": str(e)}), 500
    

@notification_api.route("/send-sms-code", methods=["POST", "OPTIONS"])
def send_sms_code():
    if request.method == "OPTIONS":
        return jsonify({"ok": True}), 200

    try:
        data = request.get_json()
        phone = data.get("phone")

        if not phone:
            return jsonify({"error": "Telefonnummer saknas"}), 400

        code = random.randint(100000, 999999)
        print(f"📨 Skickar verifieringskod {code} till: {phone}")

        expires_at = (datetime.utcnow() + timedelta(minutes=10)).isoformat()

        supabase.table("sms_codes").insert({
            "phone": phone,
            "code": str(code),
            "verified": False,
            "expires_at": expires_at
        }).execute()

        payload = {
            "to": [phone],
            "message": f"Din verifieringskod: {code}",
            "from": "TrafikInfo"
        }

        headers = {
            "Content-Type": "application/json",
            "X-API-KEY": API_KEY
        }

        # 🧠 Lägg till retry
        MAX_RETRIES = 3
        for attempt in range(MAX_RETRIES):
            try:
                sms_res = requests.post(SMS_SERVER_URL, json=payload, headers=headers)
                sms_res.raise_for_status()
                break
            except requests.exceptions.RequestException as e:
                print(f"⚠️ Försök {attempt+1} misslyckades:", e)
                time.sleep(2)
        else:
            return jsonify({"error": "Misslyckades att skicka kod", "details": str(e)}), 503

        return jsonify({"message": "Verifieringskod skickad"}), 200

    except Exception as e:
        print("❌ Fel i send_sms_code:", e)
        return jsonify({"error": "Misslyckades att skicka kod", "details": str(e)}), 500


@notification_api.route("/verify-sms-code", methods=["POST", "OPTIONS"])
def verify_sms_code():
    if request.method == "OPTIONS":
        return jsonify({"ok": True}), 200

    try:
        data = request.get_json()
        phone = data.get("phone")
        code = data.get("code")

        if not phone or not code:
            return jsonify({"error": "Telefonnummer och kod krävs"}), 400

        # Hämta senaste sms-kod
        response = supabase.table("sms_codes") \
            .select("id, code, verified, expires_at") \
            .eq("phone", phone) \
            .order("created_at", desc=True) \
            .limit(1) \
            .execute()

        if not response.data:
            return jsonify({"error": "Ingen kod hittades för detta nummer"}), 404

        sms_code = response.data[0]

        # Kontrollera om redan verifierad
        if sms_code["verified"]:
            return jsonify({"message": "Redan verifierad"}), 200

        # Kontrollera om koden har gått ut
        expires_at = datetime.fromisoformat(sms_code["expires_at"])
        if datetime.utcnow() > expires_at:
            return jsonify({"error": "Koden har gått ut"}), 410

        # Kontrollera om koden stämmer
        if sms_code["code"] != str(code):
            return jsonify({"error": "Fel kod"}), 401

        # ✅ Uppdatera till verified = True
        supabase.table("sms_codes").update({"verified": True}) \
            .eq("id", sms_code["id"]).execute()

        return jsonify({"message": "Verifierad"}), 200

    except Exception as e:
        print("❌ Fel i verify_sms_code:", e)
        return jsonify({"error": "Verifiering misslyckades", "details": str(e)}), 500