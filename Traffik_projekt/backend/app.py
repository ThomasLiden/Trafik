from flask import Flask
from flask_cors import CORS
# from routes.signup import signup_blueprint
from stripe_config import stripe_bp


app = Flask(__name__)
CORS(app)

# app.register_blueprint(signup_blueprint)
app.register_blueprint(stripe_bp, url_prefix='/api/stripe')

if __name__ == '__main__':
    app.run(debug=True)
