from flask import Blueprint, request, jsonify
from models.supabase_client import supabase
from datetime import datetime

from models.auth_utils import require_authenticated, require_role

admin_blueprint = Blueprint('admin', __name__, url_prefix= '/api/admin')

#Inloggning för adminsida.
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
            
            #Returnerar användardata och token. 
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
#Kräver att användaren är inloggad - dekorerad rutt. 
@admin_blueprint.route('/account', methods=['GET'])
@require_authenticated
def get_account():
    #Hämtar id för konto via token. 
    reseller_id = request.user_id

    if not reseller_id: 
        return jsonify({"error": "reseller_id saknas"}), 400 
    
    #Hämta tidningen (reseller) via id.
    reseller_result = supabase.table("reseller").select("*").eq("reseller_id", reseller_id).single().execute()
    reseller = reseller_result.data

    if not reseller:
        return jsonify({"error": "Tidningen hittades inte. "}), 404
    
    #Returnerar kontouppgifter.
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
@require_authenticated
def update_account():
    data = request.get_json()
    reseller_id = request.user_id

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

    #Uppdaterar reseller-tabellen för aktuellt konto.
    supabase.table("reseller").update(update_data).eq("reseller_id", reseller_id).execute()

    return jsonify({"message": "Kontot har uppdaterats! "})
    




#funktion för att lägga till en ny tidning/reseller. 
# Kräver att användaren är inloggad och har rollen Superadmin.
@admin_blueprint.route('/create_reseller', methods=['POST'])
@require_role("superadmin")
def create_reseller():
    data = request.get_json()

    #Fält för request.
    name = data.get("name")
    email = data.get("email")
    password = data.get("password")
    region = data.get("region")
    price = data.get("price")
    domain = data.get("domain")
    phone = data.get("phone")
    

    if not all([name, email, password, region,]):  # price, domain
        return jsonify({"error": "Alla fält måste fyllas i. "}), 400
    
    try:
        #Kontrollerar om domänen redan finns. 
        existing = supabase.table("reseller").select("*").eq("domain", domain).limit(1).execute()
        if existing.data:
            return jsonify({"error": "Domänen finns redan i systemet."}), 400
        
        #Skapar inlogg för ny reseller i supabase auth.
        auth_result = supabase.auth.sign_up({
            "email": email,
            "password": password
        })

        user = auth_result.user
        if not user: 
            return jsonify({"error": "Kunde inte skapa konto."}), 400
        
        #reseller_id är user.id för supabase auth.
        reseller_id = user.id
        created_at = datetime.utcnow().isoformat()
        
        #Lägger till i reseller-tabellen.
        result = supabase.table("reseller").insert({
            "reseller_id": reseller_id,
            "created_at": created_at,
            "name": name,
            "email": email,
            "price": price,
            "sms_count": 0,
            "domain": domain,
            "region": region,
            "phone": phone,
        }).execute()

        return jsonify({"message": "Reseller skapad!", "reseller": result.data}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500



