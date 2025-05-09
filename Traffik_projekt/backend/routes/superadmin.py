from flask import Blueprint, request, jsonify
from models.supabase_client import supabase
import uuid
from datetime import datetime


superadmin_blueprint = Blueprint('superadmin', __name__, url_prefix= '/api/superadmin')

@superadmin_blueprint.route('/create_reseller', methods=['POST'])
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
        existing = supabase.table("reseller").select("*").eq("domain", domain).limit(1).execute()
        if existing.data:
            return jsonify({"error": "Domänen finns redan i systemet."}), 400
        
        auth_result = supabase.auth.sign_up({
            "email": email,
            "password": password
        })

        user = auth_result.user
        if not user: 
            return jsonify({"error": "Kunde inte skapa konto."}), 400
    
        reseller_id = user.id
        created_at = datetime.utcnow().isoformat()

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



