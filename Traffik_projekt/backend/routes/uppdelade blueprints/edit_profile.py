# Endast påbörjad!! 

from flask import Blueprint, request, jsonify
from models.supabase_client import supabase

profile_blueprint = Blueprint('profile', __name__)

@profile_blueprint.route('/api/user-profile', methods = ['GET'])
def get_user_profile():
    user_id = request.args.get("user_id")
    result = supabase.table("users").select("*").eq("id", user_id).single().execute()
    return jsonify(result.data)

@profile_blueprint.route('/api/update-profile', methods=['POST'])
def update_user_profile():
    data = request.get_json()
    user_id = data["user_id"]
    supabase.table("users").update({
        "name": data["name"],
        "email": data["email"],
        "phone": data["phone"]
    }).eq("id", user_id).execute()
    return jsonify({"message": "Profil uppdaterad!"})