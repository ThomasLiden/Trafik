from flask import Blueprint, request, jsonify
from models.supabase_client import supabase
from supabase import create_client, Client
import os
from flask_cors import cross_origin
import random
from datetime import datetime, timedelta
import requests  

member_blueprint = Blueprint('member', __name__)

def generate_sms_code():
    return str(random.randint(100000, 999999))

# Registrering

@member_blueprint.route('/api/signup', methods=['POST', 'OPTIONS'])
def signup():
    if request.method == 'OPTIONS':
        return '', 200

    try:
        data = request.get_json()
        print("==> Inkommande data:", data)

        email = data.get("email")
        password = data.get("password")
        first_name = data.get("first_name")
        last_name  = data.get("last_name")
        phone      = data.get("phone")
        location_id = data.get("location_id")
        reseller_id = data.get("reseller_id")

        if not reseller_id:
            return jsonify({"error": "reseller_id krävs"}), 400

        # Bekräfta att återförsäljaren finns
        lookup = supabase.table("reseller") \
                         .select("reseller_id") \
                         .eq("reseller_id", reseller_id) \
                         .single() \
                         .execute()
        if not lookup.data:
            return jsonify({"error": f"Ingen reseller med id {reseller_id} hittades"}), 400

        # Skapa Supabase-användare
        result = supabase.auth.sign_up({
            "email": email,
            "password": password
        })

        user = result.user
        if not user:
            raise ValueError("Signup misslyckades, ingen användare skapades")

        user_id = user.id

        # Spara användardata
        supabase.table("users").insert({
            "user_id": user_id,
            "email": email,
            "first_name": first_name,
            "last_name": last_name,
            "phone": phone,
            "reseller_id": reseller_id,
            "phone_confirmed": True  # Sätt till True direkt eftersom ingen verifiering sker
        }).execute()

        return jsonify({
            "message": "Användare skapad",
            "email": email,
            "user_id": user_id
        }), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 400

# Logga in
@member_blueprint.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    try:
        result = supabase.auth.sign_in_with_password({
            "email": email,
            "password": password
        })

        session = result.session
        user = result.user

        if session and user:
            return jsonify({
                "access_token": session.access_token,
                "refresh_token": session.refresh_token,
                "user_id": user.id,
                "email": user.email
            }), 200
        else:
            return jsonify({"error": "Login failed"}), 400

    except Exception as e:
        return jsonify({"error": str(e)}), 400


# Glömt lösenord
@member_blueprint.route('/api/forgot-password', methods=['POST'])
def forgot_password():
    data = request.get_json()
    email = data.get("email")

    try:
        supabase.auth.reset_password_for_email(
            email,
            {
                "redirect_to": "http://127.0.0.1:5500/Traffik_projekt/frontend/src/index.html#/reset-password"
            }
        )
        return jsonify({"message": "Återställningslänk skickad till din e-post."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


# Återställ lösenord via access_token + refresh_token
@member_blueprint.route('/api/reset-password', methods=['POST'])
def reset_password():
    data = request.get_json()
    access_token = data.get("access_token")
    refresh_token = data.get("refresh_token")
    new_password = data.get("new_password")

    if not access_token or not refresh_token or not new_password:
        return jsonify({"error": "access_token, refresh_token och new_password krävs"}), 400

    try:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        user_client: Client = create_client(url, key)

        # Sätt session med både access och refresh token
        user_client.auth.set_session(
            access_token=access_token,
            refresh_token=refresh_token
        )

        res = user_client.auth.update_user({"password": new_password})
        return jsonify({"message": "Lösenordet har uppdaterats!"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 400


# Ändra kontaktuppgifter
@member_blueprint.route('/api/user-profile', methods=['GET'])
def get_user_profile():
    user_id = request.args.get("user_id")
    result = supabase.table("users").select("*").eq("user_id", user_id).single().execute()
    return jsonify(result.data)


# Uppdatera profil
@member_blueprint.route('/api/update-profile', methods=['POST'])
def update_user_profile():
    data = request.get_json()
    user_id = data["user_id"]
    supabase.table("users").update({
        "first_name": data["first_name"],
        "last_name": data["last_name"],
        "email": data["email"],
        "phone": data["phone"]
    }).eq("user_id", user_id).execute()
    return jsonify({"message": "Profil uppdaterad!"})


@member_blueprint.route('/api/subscriptions', methods=['GET'])
def get_subscriptions():
    user_id = request.args.get("user_id")
    print("Hämtar prenumerationer för användare:", user_id)  # Debug

    resp = supabase.table("subscriptions").select("*").eq("user_id", user_id).execute()
    print("Prenumerationer från databasen:", resp.data)  # Debug

    return jsonify(resp.data), 200

@member_blueprint.route('/api/cancel-subscription', methods=['POST', 'OPTIONS'])
def cancel_subscription():
    if request.method == 'OPTIONS':
        return {}, 200

    data = request.get_json()
    subscription_id = data.get("subscription_id")

    if not subscription_id:
        return jsonify({"error": "Prenumerations-ID krävs"}), 400

    try:
        supabase.table("subscriptions").update({"active": False}).eq("subscription_id", subscription_id).execute()
        return jsonify({"message": "Prenumerationen har avslutats"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    
# Hämta alla regioner från locations-tabellen
@member_blueprint.route('/api/regions', methods=['GET'])
def get_regions ():
    try:
        response = supabase.table("location") \
                           .select("region, location_id") \
                           .order("region") \
                           .execute()
        #regions = list({row["region"] for row in response.data if row.get("region")})
        return jsonify(response.data), 200
    except Exception as e:
        print("==> FEL I /api/regions:", e)
        return jsonify({"error": str(e)}), 400
                           
#Rutt för reseller-info
@member_blueprint.route('/api/reseller-info', methods=['GET'])
def get_reseller_info():
    reseller_id = request.args.get("reseller_id")
    if not reseller_id:
        return jsonify({"error": "reseller_id krävs"}), 400

    try:
        response = supabase.table("reseller") \
                           .select("name, price") \
                           .eq("reseller_id", reseller_id) \
                           .single() \
                           .execute()
        return jsonify(response.data), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


