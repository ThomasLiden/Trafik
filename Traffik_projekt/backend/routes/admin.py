from flask import Blueprint, request, jsonify
from models.supabase_client import supabase

admin_blueprint = Blueprint('admin', __name__, url_prefix= '/api/admin')


@admin_blueprint.route('/login', methods=['POST'])
def admin_login():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    try:
        # Logga in med Supabase Auth
        result = supabase.auth.sign_in_with_password({
            "email": email,
            "password": password
        })

        session = result.session
        user = result.user

        if session and user:
            # Hämta roll från reseller-tabellen baserat på id.
            reseller = supabase.table("reseller").select("role").eq("reseller_id", user.id).single().execute()
            user_role = reseller.data.get("role") if reseller.data else "reseller"

            return jsonify({
                "access_token": session.access_token,
                "reseller_id": user.id,
                "email": user.email,
                "role": user_role
            }), 200
        else:
            return jsonify({"error": "Login failed"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 400




#Hämta konto för en tidning för att redigera uppgifter.
@admin_blueprint.route('/account', methods=['GET'])
def get_account():
    reseller_id = request.args.get("reseller_id")

    if not reseller_id: 
        return jsonify({"error": "reseller_id saknas"}), 400 
    
    #Hämta tidningen (reseller) via e-post.
    reseller_result = supabase.table("reseller").select("*").eq("reseller_id", reseller_id).single().execute()
    reseller = reseller_result.data

    if not reseller:
        return jsonify({"error": "Tidningen hittades inte. "}), 404
    
    return jsonify({
        "name": reseller.get("name"),
        "region": reseller.get("region"),
        "phone": reseller.get("phone"),
        "email": reseller.get("email"),
        "reseller_id": reseller.get("reseller_id"),
        "role": reseller.get("role")
    })

#Spara konto vid redigering av uppgifter. 
@admin_blueprint.route('/account/update', methods=['POST'])
def update_account():
    data = request.get_json()
    reseller_id = data.get("reseller_id")

    if not reseller_id:
        return jsonify({"error": "reseller_id krävs. "}), 400
    
    update_data = {}

    if "name" in data:
        update_data["name"] = data["name"]
    
    if "region" in data:
        update_data["region"] = data["region"]

    if "phone" in data:
        update_data["phone"] = data["phone"]

    if "email" in data:
        update_data["email"] = data["email"]

    supabase.table("reseller").update(update_data).eq("reseller_id", reseller_id).execute()

    return jsonify({"message": "Kontot har uppdaterats! "})
    


