from flask import Blueprint, request, jsonify
from flask_cors import cross_origin
import stripe
import os
from dotenv import load_dotenv

load_dotenv()

# Skapa en ny blueprint för betalningar
payments_blueprint = Blueprint('payments', __name__)

# Konfigurera Stripe med din hemliga nyckel
stripe.api_key = os.getenv('STRIPE_SECRET_KEY')

@payments_blueprint.route('/create-checkout-session', methods=['POST'])
@cross_origin()
def create_checkout_session():
    try:
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'sek',
                    'product_data': {
                        'name': 'Trafikinfo Prenumeration',
                        'description': 'Månatlig prenumeration på trafikinformation',
                    },
                    'unit_amount': 9900,  # 99 kr i öre
                    'recurring': {
                        'interval': 'month',
                    },
                },
                'quantity': 1,
            }],
            mode='subscription',
            ui_mode='embedded',
            return_url='http://localhost:8080/return?session_id={CHECKOUT_SESSION_ID}',
        )
        
        return jsonify({
            'clientSecret': session.client_secret
        })
    except Exception as e:
        return jsonify(error=str(e)), 400 