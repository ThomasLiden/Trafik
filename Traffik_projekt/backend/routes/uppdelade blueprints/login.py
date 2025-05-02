from flask import Blueprint, request, jsonify
from models.supabase_client import supabase

login_blueprint = Blueprint('login', __name__)
print("login.py är laddad!")

@login_blueprint.route('/api/login', methods=['POST'])
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