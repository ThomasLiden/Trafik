from flask import Blueprint, request, jsonify
from models.supabase_client import supabase

signup_blueprint = Blueprint('signup', __name__)
print(" signup.py är laddad!")

@signup_blueprint.route('/api/signup', methods=['POST'])
def signup():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")
    name = data.get("name")
    phone = data.get("phone")

    try:
        result = supabase.auth.sign_up({
            "email": email,
            "password": password,
            "name": name,
            "phone": phone
        }) #kolla om det här räcker för att lagra 

        user = result.user
        if user:
            user_id = user.id

            supabase.table("users").insert({
                "user_id": user_id, #ändrat från id till user_id efter 400 fel
                "email": email,
                "name": name,
                "phone": phone
            }).execute()

        return jsonify({"message": "User created", "email": email}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 400
