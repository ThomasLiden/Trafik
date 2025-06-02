from flask import Blueprint, request, jsonify
from flask_cors import cross_origin
import stripe
import os
from dotenv import load_dotenv
import logging
from flask_cors import CORS
""" from supabase import create_client, Client """
from models.supabase_client import supabase
# ändrat till centraliserad hämtningn
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")  # fallback för lokal dev

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

load_dotenv()

# Supabase-klient initiering
""" SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY) """
#ändrat till service role key

# Skapa en ny blueprint för betalningar
payments_blueprint = Blueprint('payments', __name__)
# CORS(payments_blueprint, resources={
#     r"/api/*": {
#         "origins": ["http://127.0.0.1:5500", "http://localhost:5500", FRONTEND_URL],
#         "methods": ["GET", "POST", "OPTIONS"],
#         "allow_headers": ["Content-Type", "Authorization", "Accept"]
#     }
# })

# Konfigurera Stripe secret key och price ID
stripe.api_key = os.getenv('STRIPE_SECRET_KEY')
stripe_price_id = os.getenv('STRIPE_PRICE_ID')
logger.info(f"Stripe API key loaded: {'Yes' if stripe.api_key else 'No'}")

@payments_blueprint.route('/create-checkout-session', methods=['POST'])
@cross_origin()
def create_checkout_session():
    try:
        if not stripe_price_id:
            raise Exception("Stripe price ID not configured")

        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price': stripe_price_id,
                'quantity': 1,
            }],
            mode='subscription',
            ui_mode='embedded',
            return_url='f"{FRONTEND_URL}/return?session_id={CHECKOUT_SESSION_ID}',
        )
        
        return jsonify({
            'clientSecret': session.client_secret
        })
    except Exception as e:
        return jsonify(error=str(e)), 400

@payments_blueprint.route('/api/create-checkout-session', methods=['POST', 'OPTIONS'])
def create_checkout_session_api():
    # Hantera CORS preflight request
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        response.headers.add('Access-Control-Allow-Origin', FRONTEND_URL)
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        return response

    try:
        # Hämta användar-ID från request
        data = request.get_json()
        logger.info(f"Received data: {data}")
        user_id = data.get('user_id')
        if not user_id or user_id == "None":
            logger.error("❌ Ogiltigt eller saknat user_id i request")
            return jsonify({"error": "Ingen giltig user_id angiven"}), 400

        logger.info(f"✅ Skapar checkout session för user_id: {user_id}")

        # Hämta reseller_id för användaren
        user_row = supabase.table("users").select("reseller_id").eq("user_id", user_id).single().execute()
        if not user_row.data:
            return jsonify({"error": "User not found"}), 400
        reseller_id = user_row.data["reseller_id"]

        # Hämta aktivt stripe_price_id för denna reseller
        product_data = supabase.table("reseller_products")\
            .select("stripe_price_id")\
            .eq("reseller_id", reseller_id)\
            .eq("active", True)\
            .single()\
            .execute()
        if not product_data.data:
            return jsonify({"error": "No active product found for this reseller"}), 400
        stripe_price_id = product_data.data['stripe_price_id']

        # Skapa checkout session med rätt pris
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price': stripe_price_id,
                'quantity': 1,
            }],
            mode='subscription',
            ui_mode='embedded',
            return_url=f'{FRONTEND_URL}/return?session_id={{CHECKOUT_SESSION_ID}}',
            client_reference_id=user_id,
            metadata={
                "reseller_id": reseller_id
            }
        )
        logger.info(f"Checkout session created successfully: {session.id}")

        # Spara betalningen i Supabase
        payment_data = {
            "stripe_session_id": session.id,
            "stripe_subscription_id": session.subscription,  
            "stripe_confirmation": session.client_secret,
            "user_id": user_id,
            "reseller_id": reseller_id,
            "status": "pending"
        }
        try:
            supabase.table("payments").insert(payment_data).execute()
            logger.info(f"Payment data saved to Supabase for user: {user_id}")
        except Exception as supa_err:
            logger.error(f"Failed to save payment to Supabase: {supa_err}")

        # Returnera client secret
        response = jsonify({
            'clientSecret': session.client_secret
        })
        response.headers.add('Access-Control-Allow-Origin', FRONTEND_URL)
        return response

    except Exception as e:
        logger.error(f"Error in create_checkout_session: {str(e)}", exc_info=True)
        response = jsonify({'error': str(e)}), 500
        response[0].headers.add('Access-Control-Allow-Origin', FRONTEND_URL)
        return response

#  kod för webhook

# from flask import request
# import stripe

# @payments_blueprint.route('/api/stripe-webhook', methods=['POST'])
# def stripe_webhook():
#     payload = request.data
#     sig_header = request.headers.get('Stripe-Signature')
#     webhook_secret = os.getenv('STRIPE_WEBHOOK_SECRET')
#     event = None
#     try:
#         event = stripe.Webhook.construct_event(
#             payload, sig_header, webhook_secret
#         )
#     except ValueError as e:
#         # Invalid payload
#         return 'Invalid payload', 400
#     except stripe.error.SignatureVerificationError as e:
#         # Invalid signature
#         return 'Invalid signature', 400
#
#     # Hantera olika Stripe events
#     if event['type'] == 'checkout.session.completed':
#         session = event['data']['object']
#         # uppdatera betalning i Supabase till status 'paid'
#         supabase.table('payments').update({'status': 'paid'}).eq('stripe_session_id', session['id']).execute()
#
#     elif event['type'] == 'customer.subscription.updated':
#         subscription = event['data']['object']
#         # uppdatera subscription_id och status i Supabase
#         supabase.table('payments').update({
#             'stripe_subscription_id': subscription['id'],
#             'status': subscription['status']
#         }).eq('stripe_subscription_id', subscription['id']).execute()
#
#     elif event['type'] == 'customer.subscription.deleted':
#         subscription = event['data']['object']
#         # markera som avslutad i Supabase
#         supabase.table('payments').update({
#             'status': 'cancelled'
#         }).eq('stripe_subscription_id', subscription['id']).execute()
#
#
#     return '', 200 