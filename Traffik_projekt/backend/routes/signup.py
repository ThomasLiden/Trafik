from flask import Blueprint, request, jsonify
from models.supabase_client import supabase

signup_blueprint = Blueprint('signup', __name__)

@signup_blueprint.route('/api/signup', methods=['POST'])
def signup():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    try:
        result = supabase.auth.sign_up({
            "email": email,
            "password": password
        })
        return jsonify({"message": "User created", "email": email}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400
