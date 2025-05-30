import os
from flask import Flask, request
from flask_cors import CORS

# Importera alla nödvändiga blueprints
from routes.member import member_blueprint
from routes.admin import admin_blueprint
from routes.traffic import traffic_blueprint
from routes.payments import payments_blueprint
from routes.notification_api import notification_api
from routes.trafikverket_proxy import trafikverket_proxy

app = Flask(__name__)

# CORS-inställningar (tillåt API-åtkomst från frontend)
CORS(app,
     supports_credentials=True,
     resources={r"/api/*": {"origins": "*"}},
     expose_headers=["Content-Type", "Authorization"],
     allow_headers=["Content-Type", "Authorization"],
     methods=["GET", "POST", "OPTIONS"]
)

# Logga inkommande requests
@app.before_request
def debug():
    print(f"➡️ {request.method} {request.path}")

# Registrera Blueprints
app.register_blueprint(member_blueprint)
app.register_blueprint(admin_blueprint)
app.register_blueprint(traffic_blueprint)
app.register_blueprint(payments_blueprint)
app.register_blueprint(notification_api)
app.register_blueprint(trafikverket_proxy)

@app.route("/api/<path:path>", methods=["OPTIONS"])
def options_handler(path):
    return '', 200

@app.route("/")
def healthcheck():
    return "✅ Backend is running", 200

# Starta appen (Render-vänlig inställning)
if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, host="0.0.0.0", port=port)
