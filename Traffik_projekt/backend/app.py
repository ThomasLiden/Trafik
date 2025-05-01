
from flask import Flask
from flask_cors import CORS
from routes.member import member_blueprint
#from routes.signup import signup_blueprint
#from routes.login import login_blueprint
#from routes.reset_password import reset_password_blueprint
#from routes.forgot_password import forgot_password_blueprint
#from routes.profile import edit_profile_blueprint

app = Flask(__name__)
CORS(app,supports_credentials=True,
     resources={ r"/api/*": { "origins": "*" } },
       expose_headers=["Content-Type", "Authorization"],
  allow_headers=["Content-Type", "Authorization"])

app.register_blueprint(member_blueprint)
#app.register_blueprint(signup_blueprint)
#app.register_blueprint(login_blueprint)
#app.register_blueprint(reset_password_blueprint)
#app.register_blueprint(forgot_password_blueprint)
#app.register_blueprint(edit_profile_blueprint)


if __name__ == '__main__':
    app.run(debug=True, host="127.0.0.1", port=5000)


