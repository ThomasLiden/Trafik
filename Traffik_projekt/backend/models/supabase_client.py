""" 
from supabase import create_client
import os
from dotenv import load_dotenv

load_dotenv()

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")
supabase = create_client(url, key)
 """

# supabase_client.py
from supabase import create_client, Client
import os
from dotenv import load_dotenv

# Ladda miljövariabler
load_dotenv()

# Hämta URL och API-nyckel från miljövariabler
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
#ÄNDRAT TILL SERVICE ROLE

#print för felsökning
print("Laddad SUPABASE_URL =", repr(url))
print("Laddad SUPABASE_KEY =", repr(key))

# Kontrollera att miljövariablerna är korrekt definierade
if not url or not key:
    raise ValueError("Supabase URL eller API-nyckel saknas. Kontrollera din .env-fil.")

# Skapa Supabase-klienten
try:
    supabase: Client = create_client(url, key)
    print(" Supabase-klient skapad.")
except Exception as e:
    print("Fel vid skapande av Supabase-klient:", str(e))