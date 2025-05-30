import os
from flask import Flask
from flask_cors import CORS
from routes.member import member_blueprint
#from routes.signup import signup_blueprint
#from routes.login import login_blueprint
#from routes.reset_password import reset_password_blueprint
#from routes.forgot_password import forgot_password_blueprint
#from routes.profile import edit_profile_blueprint
from routes.notification_api import notification_api
from routes.trafikverket_proxy import trafikverket_proxy


app = Flask(__name__)
CORS(app,
     supports_credentials=True,
     resources={r"/*": {"origins": "*"}},
     allow_headers=["Content-Type"],
     methods=["GET", "POST", "OPTIONS"])

app.register_blueprint(member_blueprint)
#app.register_blueprint(signup_blueprint)
#app.register_blueprint(login_blueprint)
#app.register_blueprint(reset_password_blueprint)
#app.register_blueprint(forgot_password_blueprint)
#app.register_blueprint(edit_profile_blueprint)
app.register_blueprint(notification_api)
app.register_blueprint(trafikverket_proxy)

@app.before_request
def debug():
    from flask import request
    print(f"➡️ {request.method} {request.path}")


port = int(os.environ.get("PORT", 5000))
app.run(debug=True, host="0.0.0.0", port=port)
