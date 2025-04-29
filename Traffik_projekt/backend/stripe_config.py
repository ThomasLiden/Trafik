import stripe
from flask import Blueprint, jsonify, request
from flask_cors import CORS
import os
from dotenv import load_dotenv

# Laddar miljövariabler från .env filen
load_dotenv()

# Skapar en Blueprint för att organisera Stripe-relaterade routes
stripe_bp = Blueprint('stripe', __name__)

# Hämtar Stripe API-nyckeln från .env och konfigurerar Stripe
stripe.api_key = os.getenv('STRIPE_SECRET_KEY')

# Endpoint för engångsbetalning
@stripe_bp.route('/create-checkout-session', methods=['POST'])
def create_checkout_session():
    try:
        # Skapar en Stripe Checkout Session för engångsbetalning
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],  # Accepterar kortbetalning
            line_items=[
                {
                    'price_data': {
                        'currency': 'sek',
                        'product_data': {
                            'name': 'Trafiktjänst Premium',
                            'description': 'Tillgång till alla premiumfunktioner',
                        },
                        'unit_amount': 9900,  # 99 SEK (i öre)
                    },
                    'quantity': 1,
                },
            ],
            mode='payment',  # Engångsbetalning
            success_url='http://localhost:5173/success',  # URL vid lyckad betalning
            cancel_url='http://localhost:5173/cancel',    # URL vid avbruten betalning
        )
        # Returnerar URL:en till Stripe's betalningssida
        return jsonify({'url': checkout_session.url})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Endpoint för prenumeration
@stripe_bp.route('/create-subscription', methods=['POST'])
def create_subscription():
    try:
        # Skapar en Stripe Checkout Session för prenumeration
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[
                {
                    'price': os.getenv('STRIPE_PRICE_ID'),  # Prenumerationspris-ID från Stripe
                    'quantity': 1,
                },
            ],
            mode='subscription',  # Prenumerationsläge
            success_url='http://localhost:5173/success',
            cancel_url='http://localhost:5173/cancel',
        )
        return jsonify({'url': checkout_session.url})
    except Exception as e:
        return jsonify({'error': str(e)}), 500