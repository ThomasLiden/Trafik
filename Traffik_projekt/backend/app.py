
from flask import Flask
from flask_cors import CORS
from routes.member import member_blueprint

app = Flask(__name__)
CORS(app,supports_credentials=True,
     resources={ r"/api/*": { "origins": "*" } },
       expose_headers=["Content-Type", "Authorization"],
  allow_headers=["Content-Type", "Authorization"])

app.register_blueprint(member_blueprint)

if __name__ == '__main__':
    app.run(debug=True, host="127.0.0.1", port=5000)


