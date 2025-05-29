from flask import Blueprint, request, jsonify
from flask_cors import cross_origin
import stripe
import os
from dotenv import load_dotenv
import logging
from flask_cors import CORS
from supabase import create_client, Client

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

load_dotenv()

# Supabase-klient initiering
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Skapa en ny blueprint för betalningar
payments_blueprint = Blueprint('payments', __name__)
CORS(payments_blueprint, resources={
    r"/api/*": {
        "origins": ["http://127.0.0.1:5500", "http://localhost:5500"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "Accept"]
    }
})

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
            return_url='http://localhost:5173/return?session_id={CHECKOUT_SESSION_ID}',
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
        response.headers.add('Access-Control-Allow-Origin', 'http://127.0.0.1:5500')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        return response
        
    try:
        # Verifiera att Stripe API-nyckel och pris-ID är konfigurerade
        if not stripe.api_key:
            logger.error("Stripe API key not configured")
            raise Exception("Stripe API key not configured")
        if not stripe_price_id:
            logger.error("Stripe price ID not configured")
            raise Exception("Stripe price ID not configured")
            
        # Hämta användar-ID från request
        data = request.get_json()
        logger.info(f"Received data: {data}")
        user_id = data.get('user_id')
        logger.info(f"Creating checkout session for user: {user_id}")
        
        # Skapa en ny Stripe checkout-session
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],  # endast kortbetalning
            line_items=[{
                'price': stripe_price_id,    # fördefinierat pris-ID från Stripe prudukt
                'quantity': 1,               # antal prenumerationer
            }],
            mode='subscription',             #  prenumeration läge
            ui_mode='embedded',              # inbäddad checkout i modalen
            return_url='http://localhost:5173/return?session_id={CHECKOUT_SESSION_ID}',  # URL för att hantera retur efter betalning
            client_reference_id=user_id,     # oppla sessionen till användaren
        )
        logger.info(f"Checkout session created successfully: {session.id}")

        # sparara betalningen i Supabase
        payment_data = {
            "stripe_session_id": session.id,
            "stripe_subscription_id": session.subscription,  
            "stripe_confirmation": session.client_secret,
            "user_id": user_id,
            "status": "pending"
        }
        try:
            supabase.table("payments").insert(payment_data).execute()
            logger.info(f"Payment data saved to Supabase for user: {user_id}")
        except Exception as supa_err:
            logger.error(f"Failed to save payment to Supabase: {supa_err}")

        # Returnera client secret som frontend behöver för att initiera checkout
        response = jsonify({
            'clientSecret': session.client_secret
        })
        response.headers.add('Access-Control-Allow-Origin', 'http://127.0.0.1:5500')
        return response
        
    except Exception as e:
        # returnera fel
        logger.error(f"Error in create_checkout_session: {str(e)}", exc_info=True)
        response = jsonify({'error': str(e)}), 500
        response[0].headers.add('Access-Control-Allow-Origin', 'http://127.0.0.1:5500')
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