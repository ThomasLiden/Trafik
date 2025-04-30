#Lite osäker på om denna 
from flask import Blueprint, request, jsonify
from models.supabase_client import supabase

forgot_password_blueprint = Blueprint('forgot_password', __name__)
print("forgot_password.py är laddad")

@forgot_password_blueprint.route('/api/forgot-password', methods=['POST'])
def forgot_password():
    data = request.get_json()
    email = data.get("email")

    try:
        supabase.auth.reset_password_for_email(email)
        return jsonify({"message": "Återställningslänk skickad till din e-post."}), 200
    except Exception as e: 
        return jsonify({"error": str(e)}), 400 