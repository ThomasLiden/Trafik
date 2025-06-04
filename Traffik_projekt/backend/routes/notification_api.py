from datetime import timezone
from flask import Blueprint, request, jsonify
from supabase import create_client
import requests
import os
import random
from datetime import datetime, timedelta

notification_api = Blueprint("notification_api", __name__, url_prefix="/api")

# Supabase-anslutning
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Externa tjänster
TRAFIKVERKET_API = os.getenv("TRAFIKVERKET_PROXY_URL")
SMS_SERVER_URL = os.getenv("RENDER_SMS_URL")
EMAIL_SERVER_URL = os.getenv("RENDER_EMAIL_URL")
API_KEY = os.getenv("X_API_KEY")  # Hämtas från .env

@notification_api.route("/send_sms_for_deviation", methods=["POST", "OPTIONS"])
def send_sms_for_deviation():
    print(" Route: /api/send_sms_for_deviation REACHED")

    if request.method == "OPTIONS":
        return jsonify({"ok": True}), 200

    try:
        data = request.get_json()
        dev_id = data.get("devId")
        county_no = data.get("countyNo")
        deviation = data.get("deviation", {})

        print(" county_no från frontend:", county_no)

        # 🧪 Validera indata
        if not dev_id or not county_no:
            return jsonify({"error": "devId och countyNo krävs"}), 400

        if not deviation:
            print("Ingen trafikhändelse-data mottagen från frontend.")
            return jsonify({"error": "Ingen trafikhändelse-data medskickad"}), 400

        # Hämta plats
        location_data = supabase.table("location").select("*").execute()
        location_id = next(
            (row["location_id"] for row in location_data.data if str(row["county_no"]) == str(county_no)),
            None
        )

        if not location_id:
            return jsonify({"error": f"Inget län hittat med county_no = {county_no}"}), 404

        print("Hittad plats:", location_id)

        # Hämta aktiva prenumeranter
        subscriptions = supabase.table("subscriptions").select("user_id") \
            .eq("location_id", location_id).eq("active", True).execute()

        if not subscriptions.data:
            return jsonify({"message": "Inga aktiva prenumeranter"}), 200

        # Förbered sms-text
        header = deviation.get("Header", "Trafikstörning") or "Trafikstörning"
        message_text = deviation.get("Message", "")
        link = "https://www.trafikverket.se/trafikinformation/"
        
        if message_text:
            sentences = message_text.split(". ")
            short_details = ". ".join(sentences[:2]).strip()

            max_text_length = 160 - len(link) - 20
            if len(short_details) > max_text_length:
                short_details = short_details[:max_text_length].rstrip() + "…"
        else:
            short_details = "Se mer information på Trafikverkets hemsida."

        composed_message = (
            f" {header.strip()[:60]}\n"
            f"{short_details}\n"
            f"Läs mer: {link}"
        )

        # Hämta mottagare
        recipients = []
        for sub in subscriptions.data:
            user_id = sub["user_id"]

            # Kontrollera dubblett
            existing_notification = supabase.table("notifications").select("id") \
                .eq("user_id", user_id).eq("external_id", dev_id).eq("channel", "sms").execute()
            if existing_notification.data:
                continue

            user_data = supabase.table("users").select("phone").eq("user_id", user_id).execute()
            if not user_data.data:
                continue

            phone = user_data.data[0].get("phone")
            if phone:
                recipients.append({
                    "user_id": user_id,
                    "phone": phone
                })

        print("📲 Mottagare:", recipients)

        if not recipients:
            return jsonify({"message": "Alla har redan fått detta sms eller saknar telefonnummer"}), 200

        # Skicka sms
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

        print("Payload till HelloSMS:", sms_payload)
        sms_res = requests.post(SMS_SERVER_URL, json=sms_payload, headers=headers)
        sms_res.raise_for_status()

        # Logga varje sms som skickats
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
        print("Fel i sms-utskick:", e)
        return jsonify({"error": "Fel vid sms-utskick", "details": str(e)}), 500



@notification_api.route("/send_email_for_deviation", methods=["POST", "OPTIONS"])
def send_email_for_deviation():
    print("Route: /api/send_email_for_deviation REACHED")

    if request.method == "OPTIONS":
        return jsonify({"ok": True}), 200

    try:
        data = request.get_json()
        dev_id = data.get("devId")
        county_no = data.get("countyNo")
        deviation = data.get("deviation", {})

        print("county_no från frontend:", county_no)

        # 🧪 Kontrollera indata
        if not dev_id or not county_no:
            return jsonify({"error": "devId och countyNo krävs"}), 400

        # Hämta platsdata från Supabase
        location_data = supabase.table("location").select("*").execute()
        location_id = next(
            (row["location_id"] for row in location_data.data if str(row["county_no"]) == str(county_no)),
            None
        )

        if not location_id:
            return jsonify({"error": f"Inget län hittat med county_no = {county_no}"}), 404

        print("Hittad plats:", location_id)

        # Hämta alla aktiva prenumeranter för länet
        subscriptions = supabase.table("subscriptions").select("user_id") \
            .eq("location_id", location_id).eq("active", True).execute()

        if not subscriptions.data:
            return jsonify({"message": "Inga aktiva e-postprenumeranter"}), 200

        recipients = []
        for sub in subscriptions.data:
            user_id = sub["user_id"]

            # Kontrollera att notifikation inte redan skickats
            existing_notification = supabase.table("notifications").select("id") \
                .eq("user_id", user_id).eq("external_id", dev_id).eq("channel", "email").execute()
            if existing_notification.data:
                continue

            # Hämta e-postadress
            user_data = supabase.table("users").select("email").eq("user_id", user_id).execute()
            if not user_data.data:
                continue

            email = user_data.data[0].get("email")
            if email:
                recipients.append({
                    "user_id": user_id,
                    "email": email
                })

        print(" Mottagare:", recipients)

        if not recipients:
            return jsonify({"message": "Alla har redan fått mail eller saknar e-post"}), 200

        # Hitta rätt länsnamn för rubrik
        county_map = {str(row["county_no"]): row["region"] for row in location_data.data}
        county_name = county_map.get(str(county_no), f"län {county_no}")

        # Skapa mejl
        subject = f" Ny trafikstörning i {county_name}"
        header = deviation.get("Header", "Trafikhändelse")
        msg_text = deviation.get("Message", "Se mer info nedan.")

        message = (
            f"{header}\n\n"
            f"{msg_text}\n\n"
            f"Läs mer: https://trafikinfo.trafikverket.se"
        )
        payload = {
            "to": [r["email"] for r in recipients],
            "subject": subject,
            "message": message,  # plaintext fallback
            "html_message": f"""
            <html>
            <body style="font-family:Segoe UI,sans-serif; background:#f7f9fc; padding:1em; color:#333;">
            <h2 style="color:#d7263d;"> Ny trafikstörning i {county_name}</h2>
            <p><strong>{header}</strong></p>
            <p>{msg_text}</p>
            <p><a href="https://www.trafikverket.se/trafikinformation/sok/?sok={dev_id}" target="_blank"
                style="display:inline-block;padding:0.6em 1.2em;background-color:#0d3b66;color:white;text-decoration:none;border-radius:6px;">
                 Visa mer information
            </a></p>
            <p style="font-size:0.9em;color:#666;">Du får detta mail eftersom du prenumererar på trafikstörningar i {county_name}.</p>
            </body>
            </html>
            """
        }

        headers = {
            "Content-Type": "application/json",
            "X-API-KEY": API_KEY
        }

        print(" Payload till mailserver:", payload)
        email_res = requests.post(EMAIL_SERVER_URL, json=payload, headers=headers)
        email_res.raise_for_status()

        #  Logga utskick
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
        print(" Fel i e-postutskick:", e)
        return jsonify({"error": "Fel vid mail-utskick", "details": str(e)}), 500


@notification_api.route("/notifications", methods=["GET"])
def list_notifications():
    try:
        response = supabase.table("notifications").select("*").order("created_at", desc=True).limit(50).execute()
        return jsonify(response.data)
    except Exception as e:
        print(" Fel vid hämtning av notifikationer:", e)
        return jsonify({"error": "Kunde inte hämta notifikationer", "details": str(e)}), 500
    
