# Alla ruttter samlade i en blueprint! 
# De andra är ej aktiva just nu, tror det är smartast att ha de samlade såhär 

from flask import Blueprint, request, jsonify
import os
import requests
from models.supabase_client import supabase

member_blueprint = Blueprint('member', __name__)

#Registrering
@member_blueprint.route('/api/signup', methods=['POST'])
def signup():
    data = request.get_json()
    print(" MOTTAGET PAYLOAD:", data)

    email = data.get("email")
    password = data.get("password")
    first_name = data.get("first_name")
    last_name = data.get("last_name")
    phone = data.get("phone")

    try:
        # 1) Skapa auth
        result = supabase.auth.sign_up({
            "email": email,
            "password": password
        })
        print("AUTH RESULT:", result)

        user = result.user
        if not user:
            print(" Inget user-objekt i auth-result")
            return jsonify({"error": "Signup failed, no user returned"}), 400

        user_id = user.id
        print(" NYTT USER_ID:", user_id)

        # 2) Försök insert
        insert_res = supabase.table("users").insert({
            "user_id": user_id,
            "email": email,
            "first_name": first_name,
            "last_name": last_name,
            "phone": phone
        }).execute()
        print(" INSERT RESULT:", insert_res)

        return jsonify({"message": "User created", "email": email}), 200

    except Exception as e:
        print("EXCEPTION I SIGNUP:", e)
        return jsonify({"error": str(e)}), 400


#Logga in
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
                "user_id": user.id,
                "email": user.email
            }), 200
        else: 
            return jsonify({"error": "Login failed"}), 400
        
    except Exception as e:
        return jsonify({"error": str(e)}), 400 

#Glömt lösenord
""" @member_blueprint.route('/api/forgot-password', methods=['POST'])
def forgot_password():
    data = request.get_json()
    email = data.get("email")
    
    try:
        supabase.auth.reset_password_for_email(email) 
        return jsonify({"message": "Återställningslänk skickad till din e-post."}), 200
    except Exception as e: 
        return jsonify({"error": str(e)}), 400  """

### Glömt Lösenord med Supabase inbyggda sida
@member_blueprint.route('/api/forgot-password', methods=['POST'])
def forgot_password():
    data = request.get_json()
    email = data.get("email")

    if not email:
        return jsonify({"error": "E-post krävs"}), 400

    try:
        # Använd direkt HTTP-förfrågan för lösenordsåterställning
        redirect_url = "http://127.0.0.1:5500/Traffik_projekt/frontend/src/index.html#/login"  # Ändrad till exakt path
        url = f"{os.getenv('SUPABASE_URL')}/auth/v1/recover"
        headers = {
            "apikey": os.getenv("SUPABASE_KEY"),
            "Authorization": f"Bearer {os.getenv('SUPABASE_KEY')}",
            "Content-Type": "application/json",
        }
        payload = {
            "email": email,
            "redirect_to": redirect_url
        }

        response = requests.post(url, headers=headers, json=payload)
        if response.status_code == 200:
            return jsonify({"message": "Återställningslänk skickad till din e-post."}), 200
        else:
            print("Fel vid lösenordsåterställning:", response.text)
            return jsonify({"error": "Fel vid lösenordsåterställning: " + response.text}), 400
    except Exception as e:
        print("EXCEPTION I FORGOT PASSWORD:", e)
        return jsonify({"error": "Fel vid lösenordsåterställning: " + str(e)}), 400 

#Återställ lösenord
""" @member_blueprint.route('/api/reset-password', methods=['POST']) 
def reset_password():
    data = request.get_json()
    print("Inkommande data:", data)
    access_token = data.get("access_token")
    new_password = data.get("new_password")

    
    if not access_token:
        print("Access token saknas")
        return jsonify({"error": "Access token saknas"}), 400

    if not new_password:
        print("Nytt lösenord saknas")
        return jsonify({"error": "Nytt lösenord saknas"}), 400
    try:
        # Verifiera användare med åtkomsttoken
        user = supabase.auth.get_user(access_token)
        print("Användare hittad:", user)

        if user:
            # Uppdatera lösenordet för användaren
            supabase.auth.update_user(
                user=user, 
                password=new_password
            )
            print("Lösenord uppdaterat för användare:", user['id'])
            return jsonify({"message": "Lösenordet har uppdaterats!"}), 200
        else:
            print("Ogiltig access token")
            return jsonify({"error": "Ogiltig access token"}), 400

    except Exception as e:
        print("Fel vid återställning:", str(e))
        return jsonify({"error": "Ett fel uppstod vid återställning av lösenordet."}), 500 """

    ##try:
"""         response = supabase.auth.update_user({"password": new_password
        })
        print("Resultat från Supabase:", response)
        return jsonify({"message": "Lösenordet har uppdaterats!"}), 200

    except Exception as e:
        print("Fel vid återställning:", str(e))
    
    return jsonify({"error": str(e)}), 400  """

#Ändra kontaktuppgifter 
@member_blueprint.route('/api/user-profile', methods = ['GET'])
def get_user_profile():
    user_id = request.args.get("user_id")
    result = supabase.table("users").select("*").eq("user_id", user_id).single().execute()
    return jsonify(result.data)

#uppdaterar profilen 
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

#hämtar prenumerationer för inloggad medlem
@member_blueprint.route('/api/subscriptions', methods=['GET', 'OPTIONS'])
def get_subscriptions():
    # Preflight-svar
    if request.method == 'OPTIONS':
        return {}, 200

    user_id = request.args.get("user_id")
    # Hämta alla subscriptions för just den user_id
    resp = supabase.table("subscriptions") \
                   .select("*") \
                   .eq("user_id", user_id) \
                   .execute()
    return jsonify(resp.data), 200