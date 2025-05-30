from flask import Blueprint, request, jsonify
from models.supabase_client import supabase

reset_password_blueprint = Blueprint('reset_password', __name__)
print("✅ reset_password.py är laddad!")

@reset_password_blueprint.route('/api/reset-password', methods=['POST'])
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
