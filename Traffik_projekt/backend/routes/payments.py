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
            return_url=f"{FRONTEND_URL}/return?session_id={{CHECKOUT_SESSION_ID}}",
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
            logger.error("Ogiltigt eller saknat user_id i request")
            return jsonify({"error": "Ingen giltig user_id angiven"}), 400

        logger.info(f"Skapar checkout session för user_id: {user_id}")

        # Hämta reseller_id för användaren
        user_result = supabase.table("users").select("reseller_id").eq("user_id", user_id).limit(1).execute()

        if not user_result.data or len(user_result.data) == 0:
            logger.error(f"Inget användarobjekt hittades för user_id: {user_id}")
            return jsonify({"error": "User not found"}), 404

        reseller_id = user_result.data[0]["reseller_id"]

        #hämta aktivt stripe_price_id för denna reseller
        product_result = supabase.table("reseller_products")\
            .select("stripe_price_id")\
            .eq("reseller_id", reseller_id)\
            .eq("active", True)\
            .limit(1)\
            .execute()

        if not product_result.data or len(product_result.data) == 0:
            logger.error(f"Inga aktiva produkter hittades för reseller_id: {reseller_id}")
            return jsonify({"error": "No active product found for this reseller"}), 404

        stripe_price_id = product_result.data[0]["stripe_price_id"]


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

@payments_blueprint.route('/api/stripe-webhook', methods=['POST'])
def stripe_webhook():
    """
    Hanterar Stripe-webhooks för betalnings- och prenumerationshändelser.
    Uppdaterar Supabase med rätt status och ID:n.
    """
    payload = request.data
    sig_header = request.headers.get('Stripe-Signature')
    webhook_secret = os.getenv('STRIPE_WEBHOOK_SECRET')
    event = None
    try:
        # Verifiera att webhooken kommer från Stripe
        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )
        logger.info(f"✅ Stripe webhook event mottaget: {event['type']}")
    except ValueError as e:
        logger.error(f"Ogiltig payload: {e}")
        return 'Invalid payload', 400
    except stripe.error.SignatureVerificationError as e:
        logger.error(f"Ogiltig signatur: {e}")
        return 'Invalid signature', 400
    except Exception as e:
        logger.error(f"Annat fel vid webhook-verifiering: {e}")
        return 'Webhook error', 400

    # Hantera olika Stripe events
    try:
        if event['type'] == 'checkout.session.completed':
            session = event['data']['object']
            stripe_session_id = session['id']
            stripe_subscription_id = session.get('subscription')
            logger.info(f"🔄 Uppdaterar payment status till 'paid' för session: {stripe_session_id}")
            # Uppdatera betalning i Supabase till status 'paid'
            supabase.table('payments').update({
                'status': 'paid',
                'stripe_subscription_id': stripe_subscription_id
            }).eq('stripe_session_id', stripe_session_id).execute()

        elif event['type'] == 'customer.subscription.updated':
            subscription = event['data']['object']
            stripe_subscription_id = subscription['id']
            status = subscription['status']  # t.ex. 'active', 'past_due', 'canceled'
            logger.info(f"🔄 Uppdaterar subscription status till '{status}' för subscription: {stripe_subscription_id}")
            # Uppdatera subscription_id och status i Supabase
            supabase.table('payments').update({
                'status': status
            }).eq('stripe_subscription_id', stripe_subscription_id).execute()

        elif event['type'] == 'customer.subscription.deleted':
            subscription = event['data']['object']
            stripe_subscription_id = subscription['id']
            logger.info(f"🔄 Markerar subscription som 'cancelled' för subscription: {stripe_subscription_id}")
            # Markera som avslutad i Supabase
            supabase.table('payments').update({
                'status': 'cancelled'
            }).eq('stripe_subscription_id', stripe_subscription_id).execute()

        else:
            logger.info(f"ℹ️ Event-typen hanteras ej: {event['type']}")

        return '', 200
    except Exception as e:
        logger.error(f"Fel vid hantering av Stripe-event: {e}", exc_info=True)
        return 'Webhook handling error', 500
