# Alla ruttter samlade i en blueprint! 
# De andra är ej aktiva just nu, tror det är smartast att ha de samlade såhär 

from flask import Blueprint, request, jsonify
from models.supabase_client import supabase

member_blueprint = Blueprint('member', __name__)

#Registrering
@member_blueprint.route('/api/signup', methods=['POST'])
def signup():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")
    name = data.get("name")
    phone = data.get("phone")

    try:
        result = supabase.auth.sign_up({
            "email": email,
            "password": password
        }) #ändrat detta så namn och telefon inte skickas till auth

        user = result.user
        if user:
            user_id = user.id

            supabase.table("users").insert({
                "id": user_id,
                "email": email,
                "name": name,
                "phone": phone
            }).execute()

        return jsonify({"message": "User created", "email": email}), 200

    except Exception as e:
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
@member_blueprint.route('/api/forgot-password', methods=['POST'])
def forgot_password():
    data = request.get_json()
    email = data.get("email")

    try:
        supabase.auth.reset_password_for_email(email)
        return jsonify({"message": "Återställningslänk skickad till din e-post."}), 200
    except Exception as e: 
        return jsonify({"error": str(e)}), 400 


#Återställ lösenord
@member_blueprint.route('/api/reset-password', methods=['POST'])
def reset_password():
    data = request.get_json()
    access_token = data.get("access_token")
    new_password = data.get("new_password")

    try:
        supabase.auth.update_user(access_token, {
            "password": new_password
        })
        return jsonify({"message": "Lösenordet har uppdaterats!"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 400

#Ändra kontaktuppgifter (påbörjad)
@member_blueprint.route('/api/user-profile', methods = ['GET'])
def get_user_profile():
    user_id = request.args.get("user_id")
    result = supabase.table("users").select("*").eq("id", user_id).single().execute()
    return jsonify(result.data)

@member_blueprint.route('/api/update-profile', methods=['POST'])
def update_user_profile():
    data = request.get_json()
    user_id = data["user_id"]
    supabase.table("users").update({
        "name": data["name"],
        "email": data["email"],
        "phone": data["phone"]
    }).eq("id", user_id).execute()
    return jsonify({"message": "Profil uppdaterad!"})