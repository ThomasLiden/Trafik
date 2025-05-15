from flask import Blueprint, request, jsonify
from models.supabase_client import supabase
from supabase import create_client, Client
import os

member_blueprint = Blueprint('member', __name__)

# Registrering
@member_blueprint.route('/api/signup', methods=['POST'])
def signup():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")
    first_name = data.get("first_name")
    last_name = data.get("last_name")
    phone = data.get("phone")

    try:
        result = supabase.auth.sign_up({
            "email": email,
            "password": password
        })
        user = result.user
        if not user:
            return jsonify({"error": "Signup failed, no user returned"}), 400

        user_id = user.id
        supabase.table("users").insert({
            "user_id": user_id,
            "email": email,
            "first_name": first_name,
            "last_name": last_name,
            "phone": phone
        }).execute()

        stockholm_id = "7105f685-89fd-4d5c-808f-cb38012911f6"

        supabase.table("subscriptions").insert({
            "user_id": user_id,
            "active":True,
            "location_id": stockholm_id
        }).execute()

        return jsonify({"message": "User created", "email": email}), 200

    except Exception as e:
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


""" # Hämta prenumerationer för inloggad medlem
@member_blueprint.route('/api/subscriptions', methods=['GET', 'OPTIONS'])
def get_subscriptions():
    if request.method == 'OPTIONS':
        return {}, 200

    user_id = request.args.get("user_id")
    print("Hämtar prenumerationer för användare:", user_id)
    resp = supabase.table("subscriptions").select("*").eq("user_id", user_id).execute()
    return jsonify(resp.data), 200 """

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
