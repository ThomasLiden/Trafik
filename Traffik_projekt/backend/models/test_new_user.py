from supabase_client import supabase
import uuid
from datetime import datetime, timezone

# Testdata
user_id = str(uuid.uuid4())  # unikt ID för denna testanvändare
email = "katja.bjorlinger@hotmail.com"
first_name = "Test"
last_name = "User"
phone = "0701234567"

# Testa insert
response = supabase.table("users").insert({
    "user_id": user_id,
    "email": email,
    "first_name": first_name,
    "last_name": last_name,
    "phone": phone,
    "created_at": datetime.utcnow().isoformat()
}).execute()

print("Insert response:", response)
