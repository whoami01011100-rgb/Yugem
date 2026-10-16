import os

from flask import Flask, jsonify, request, send_from_directory
from dotenv import load_dotenv

from database import test_connection, get_connection
from routes.auth import auth_bp, login as auth_login

# =========================================================
# LOAD ENVIRONMENT
# =========================================================

load_dotenv()


# =========================================================
# FRONTEND PATH 
# =========================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

FRONTEND_DIR = os.path.abspath(
    os.path.join(BASE_DIR, "..", "frontend")
)


# =========================================================
# FLASK APP
# =========================================================

app = Flask(
    __name__,
    static_folder=FRONTEND_DIR,
    static_url_path=""
)
# =========================================================
# FLASK SESSION SECRET KEY
# =========================================================

app.config["SECRET_KEY"] = os.getenv(
    "SECRET_KEY",
    "95d06d75de130504ac85a69d012ffc02220382d244862025a11eac7c85e8a8f0"
)

print("========================================")
print("YUGEM FLASK APP STARTED")
print("SECRET KEY LOADED:", bool(app.config.get("SECRET_KEY")))
print("========================================")
from routes.client import client_bp
from routes.master import master_bp
from routes.payment import payment_bp
from routes.report import report_bp
from routes.auth import auth_bp, login as auth_login
# from routes.auth import auth_bp

app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024  # 20 MB

app.register_blueprint(client_bp)
app.register_blueprint(master_bp)
app.register_blueprint(payment_bp)
app.register_blueprint(report_bp)
app.register_blueprint(auth_bp)

# =========================================================
# FRONTEND - LOGIN PAGE
# =========================================================

@app.route("/", methods=["GET"])
def home():

    return send_from_directory(
        FRONTEND_DIR,
        "login.html"
    )


# =========================================================
# FRONTEND - DASHBOARD
# =========================================================

@app.route("/index.html", methods=["GET"])
def dashboard():

    return send_from_directory(
        FRONTEND_DIR,
        "index.html"
    )
    # =========================================================
# FRONTEND - PAYMENT ENTRIES
# =========================================================
@app.route("/payment-entries.html", methods=["GET"])
def payment_entries():

    return send_from_directory(
        FRONTEND_DIR,
        "payment-entries.html"
    )
# =========================================================
# FRONTEND - REPORTS
# =========================================================

@app.route("/report.html", methods=["GET"])
def reports():

    return send_from_directory(
        FRONTEND_DIR,
        "report.html"
    )

# =========================================================
# HEALTH CHECK
# =========================================================

@app.route("/api/health", methods=["GET"])
def health():

    return jsonify({
        "status": "success",
        "message": "Yugem API is running"
    })


# =========================================================
# DATABASE TEST
# =========================================================

@app.route("/api/db-test", methods=["GET"])
def db_test():

    try:

        db_info = test_connection()

        return jsonify({
            "status": "success",
            "message": "Oracle connection successful",
            "database": db_info["database"],
            "service": db_info["service"]
        })

    except Exception as e:

        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


# =========================================================
# LOGIN
# =========================================================

# @app.route("/api/login", methods=["POST"])
# def login():

#     data = request.get_json(silent=True)

#     if not data:

#         return jsonify({
#             "status": "error",
#             "message": "Request body is required"
#         }), 400


#     employee_id = data.get("employee_id")
#     password = data.get("password")


#     if not employee_id or not password:

#         return jsonify({
#             "status": "error",
#             "message": "Employee ID and password are required"
#         }), 400


#     connection = None

#     try:

#         connection = get_connection()
#         cursor = connection.cursor()


#         cursor.execute("""
#             SELECT
#                 USER_ID,
#                 EMPLOYEE_ID,
#                 LOGIN_ID,
#                 FULL_NAME,
#                 ROLE_NAME,
#                 IS_ACTIVE
#             FROM YUGEM_USERS
#             WHERE EMPLOYEE_ID = :employee_id
#               AND PASSWORD_HASH = :password
#               AND IS_ACTIVE = 'Y'
#         """, {
#             "employee_id": employee_id,
#             "password": password
#         })


#         user = cursor.fetchone()


#         if not user:

#             return jsonify({
#                 "status": "error",
#                 "message": "Invalid Employee ID or password"
#             }), 401


#         return jsonify({

#             "status": "success",

#             "message": "Login successful",

#             "user": {

#                 "user_id": user[0],

#                 "employee_id": user[1],

#                 "login_id": user[2],

#                 "full_name": user[3],

#                 "role": user[4],

#                 "is_active": user[5]

#             }

#         })


#     except Exception as e:

#         return jsonify({

#             "status": "error",

#             "message": str(e)

#         }), 500


#     finally:

#         if connection:

#             connection.close()
@app.route("/api/login", methods=["POST"])
def login():
    return auth_login()
            
# =========================================================
# DASHBOARD
# =========================================================

@app.route("/api/dashboard", methods=["GET"])
def dashboard_data():

    connection = None

    try:

        connection = get_connection()
        cursor = connection.cursor()

        # ---------------------------------------------
        # TOTAL PAYMENTS
        # ---------------------------------------------

        cursor.execute("""
            SELECT COUNT(*)
            FROM YUGEM_PAYMENTS
        """)

        total_payments = cursor.fetchone()[0]


        # ---------------------------------------------
        # TOTAL RECEIVED
        # ---------------------------------------------

        cursor.execute("""
            SELECT NVL(SUM(RECEIVED_AMOUNT), 0)
            FROM YUGEM_PAYMENTS
        """)

        total_received = cursor.fetchone()[0]


        # ---------------------------------------------
        # TOTAL BALANCE
        # ---------------------------------------------

        cursor.execute("""
            SELECT NVL(SUM(BALANCE_AMOUNT), 0)
            FROM YUGEM_PAYMENTS
        """)

        total_balance = cursor.fetchone()[0]


        # ---------------------------------------------
        # TOTAL CLIENTS
        # ---------------------------------------------

        cursor.execute("""
            SELECT COUNT(*)
            FROM YUGEM_CLIENTS
        """)

        total_clients = cursor.fetchone()[0]


        # ---------------------------------------------
        # RECENT PAYMENTS
        # Oracle 11g compatible
        # ---------------------------------------------

        cursor.execute("""
            SELECT
                PAYMENT_ID,
                PAYMENT_DATE,
                CLIENT_NAME,
                TOTAL_AMOUNT,
                RECEIVED_AMOUNT,
                BALANCE_AMOUNT,
                PAYMENT_STATUS
            FROM (
                SELECT
                    PAYMENT_ID,
                    PAYMENT_DATE,
                    CLIENT_NAME,
                    TOTAL_AMOUNT,
                    RECEIVED_AMOUNT,
                    BALANCE_AMOUNT,
                    PAYMENT_STATUS
                FROM YUGEM_PAYMENTS
                ORDER BY PAYMENT_ID DESC
            )
            WHERE ROWNUM <= 10
        """)

        rows = cursor.fetchall()


        # ---------------------------------------------
        # FORMAT RECENT PAYMENTS
        # ---------------------------------------------

        recent_payments = []

        for row in rows:

            recent_payments.append({
                "payment_id": row[0],

                "payment_date": (
                    row[1].strftime("%Y-%m-%d")
                    if row[1]
                    else None
                ),

                "client_name": row[2],

                "total_amount": float(row[3] or 0),

                "received_amount": float(row[4] or 0),

                "balance_amount": float(row[5] or 0),

                "payment_status": row[6]
            })


        # ---------------------------------------------
        # RESPONSE
        # ---------------------------------------------

        return jsonify({

            "status": "success",

            "summary": {

                "total_payments": total_payments,

                "total_received": float(
                    total_received or 0
                ),

                "total_balance": float(
                    total_balance or 0
                ),

                "total_clients": total_clients
            },

            "recent_payments": recent_payments

        })


    except Exception as e:

        return jsonify({

            "status": "error",

            "message": str(e)

        }), 500


    finally:

        if connection:
            connection.close()

# =========================================================
# START SERVER
# =========================================================

if __name__ == "__main__":

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True,
        threaded=True
    )
