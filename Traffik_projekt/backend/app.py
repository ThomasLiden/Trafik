
from flask import Flask
from flask_cors import CORS
from routes.signup import signup_blueprint

app = Flask(__name__)
CORS(app)

app.register_blueprint(signup_blueprint)

if __name__ == '__main__':
    app.run(debug=True)
