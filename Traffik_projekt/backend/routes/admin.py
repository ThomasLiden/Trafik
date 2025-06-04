from flask import Blueprint, request, jsonify
from models.supabase_client import supabase
from datetime import datetime, timedelta
import stripe
import os

from models.auth_utils import require_authenticated, require_role

admin_blueprint = Blueprint('admin', __name__, url_prefix= '/api/admin')

stripe.api_key = os.getenv('STRIPE_SECRET_KEY')

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



# Hämtar statistik för inloggad tidning. 
@admin_blueprint.route('/reseller/stats', methods=['GET'])
@require_authenticated
def get_reseller_stats():

    reseller_id = request.user_id  # Hämtar reseller_id från token


    if not reseller_id:
        return jsonify({"error": "reseller_id saknas"}), 400

    try:
        # Hämta användare kopplade till denna tidning
        user_rows = supabase.table("users")\
            .select("user_id")\
            .eq("reseller_id", reseller_id)\
            .execute()
        user_ids = [u["user_id"] for u in user_rows.data]

        if not user_ids:
            return jsonify({
                "reseller_id": reseller_id,
                "sms_30_days": 0,
                "sms_12_months": 0,
                "subscription_count": 0
            }), 200

        # Datumgränser
        now = datetime.utcnow()
        days_30 = now - timedelta(days=30)
        days_365 = now - timedelta(days=365)

        # SMS senaste 30 dagar
        sms_30 = supabase.table("notifications")\
            .select("id", count="exact")\
            .in_("user_id", user_ids)\
            .eq("channel", "sms")\
            .gte("created_at", days_30.isoformat())\
            .execute().count or 0

        # SMS senaste 12 månader
        sms_365 = supabase.table("notifications")\
            .select("id", count="exact")\
            .in_("user_id", user_ids)\
            .eq("channel", "sms")\
            .gte("created_at", days_365.isoformat())\
            .execute().count or 0

        # Aktiva prenumerationer
        subs_raw = supabase.table("subscriptions")\
            .select("user_id", "active")\
            .in_("user_id", user_ids)\
            .execute().data

        subscription_count = sum(1 for s in subs_raw if s.get("active") is True)

        return jsonify({
            "reseller_id": reseller_id,
            "sms_30_days": sms_30,
            "sms_12_months": sms_365,
            "subscription_count": subscription_count
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
    
#Hämta alla användare till en tidning som är inloggad. Hämtar id via token. 
@admin_blueprint.route('/reseller/users', methods=['GET'])
@require_authenticated
def get_reseller_users():
    
    reseller_id = request.user_id  # Hämtar från token. 


    if not reseller_id:
        return jsonify({"error": "reseller_id saknas"}), 400

    try:
        # Hämta användare kopplade till denna tidning
        user_rows = supabase.table("users")\
            .select("user_id, first_name, last_name, email")\
            .eq("reseller_id", reseller_id)\
            .execute().data

        user_ids = [u["user_id"] for u in user_rows]

        if not user_ids:
            return jsonify({"users": []}), 200

        # Hämta prenumerationsstatus för dessa användare
        subs_raw = supabase.table("subscriptions")\
            .select("user_id, active")\
            .in_("user_id", user_ids)\
            .execute().data

        # Skapa en dict med user_id -> active
        subs_map = {s["user_id"]: s.get("active", False) for s in subs_raw}

        # Bygg lista med användare + aktiv status
        users = []
        for u in user_rows:
            users.append({
                "user_id": u["user_id"],
                "first_name": u.get("first_name", ""),
                "last_name": u.get("last_name", ""),
                "email": u.get("email", ""),
                "active": subs_map.get(u["user_id"], False)
            })

        return jsonify({"users": users}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


#Hämta konto för en tidning för att redigera uppgifter.
#Kräver att användaren är inloggad - dekorerad rutt. 
@admin_blueprint.route('/account', methods=['GET'])
@require_authenticated
def get_account():
    #Hämtar id för konto via token. 
    reseller_id = request.user_id

    if not reseller_id: 
        return jsonify({"error": "reseller_id saknas"}), 400 
    
    #Hämta tidning (reseller) via id.
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
#Kräver att användaren är inloggad - dekorerad rutt. 
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
    

#funktion för att hämta pris för en tidning. 
@admin_blueprint.route('/pricing', methods=['GET'])
@require_authenticated
def get_reseller_price():
    #Hämtar id för konto via token. 
    reseller_id = request.user_id
    
    try:
        #Hämta endast fältet price från reseller_tabellen.
        result = supabase.table("reseller").select("price").eq("reseller_id", reseller_id).single().execute()
        price = result.data
        
        if not price:
           return jsonify({"error": "pris för tidning hittades inte. "}), 404
    
        #Returnerar pris.
        return jsonify({"price": price.get("price")}), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    

#funktion för att uppdatera nytt pris för en tidning. 
#Kräver att användaren är inloggad - dekorerad rutt. 
@admin_blueprint.route('/pricing/update', methods=['POST'])
@require_authenticated
def update_reseller_price():
    data = request.get_json()
    reseller_id = request.user_id

    new_price = data.get("price")
    if new_price is None:
        return jsonify({"error": "Nytt pris saknas"}), 400

    try:
        # 1. Hämta aktiv produkt för resellern
        product_row = supabase.table("reseller_products")\
            .select("stripe_product_id")\
            .eq("reseller_id", reseller_id)\
            .eq("active", True)\
            .limit(1)\
            .execute()
        if not product_row.data:
            # Om ingen reseller_product finns - Skapa ny Stripe-produkt
            reseller_info = supabase.table("reseller")\
                .select("name")\
                .eq("reseller_id", reseller_id)\
                .single()\
                .execute()

            reseller_name = reseller_info.data.get("name", "Tidning")

            product = stripe.Product.create(
               name=f"Trafiknotifiering - {reseller_name}",
               description="Prenumeration för trafiknotifieringar",
               metadata={
               "reseller_id": reseller_id,
               "reseller_name": reseller_name
             }
            )

            stripe_product_id = product.id
        else:
            stripe_product_id = product_row.data[0]["stripe_product_id"]


        # 2. Skapa nytt pris i Stripe
        stripe_price = stripe.Price.create(
            product=stripe_product_id,
            unit_amount=int(float(new_price) * 100),
            currency='sek',
            recurring={'interval': 'month'},
            metadata={
                "reseller_id": reseller_id
            }
        )

        # 3. Sätt tidigare priser som inactive
        supabase.table("reseller_products").update({"active": False}).eq("reseller_id", reseller_id).eq("active", True).execute()

        # 4. Spara nya priset som en ny rad
        supabase.table("reseller_products").insert({
            "reseller_id": reseller_id,
            "stripe_product_id": stripe_product_id,
            "stripe_price_id": stripe_price.id,
            "price": float(new_price),
            "active": True
        }).execute()

        # 5. Uppdatera även priset i reseller-tabellen
        supabase.table("reseller").update({"price": new_price}).eq("reseller_id", reseller_id).execute()

        return jsonify({"message": "Priset har uppdaterats."}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500



#Funktion för att hämta alla resellers eller baserat på ett valt län. 
#Endast för superadmin.
@admin_blueprint.route('/resellers', methods=['GET'])
@require_role("superadmin")
def get_all_resellers(): 
    #Hämtar eventuell valt län. 
    region = request.args.get("region")
    
    try:
        #Skapa en selectfråga för att hämta tidningar. 
        query = supabase.table("reseller")\
            .select("reseller_id, name, region, email, created_at")\
            .eq("role", "reseller")  # Filtrera på roll.
        
        #Om län har angetts, filtrera på det. 
        if region:
          query = query.eq("region", region)
    
        result = query.execute() #Kör frågan.
        return jsonify({"resellers": result.data}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500



# Hämtar statistik för en viss tidning eller för alla tidningar i ett län (region)
# Endast för superadmin
@admin_blueprint.route('/stats', methods=['GET'])
@require_role("superadmin")
def reseller_statistics():
    region = request.args.get("region")
    reseller_id = request.args.get("reseller_id")

    try:
        # Hämta användare baserat på region eller återförsäljare
        users = fetch_users(region=region, reseller_id=reseller_id)

        if users is None:
            return jsonify({"error": "region eller reseller_id krävs"}), 400

        user_ids = [str(u["user_id"]) for u in users]

        # Om inga användare hittades, returnera tom statistik
        if not user_ids:
            return jsonify({
                "reseller_id": reseller_id,
                "region": region,
                "sms_30_days": 0,
                "sms_12_months": 0,
                "subscription_count": 0
            }), 200

        # Datumgränser
        now = datetime.utcnow()
        days_30 = now - timedelta(days=30)
        days_365 = now - timedelta(days=365)

        # SMS senaste 30 dagar
        sms_30 = supabase.table("notifications")\
            .select("id", count="exact")\
            .in_("user_id", user_ids)\
            .eq("channel", "sms")\
            .gte("created_at", days_30.isoformat())\
            .execute().count or 0

        # SMS senaste 12 månader
        sms_365 = supabase.table("notifications")\
            .select("id", count="exact")\
            .in_("user_id", user_ids)\
            .eq("channel", "sms")\
            .gte("created_at", days_365.isoformat())\
            .execute().count or 0

        # Aktiva prenumerationer
        subs_raw = supabase.table("subscriptions")\
            .select("user_id", "active")\
            .in_("user_id", user_ids)\
            .execute().data

        subscription_count = sum(1 for s in subs_raw if s.get("active") is True)

        # Returnera statistik
        return jsonify({
            "reseller_id": reseller_id,
            "region": region,
            "sms_30_days": sms_30,
            "sms_12_months": sms_365,
            "subscription_count": subscription_count
        }), 200

    except Exception as e:
        return jsonify({"error": f"Något gick fel: {str(e)}"}), 500


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
            "domain": domain,
            "region": region,
            "phone": phone,
        }).execute()

        # --- Stripe-logik ---
        try:
            # Skapa Stripe-produkt
            product = stripe.Product.create(
                name=f"Trafiknotifiering - {name}",
                description="Prenumeration för trafiknotifieringar",
                metadata={
                    "reseller_id": reseller_id,
                    "reseller_name": name
                }
            )
            # Skapa Stripe-pris
            stripe_price = stripe.Price.create(
                product=product.id,
                unit_amount=int(float(price) * 100),  # priset i öre
                currency='sek',
                recurring={'interval': 'month'},
                metadata={
                    "reseller_id": reseller_id
                }
            )
            # Spara i reseller_products
            supabase.table("reseller_products").insert({
                "reseller_id": reseller_id,
                "stripe_product_id": product.id,
                "stripe_price_id": stripe_price.id,
                "price": float(price),
                "active": True
            }).execute()
        except Exception as stripe_err:
            # Om Stripe misslyckas, returnera ändå reseller men med varning
            return jsonify({
                "message": "Reseller skapad, men Stripe-anslutning misslyckades!",
                "reseller": result.data,
                "stripe_error": str(stripe_err)
            }), 201
        # --- Slut Stripe-logik ---

        #return jsonify({"message": "Reseller skapad!", "reseller": result.data}), 201
        return jsonify({
            "message": "Reseller skapad!",
            "reseller_id": reseller_id,
            "email": email,
            "password": password  # bara för bekräftelse – sparas inte i databasen!
        }), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500



# Hjälpfunktion för att hämta användare baserat på reseller_id eller region
def fetch_users(region=None, reseller_id=None):
    if reseller_id:
        return supabase.table("users")\
            .select("user_id")\
            .eq("reseller_id", reseller_id)\
            .execute().data

    elif region:
        resellers = supabase.table("reseller")\
            .select("reseller_id")\
            .eq("region", region)\
            .execute().data

        reseller_ids = [r["reseller_id"] for r in resellers]
        if not reseller_ids:
            return []

        return supabase.table("users")\
            .select("user_id", "reseller_id")\
            .in_("reseller_id", reseller_ids)\
            .execute().data
    else:
        return None
