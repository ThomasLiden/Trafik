# Flask (testa att skicka lösenordsåterställningslänk direkt)
from supabase_client import supabase

email = "katja.bjorlinger@gmail.com"
try:
    response = supabase.auth.reset_password_for_email(email)
    print("Lösenordsåterställningslänk skickad:", response)
except Exception as e:
    print("Fel vid utskick av återställningslänk:", e) 

""" import requests
import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_API_KEY = os.getenv("SUPABASE_KEY")

def send_reset_password_email(email):
    url = f"{SUPABASE_URL}/auth/v1/recover"
    headers = {
        "apikey": SUPABASE_API_KEY,
        "Authorization": f"Bearer {SUPABASE_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "email": email,
        "redirect_to": "http://127.0.0.1:5500/Traffik_projekt/frontend/src/index.html#/reset-password"
    }

    response = requests.post(url, headers=headers, json=payload)

    if response.status_code == 200:
        print("Lösenordsåterställningslänk skickad till:", email)
        print("Response Content:", response.content)
    else:
        print("Fel vid utskick av återställningslänk:", response.text)


# Testa funktionen
send_reset_password_email("katja.bjorlinger@gmail.com") """


