from supabase_client import supabase
import uuid
from datetime import datetime, timezone

# Testdata – befintliga foreign keys i users och location
user_id = "5687c246-552d-4d9a-94da-2897c5730657"
location_id = "7105f685-89fd-4d5c-808f-cb38012911f6"

response = supabase.table("subscriptions").insert({
    "subscription_id": str(uuid.uuid4()),
    "user_id": user_id,
    "location_id": location_id,
    "period": "2024-Q4",
    "active": True,
    "created_at": datetime.now(timezone.utc).isoformat()
}).execute()

print("Insert response:", response)
