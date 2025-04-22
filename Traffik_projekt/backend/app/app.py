from flask import Flask, request, jsonify
from flask_cors import CORS
from models.supabase_client import supabase

app = Flask(__name__)
CORS(app)  # Tillåt frontend att anropa

@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    try:
        result = supabase.auth.sign_up({
            "email": email,
            "password": password
        })
        return jsonify({"message": "User created", "email": email}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400

if __name__ == "__main__":
    print("Flask körs på http://localhost:5000")
    app.run(debug=True)
