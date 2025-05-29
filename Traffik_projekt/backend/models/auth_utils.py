from functools import wraps
from flask import request, jsonify
from models.supabase_client import supabase 

# Dekorator som kräver att användare är inloggade. 
def require_authenticated(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        #Hämtar token från Authorization header. 
        token = request.headers.get("Authorization", "").replace("Bearer ", "").strip()
        if not token:
            return jsonify({"error": "Ingen token angiven"}), 401

        try:
            #Verifierar token med Supabase Auth.
            user = supabase.auth.get_user(token).user
            if not user:
                return jsonify({"error": "Ogiltig token"}), 401
            
            #sparar user.id så att den är tillgänglig i funktionen som anropas.
            request.user_id = user.id
            return f(*args, **kwargs)

        except Exception as e:
            return jsonify({"error": f"Tokenfel: {str(e)}"}), 401

    return wrapper


# Dekorator som kräver att användaren har en viss roll t.ex. superadmin.
def require_role(required_role):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            #Hämtar token från Authorization-header.
            token = request.headers.get("Authorization", "").replace("Bearer ", "").strip()
            if not token:
                return jsonify({"error": "Ingen token angiven"}), 401

            try:
                #Verifierar token med Supabase. 
                user = supabase.auth.get_user(token).user
                if not user:
                    return jsonify({"error": "Ogiltig token"}), 401

                user_id = user.id
                request.user_id = user_id  # Gör det tillgängligt för route
                
                #Hämtar roll i reseller-tabellen baserat på användarens id. 
                result = supabase.table("reseller").select("role").eq("reseller_id", user_id).single().execute()
                user_role = result.data.get("role")
                
                #Om rollen inte matchar den roll som krävs nekas åtkomst. 
                if user_role != required_role:
                    return jsonify({"error": f"Endast {required_role} har åtkomst"}), 403

                return f(*args, **kwargs)

            except Exception as e:
                return jsonify({"error": f"Rollverifiering misslyckades: {str(e)}"}), 401

        return wrapper
    return decorator