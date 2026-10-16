from flask import Blueprint, jsonify, request

from database import get_connection

client_bp = Blueprint("client", __name__)


def _error(message, code=500):
    return jsonify({"status": "error", "message": message}), code


@client_bp.route("/api/clients", methods=["GET"])
def list_clients():
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT CLIENT_ID, CLIENT_NAME
            FROM YUGEM_CLIENTS
            ORDER BY CLIENT_NAME
        """)
        clients = [
            {"client_id": r[0], "client_name": r[1]}
            for r in cur.fetchall()
        ]
        return jsonify({"status": "success", "clients": clients})
    except Exception as e:
        return _error(str(e))
    finally:
        if conn:
            conn.close()


@client_bp.route("/api/clients/<int:client_id>", methods=["GET"])
def get_client(client_id):
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT CLIENT_ID, CLIENT_NAME, CONTACT_NO, EMAIL,
                   COMPANY_NAME, COMPANY_TYPE
            FROM YUGEM_CLIENTS
            WHERE CLIENT_ID = :id
        """, {"id": client_id})
        r = cur.fetchone()
        if not r:
            return _error("Client not found", 404)
        return jsonify({
            "status": "success",
            "client": {
                "client_id": r[0],
                "client_name": r[1],
                "contact_number": r[2],
                "email_address": r[3],
                "company_name": r[4],
                "company_type": r[5],
            },
        })
    except Exception as e:
        return _error(str(e))
    finally:
        if conn:
            conn.close()


@client_bp.route("/api/clients", methods=["POST"])
def create_client():
    data = request.get_json(silent=True) or {}
    name = (data.get("client_name") or "").strip()
    if not name:
        return _error("Client name is required", 400)

    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor()
        new_id = cur.var(int)
        cur.execute("""
            INSERT INTO YUGEM_CLIENTS
                (CLIENT_NAME, CONTACT_NO, EMAIL, COMPANY_NAME,
                 COMPANY_TYPE, ADDRESS, CREATED_BY)
            VALUES
                (:name, :contact, :email, :company,
                 :ctype, :address, :created_by)
            RETURNING CLIENT_ID INTO :new_id
        """, {
            "name": name,
            "contact": data.get("contact_number") or None,
            "email": data.get("email_address") or None,
            "company": data.get("company_name") or None,
            "ctype": data.get("company_type") or None,
            "address": data.get("address") or None,
            "created_by": data.get("created_by") or None,
            "new_id": new_id,
        })
        conn.commit()
        return jsonify({
            "status": "success",
            "message": "Client created",
            "client_id": new_id.getvalue()[0],
        }), 201
    except Exception as e:
        if conn:
            conn.rollback()
        return _error(str(e))
    finally:
        if conn:
            conn.close()