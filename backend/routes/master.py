from flask import Blueprint, jsonify, request

from database import get_connection

master_bp = Blueprint("master", __name__)


def _error(message, code=500):
    return jsonify({"status": "error", "message": message}), code


def _fetch(sql, params=None):
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(sql, params or {})
        return cur.fetchall()
    finally:
        if conn:
            conn.close()


@master_bp.route("/api/bdms", methods=["GET"])
def list_bdms():
    try:
        rows = _fetch("""
            SELECT BDM_ID, BDM_NAME
            FROM YUGEM_BDMS
            WHERE IS_ACTIVE = 'Y'
            ORDER BY BDM_NAME
        """)
        return jsonify({
            "status": "success",
            "bdms": [{"bdm_id": r[0], "bdm_name": r[1]} for r in rows],
        })
    except Exception as e:
        return _error(str(e))


@master_bp.route("/api/services", methods=["GET"])
def list_services():
    try:
        rows = _fetch("""
            SELECT SERVICE_ID, SERVICE_NAME
            FROM YUGEM_SERVICES
            WHERE IS_ACTIVE = 'Y'
            ORDER BY SERVICE_NAME
        """)
        return jsonify({
            "status": "success",
            "services": [
                {"service_id": r[0], "service_name": r[1]} for r in rows
            ],
        })
    except Exception as e:
        return _error(str(e))


@master_bp.route("/api/sub-services", methods=["GET"])
def list_sub_services():
    service_id = request.args.get("service_id", type=int)
    if not service_id:
        return _error("service_id is required", 400)
    try:
        rows = _fetch("""
            SELECT SUB_SERVICE_ID, SUB_SERVICE_NAME
            FROM YUGEM_SUB_SERVICES
            WHERE SERVICE_ID = :sid AND IS_ACTIVE = 'Y'
            ORDER BY SUB_SERVICE_NAME
        """, {"sid": service_id})
        return jsonify({
            "status": "success",
            "sub_services": [
                {"sub_service_id": r[0], "sub_service_name": r[1]}
                for r in rows
            ],
        })
    except Exception as e:
        return _error(str(e))