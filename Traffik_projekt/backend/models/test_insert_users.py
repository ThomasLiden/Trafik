from supabase_client import supabase
import uuid

# Skapa testdata
new_user = {
    "id": str(uuid.uuid4()),
    "name": "Test Testsson",
    "phone": "0701234567",
    "email": "test@example.com"
}

# Försök att skriva till tabellen "users"
try:
    response = supabase.table("users").insert(new_user).execute()
    print("Användare skapad:", response)
except Exception as e:
     print(" Fel vid skapande:", e)
