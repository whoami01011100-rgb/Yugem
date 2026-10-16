import os
import secrets

from flask import Blueprint, request, jsonify, session
from database import get_connection


auth_bp = Blueprint("auth", __name__)

# =========================================================
# TAB-SPECIFIC AUTH TOKENS
# =========================================================

AUTH_TOKENS = {}


def _create_auth_token(user_id):
    """
    Create a token that belongs to one browser tab.
    """
    token = secrets.token_urlsafe(32)
    AUTH_TOKENS[token] = user_id
    return token


def _get_authenticated_user_id():
    """
    Get USER_ID from Authorization Bearer token.
    """
    auth_header = (
        request.headers.get("Authorization") or ""
    ).strip()

    if not auth_header.startswith("Bearer "):
        return None

    token = auth_header[7:].strip()

    if not token:
        return None

    return AUTH_TOKENS.get(token)


# =========================================================
# EXISTING ENV HELPERS
# =========================================================

def _get_env_list(key):
    value = os.getenv(key, "")
    return [
        item.strip().upper()
        for item in value.split(",")
        if item.strip()
    ]


def _get_user_role(employee_id):
    employee_id = (employee_id or "").strip().upper()

    admin_users = _get_env_list("ADMIN_EMPLOYEE_IDS")
    employee_users = _get_env_list("EMPLOYEE_EMPLOYEE_IDS")

    if employee_id in admin_users:
        return "ADMIN"

    if employee_id in employee_users:
        return "EMPLOYEE"

    return None


def _get_allowed_pages(role):
    if role == "ADMIN":
        return _get_env_list("ADMIN_PAGES")

    if role == "EMPLOYEE":
        return _get_env_list("EMPLOYEE_PAGES")

    return []


# =========================================================
# ADMIN ACCESS HELPERS
# =========================================================

def _get_access_role(employee_id):
    """
    Determine access role from database.
    """
    employee_id = (employee_id or "").strip().upper()

    conn = None
    cur = None

    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT UA.ACCESS_ROLE
            FROM YUGEM_USER_ACCESS UA
            INNER JOIN YUGEM_USERS U
                ON U.USER_ID = UA.USER_ID
            WHERE UPPER(U.EMPLOYEE_ID) = UPPER(:employee_id)
              AND UA.IS_ACTIVE = 'Y'
        """, {
            "employee_id": employee_id
        })

        row = cur.fetchone()

        if not row:
            return None

        return row[0]

    finally:
        if cur:
            cur.close()

        if conn:
            conn.close()


def _get_role_allowed_pages(role):
    """
    Existing fallback helper.
    """
    if role == "ADMIN":
        return [
            page.strip()
            for page in os.getenv(
                "ADMIN_PAGES",
                ""
            ).split(",")
            if page.strip()
        ]

    if role == "EMPLOYEE":
        return [
            page.strip()
            for page in os.getenv(
                "EMPLOYEE_PAGES",
                ""
            ).split(",")
            if page.strip()
        ]

    return []


# =========================================================
# DATABASE ACCESS HELPERS & MAPPING
# =========================================================

VALID_PAGES = [
    "index.html",
    "payment-entry.html",
    "payment-entries.html",
    "report.html",
    "admin-access.html"
]

# Allows outer UI labels and filenames to correctly map to DB filenames
PAGE_NAME_MAP = {
    "dashboard": "index.html",
    "index.html": "index.html",
    "new payment": "payment-entry.html",
    "payment-entry.html": "payment-entry.html",
    "payment entries": "payment-entries.html",
    "payment-entries.html": "payment-entries.html",
    "reports": "report.html",
    "report.html": "report.html",
    "user access": "admin-access.html",
    "admin-access.html": "admin-access.html"
}


def _normalize_page_name(page_str):
    page_clean = str(page_str or "").strip().lower()
    return PAGE_NAME_MAP.get(page_clean)


def _get_db_user_access(user_id):
    """
    Get access role, active status and allowed pages
    directly from Oracle DB.
    """
    conn = None
    cur = None

    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT
                ACCESS_ROLE,
                IS_ACTIVE
            FROM YUGEM_USER_ACCESS
            WHERE USER_ID = :user_id
        """, {
            "user_id": user_id
        })

        access_row = cur.fetchone()

        if not access_row:
            return None, "N", []

        access_role = access_row[0]
        access_active = access_row[1]

        cur.execute("""
            SELECT PAGE_NAME
            FROM YUGEM_USER_PAGE_ACCESS
            WHERE USER_ID = :user_id
              AND IS_ALLOWED = 'Y'
            ORDER BY PAGE_NAME
        """, {
            "user_id": user_id
        })

        page_rows = cur.fetchall()

        allowed_pages = [
            row[0]
            for row in page_rows
            if row[0]
        ]

        return access_role, access_active, allowed_pages

    finally:
        if cur:
            cur.close()

        if conn:
            conn.close()


# =========================================================
# CURRENT USER ACCESS
# =========================================================

@auth_bp.route("/api/my-access", methods=["GET"])
def my_access():
    try:
        logged_user_id = _get_authenticated_user_id()

        if not logged_user_id:
            return jsonify({
                "status": "error",
                "message": "Login required."
            }), 401

        logged_role, logged_active, allowed_pages = _get_db_user_access(
            logged_user_id
        )

        if logged_active != "Y":
            return jsonify({
                "status": "error",
                "message": "Your account is inactive."
            }), 403

        if not logged_role or logged_role == "NO_ACCESS":
            return jsonify({
                "status": "error",
                "message": "Your account currently has no access."
            }), 403

        return jsonify({
            "status": "success",
            "user_id": logged_user_id,
            "role": logged_role,
            "access_active": logged_active,
            "allowed_pages": allowed_pages
        }), 200

    except Exception as e:
        print("CURRENT USER ACCESS ERROR:", e)

        return jsonify({
            "status": "error",
            "message": "Unable to load current user access."
        }), 500


# =========================================================
# LOGIN
# =========================================================

@auth_bp.route("/api/login", methods=["POST"])
def login():
    try:
        data = request.get_json(silent=True) or {}

        login_id = (data.get("login_id") or "").strip()
        password = data.get("password") or ""

        if not login_id:
            return jsonify({
                "status": "error",
                "message": "Login ID is required."
            }), 400

        if not password:
            return jsonify({
                "status": "error",
                "message": "Password is required."
            }), 400

        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT
                USER_ID,
                FULL_NAME,
                EMPLOYEE_ID,
                LOGIN_ID
            FROM YUGEM_USERS
            WHERE UPPER(LOGIN_ID) = UPPER(:login_id)
              AND PASSWORD_HASH = :password
              AND IS_ACTIVE = 'Y'
        """, {
            "login_id": login_id,
            "password": password
        })

        user = cur.fetchone()

        cur.close()
        conn.close()

        if not user:
            return jsonify({
                "status": "error",
                "message": "Invalid Login ID or Password."
            }), 401

        user_id = user[0]
        full_name = user[1]
        logged_employee_id = user[2]
        logged_login_id = user[3]

        role, access_active, allowed_pages = _get_db_user_access(user_id)

        if not role:
            return jsonify({
                "status": "error",
                "message": "This Login ID is valid but has no access role configured."
            }), 403

        if access_active != "Y":
            return jsonify({
                "status": "error",
                "message": "This account is inactive."
            }), 403

        if role == "NO_ACCESS":
            return jsonify({
                "status": "error",
                "message": "This account currently has no access."
            }), 403

        if not allowed_pages:
            return jsonify({
                "status": "error",
                "message": "No pages are configured for this account."
            }), 403

        session["user_id"] = user_id
        session["employee_id"] = logged_employee_id
        session["login_id"] = logged_login_id
        session["full_name"] = full_name
        session["role"] = role

        auth_token = _create_auth_token(user_id)

        return jsonify({
            "status": "success",
            "message": "Login successful.",
            "user_id": user_id,
            "full_name": full_name,
            "employee_id": logged_employee_id,
            "login_id": logged_login_id,
            "role": role,
            "allowed_pages": allowed_pages,
            "auth_token": auth_token
        }), 200

    except Exception as e:
        print("LOGIN ERROR:", e)
        return jsonify({
            "status": "error",
            "message": "Login failed."
        }), 500


# =========================================================
# ADMIN - USER ACCESS
# =========================================================

@auth_bp.route("/api/admin/user-access", methods=["GET"])
def admin_user_access():
    conn = None
    cur = None

    try:
        logged_user_id = _get_authenticated_user_id()

        if not logged_user_id:
            return jsonify({
                "status": "error",
                "message": "Admin login required."
            }), 401

        logged_role, logged_active, logged_pages = _get_db_user_access(logged_user_id)

        if logged_active != "Y":
            return jsonify({
                "status": "error",
                "message": "Your account is inactive."
            }), 403

        if logged_role != "ADMIN":
            return jsonify({
                "status": "error",
                "message": "Admin access required."
            }), 403

        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT
                USER_ID,
                EMPLOYEE_ID,
                LOGIN_ID,
                FULL_NAME,
                ROLE_NAME,
                CONTACT_NO,
                IS_ACTIVE
            FROM YUGEM_USERS
            ORDER BY USER_ID
        """)

        rows = cur.fetchall()
        users = []

        for row in rows:
            user_id = row[0]
            employee_id = row[1] or ""
            login_id = row[2] or ""
            full_name = row[3] or ""
            db_role = row[4] or ""
            contact_no = row[5] or ""
            db_user_active = row[6] or "N"

            cur.execute("""
                SELECT
                    ACCESS_ROLE,
                    IS_ACTIVE
                FROM YUGEM_USER_ACCESS
                WHERE USER_ID = :user_id
            """, {
                "user_id": user_id
            })

            access_row = cur.fetchone()

            if access_row:
                access_role = access_row[0]
                access_active = access_row[1]
            else:
                access_role = "NO_ACCESS"
                access_active = "N"

            cur.execute("""
                SELECT PAGE_NAME
                FROM YUGEM_USER_PAGE_ACCESS
                WHERE USER_ID = :user_id
                  AND IS_ALLOWED = 'Y'
                ORDER BY PAGE_NAME
            """, {
                "user_id": user_id
            })

            page_rows = cur.fetchall()

            allowed_pages = [
                page_row[0]
                for page_row in page_rows
                if page_row[0]
            ]

            has_admin_access = (
                access_role == "ADMIN"
                and access_active == "Y"
            )

            users.append({
                "user_id": user_id,
                "employee_id": employee_id,
                "login_id": login_id,
                "full_name": full_name,
                "db_role": db_role,
                "contact_no": contact_no,
                "is_active": db_user_active,
                "access_role": access_role,
                "access_active": access_active,
                "has_admin_access": has_admin_access,
                "allowed_pages": allowed_pages
            })

        return jsonify({
            "status": "success",
            "users": users
        }), 200

    except Exception as e:
        print("ADMIN USER ACCESS ERROR:", e)

        return jsonify({
            "status": "error",
            "message": "Unable to load user access."
        }), 500

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


# =========================================================
# ADMIN - UPDATE USER ACCESS
# =========================================================

@auth_bp.route("/api/admin/user-access/<int:user_id>", methods=["PUT"])
def update_user_access(user_id):
    conn = None
    cur = None

    try:
        logged_user_id = _get_authenticated_user_id()

        if not logged_user_id:
            return jsonify({
                "status": "error",
                "message": "Admin login required."
            }), 401

        logged_role, logged_active, logged_pages = _get_db_user_access(logged_user_id)

        if logged_active != "Y":
            return jsonify({
                "status": "error",
                "message": "Your account is inactive."
            }), 403

        if logged_role != "ADMIN":
            return jsonify({
                "status": "error",
                "message": "Admin access required."
            }), 403

        data = request.get_json(silent=True) or {}

        access_role = (data.get("access_role") or "EMPLOYEE").strip().upper()
        is_active = (data.get("is_active") or "Y").strip().upper()
        allowed_pages = data.get("allowed_pages", [])

        if access_role not in ["ADMIN", "EMPLOYEE", "NO_ACCESS"]:
            access_role = "EMPLOYEE"

        if is_active not in ["Y", "N"]:
            is_active = "Y"

        cleaned_pages = []
        if isinstance(allowed_pages, list):
            for page in allowed_pages:
                norm_page = _normalize_page_name(page)
                if norm_page and norm_page not in cleaned_pages:
                    cleaned_pages.append(norm_page)

        if access_role == "NO_ACCESS":
            cleaned_pages = []

        conn = get_connection()
        cur = conn.cursor()

        # Fixed table name typo YUGEMS_USERS -> YUGEM_USERS
        cur.execute("""
            SELECT USER_ID, EMPLOYEE_ID
            FROM YUGEM_USERS
            WHERE USER_ID = :user_id
        """, {
            "user_id": user_id
        })

        target_user = cur.fetchone()

        if not target_user:
            return jsonify({
                "status": "error",
                "message": "User not found."
            }), 404

        if access_role != "ADMIN":
            cur.execute("""
                SELECT COUNT(*)
                FROM YUGEM_USER_ACCESS
                WHERE ACCESS_ROLE = 'ADMIN'
                  AND IS_ACTIVE = 'Y'
            """)

            admin_count = cur.fetchone()[0]

            cur.execute("""
                SELECT ACCESS_ROLE, IS_ACTIVE
                FROM YUGEM_USER_ACCESS
                WHERE USER_ID = :user_id
            """, {
                "user_id": user_id
            })

            current_target_access = cur.fetchone()

            currently_admin = (
                current_target_access is not None
                and current_target_access[0] == "ADMIN"
                and current_target_access[1] == "Y"
            )

            if currently_admin and admin_count <= 1:
                return jsonify({
                    "status": "error",
                    "message": "At least one active Admin is required."
                }), 400

        cur.execute("""
            SELECT USER_ID
            FROM YUGEM_USER_ACCESS
            WHERE USER_ID = :user_id
        """, {
            "user_id": user_id
        })

        access_exists = cur.fetchone()

        if access_exists:
            cur.execute("""
                UPDATE YUGEM_USER_ACCESS
                SET
                    ACCESS_ROLE = :access_role,
                    IS_ACTIVE = :is_active,
                    UPDATED_AT = SYSTIMESTAMP
                WHERE USER_ID = :user_id
            """, {
                "access_role": access_role,
                "is_active": is_active,
                "user_id": user_id
            })
        else:
            cur.execute("""
                INSERT INTO YUGEM_USER_ACCESS (
                    USER_ID,
                    ACCESS_ROLE,
                    IS_ACTIVE,
                    CREATED_AT,
                    UPDATED_AT
                )
                VALUES (
                    :user_id,
                    :access_role,
                    :is_active,
                    SYSTIMESTAMP,
                    SYSTIMESTAMP
                )
            """, {
                "user_id": user_id,
                "access_role": access_role,
                "is_active": is_active
            })

        # Synchronize primary YUGEM_USERS table IS_ACTIVE status
        cur.execute("""
            UPDATE YUGEM_USERS
            SET IS_ACTIVE = :is_active,
                UPDATED_AT = SYSTIMESTAMP
            WHERE USER_ID = :user_id
        """, {
            "is_active": is_active,
            "user_id": user_id
        })

        cur.execute("""
            DELETE FROM YUGEM_USER_PAGE_ACCESS
            WHERE USER_ID = :user_id
        """, {
            "user_id": user_id
        })

        for page in cleaned_pages:
            cur.execute("""
                INSERT INTO YUGEM_USER_PAGE_ACCESS (
                    USER_ID,
                    PAGE_NAME,
                    IS_ALLOWED
                )
                VALUES (
                    :user_id,
                    :page_name,
                    'Y'
                )
            """, {
                "user_id": user_id,
                "page_name": page
            })

        conn.commit()

        return jsonify({
            "status": "success",
            "message": "User access updated successfully.",
            "user_id": user_id,
            "access_role": access_role,
            "is_active": is_active,
            "allowed_pages": cleaned_pages
        }), 200

    except Exception as e:
        if conn:
            conn.rollback()

        print("UPDATE USER ACCESS ERROR:", e)

        return jsonify({
            "status": "error",
            "message": "Unable to update user access."
        }), 500

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


# =========================================================
# ADMIN - CREATE USER
# =========================================================

@auth_bp.route("/api/admin/users", methods=["POST"])
def create_user():
    conn = None
    cur = None

    try:
        logged_user_id = _get_authenticated_user_id()

        if not logged_user_id:
            return jsonify({
                "status": "error",
                "message": "Admin login required."
            }), 401

        logged_role, logged_active, logged_pages = _get_db_user_access(logged_user_id)

        if logged_active != "Y":
            return jsonify({
                "status": "error",
                "message": "Your account is inactive."
            }), 403

        if logged_role != "ADMIN":
            return jsonify({
                "status": "error",
                "message": "Admin access required."
            }), 403

        data = request.get_json(silent=True) or {}

        employee_id = (data.get("employee_id") or "").strip()
        login_id = (data.get("login_id") or "").strip()
        password = data.get("password") or ""
        full_name = (data.get("full_name") or "").strip()
        contact_no = (data.get("contact_no") or "").strip()
        db_role = (data.get("db_role") or "BDE").strip()
        access_role = (data.get("access_role") or "NO_ACCESS").strip().upper()
        is_active = (data.get("is_active") or "Y").strip().upper()
        allowed_pages = data.get("allowed_pages", [])

        if not employee_id:
            return jsonify({
                "status": "error",
                "message": "Employee ID is required."
            }), 400

        if not full_name:
            return jsonify({
                "status": "error",
                "message": "Full Name is required."
            }), 400

        if not login_id:
            return jsonify({
                "status": "error",
                "message": "Login ID is required."
            }), 400

        if not password:
            return jsonify({
                "status": "error",
                "message": "Password is required."
            }), 400

        if not db_role:
            return jsonify({
                "status": "error",
                "message": "DB Role is required."
            }), 400

        if access_role not in ["ADMIN", "EMPLOYEE", "NO_ACCESS"]:
            return jsonify({
                "status": "error",
                "message": "Invalid access role."
            }), 400

        if is_active not in ["Y", "N"]:
            return jsonify({
                "status": "error",
                "message": "Invalid active status."
            }), 400

        cleaned_pages = []
        if isinstance(allowed_pages, list):
            for page in allowed_pages:
                norm_page = _normalize_page_name(page)
                if norm_page and norm_page not in cleaned_pages:
                    cleaned_pages.append(norm_page)

        if access_role == "NO_ACCESS":
            cleaned_pages = []

        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT USER_ID
            FROM YUGEM_USERS
            WHERE UPPER(EMPLOYEE_ID) = UPPER(:employee_id)
        """, {
            "employee_id": employee_id
        })

        if cur.fetchone():
            return jsonify({
                "status": "error",
                "message": "Employee ID already exists."
            }), 409

        cur.execute("""
            SELECT USER_ID
            FROM YUGEM_USERS
            WHERE UPPER(LOGIN_ID) = UPPER(:login_id)
        """, {
            "login_id": login_id
        })

        if cur.fetchone():
            return jsonify({
                "status": "error",
                "message": "Login ID already exists."
            }), 409

        cur.execute("""
            SELECT NVL(MAX(USER_ID), 0) + 1
            FROM YUGEM_USERS
        """)

        user_id = cur.fetchone()[0]

        cur.execute("""
            INSERT INTO YUGEM_USERS (
                USER_ID,
                EMPLOYEE_ID,
                LOGIN_ID,
                PASSWORD_HASH,
                FULL_NAME,
                ROLE_NAME,
                CONTACT_NO,
                IS_ACTIVE,
                CREATED_AT,
                UPDATED_AT
            )
            VALUES (
                :user_id,
                :employee_id,
                :login_id,
                :password,
                :full_name,
                :db_role,
                :contact_no,
                :is_active,
                SYSTIMESTAMP,
                SYSTIMESTAMP
            )
        """, {
            "user_id": user_id,
            "employee_id": employee_id,
            "login_id": login_id,
            "password": password,
            "full_name": full_name,
            "db_role": db_role,
            "contact_no": contact_no or None,
            "is_active": is_active
        })

        cur.execute("""
            INSERT INTO YUGEM_USER_ACCESS (
                USER_ID,
                ACCESS_ROLE,
                IS_ACTIVE,
                CREATED_AT,
                UPDATED_AT
            )
            VALUES (
                :user_id,
                :access_role,
                :is_active,
                SYSTIMESTAMP,
                SYSTIMESTAMP
            )
        """, {
            "user_id": user_id,
            "access_role": access_role,
            "is_active": is_active
        })

        for page in cleaned_pages:
            cur.execute("""
                INSERT INTO YUGEM_USER_PAGE_ACCESS (
                    USER_ID,
                    PAGE_NAME,
                    IS_ALLOWED
                )
                VALUES (
                    :user_id,
                    :page_name,
                    'Y'
                )
            """, {
                "user_id": user_id,
                "page_name": page
            })

        conn.commit()

        return jsonify({
            "status": "success",
            "message": "User created successfully.",
            "user_id": user_id
        }), 201

    except Exception as e:
        if conn:
            conn.rollback()

        print("CREATE USER ERROR:", e)

        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


# =========================================================
# ADMIN - EDIT USER
# =========================================================

@auth_bp.route("/api/admin/users/<int:user_id>", methods=["PUT"])
def edit_user(user_id):
    conn = None
    cur = None

    try:
        logged_user_id = _get_authenticated_user_id()

        if not logged_user_id:
            return jsonify({
                "status": "error",
                "message": "Admin login required."
            }), 401

        logged_role, logged_active, logged_pages = _get_db_user_access(logged_user_id)

        if logged_active != "Y":
            return jsonify({
                "status": "error",
                "message": "Your account is inactive."
            }), 403

        if logged_role != "ADMIN":
            return jsonify({
                "status": "error",
                "message": "Admin access required."
            }), 403

        data = request.get_json(silent=True) or {}

        full_name = (data.get("full_name") or "").strip()
        login_id = (data.get("login_id") or "").strip()
        password = data.get("password") or ""
        contact_no = (data.get("contact_no") or "").strip()
        db_role = (data.get("db_role") or "BDE").strip()
        access_role = (data.get("access_role") or "NO_ACCESS").strip().upper()
        is_active = (data.get("is_active") or "Y").strip().upper()
        allowed_pages = data.get("allowed_pages", [])

        if not full_name:
            return jsonify({
                "status": "error",
                "message": "Full Name is required."
            }), 400

        if not login_id:
            return jsonify({
                "status": "error",
                "message": "Login ID is required."
            }), 400

        if not db_role:
            return jsonify({
                "status": "error",
                "message": "DB Role is required."
            }), 400

        if access_role not in ["ADMIN", "EMPLOYEE", "NO_ACCESS"]:
            return jsonify({
                "status": "error",
                "message": "Invalid access role."
            }), 400

        if is_active not in ["Y", "N"]:
            return jsonify({
                "status": "error",
                "message": "Invalid active status."
            }), 400

        cleaned_pages = []
        if isinstance(allowed_pages, list):
            for page in allowed_pages:
                norm_page = _normalize_page_name(page)
                if norm_page and norm_page not in cleaned_pages:
                    cleaned_pages.append(norm_page)

        if access_role == "NO_ACCESS":
            cleaned_pages = []

        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT USER_ID, EMPLOYEE_ID, LOGIN_ID
            FROM YUGEM_USERS
            WHERE USER_ID = :user_id
        """, {
            "user_id": user_id
        })

        target_user = cur.fetchone()

        if not target_user:
            return jsonify({
                "status": "error",
                "message": "User not found."
            }), 404

        employee_id = target_user[1]

        cur.execute("""
            SELECT USER_ID
            FROM YUGEM_USERS
            WHERE UPPER(LOGIN_ID) = UPPER(:login_id)
              AND USER_ID <> :user_id
        """, {
            "login_id": login_id,
            "user_id": user_id
        })

        if cur.fetchone():
            return jsonify({
                "status": "error",
                "message": "Login ID already exists."
            }), 409

        cur.execute("""
            SELECT ACCESS_ROLE, IS_ACTIVE
            FROM YUGEM_USER_ACCESS
            WHERE USER_ID = :user_id
        """, {
            "user_id": user_id
        })

        current_access = cur.fetchone()

        currently_admin = (
            current_access is not None
            and current_access[0] == "ADMIN"
            and current_access[1] == "Y"
        )

        if currently_admin and (access_role != "ADMIN" or is_active != "Y"):
            cur.execute("""
                SELECT COUNT(*)
                FROM YUGEM_USER_ACCESS
                WHERE ACCESS_ROLE = 'ADMIN'
                  AND IS_ACTIVE = 'Y'
            """)

            admin_count = cur.fetchone()[0]

            if admin_count <= 1:
                return jsonify({
                    "status": "error",
                    "message": "At least one active Admin is required."
                }), 400

        cur.execute("""
            UPDATE YUGEM_USERS
            SET
                LOGIN_ID = :login_id,
                FULL_NAME = :full_name,
                ROLE_NAME = :db_role,
                CONTACT_NO = :contact_no,
                IS_ACTIVE = :is_active,
                UPDATED_AT = SYSTIMESTAMP
            WHERE USER_ID = :user_id
        """, {
            "login_id": login_id,
            "full_name": full_name,
            "db_role": db_role,
            "contact_no": contact_no or None,
            "is_active": is_active,
            "user_id": user_id
        })

        if password:
            cur.execute("""
                UPDATE YUGEM_USERS
                SET
                    PASSWORD_HASH = :password,
                    UPDATED_AT = SYSTIMESTAMP
                WHERE USER_ID = :user_id
            """, {
                "password": password,
                "user_id": user_id
            })

        if current_access:
            cur.execute("""
                UPDATE YUGEM_USER_ACCESS
                SET
                    ACCESS_ROLE = :access_role,
                    IS_ACTIVE = :is_active,
                    UPDATED_AT = SYSTIMESTAMP
                WHERE USER_ID = :user_id
            """, {
                "access_role": access_role,
                "is_active": is_active,
                "user_id": user_id
            })
        else:
            cur.execute("""
                INSERT INTO YUGEM_USER_ACCESS (
                    USER_ID,
                    ACCESS_ROLE,
                    IS_ACTIVE,
                    CREATED_AT,
                    UPDATED_AT
                )
                VALUES (
                    :user_id,
                    :access_role,
                    :is_active,
                    SYSTIMESTAMP,
                    SYSTIMESTAMP
                )
            """, {
                "user_id": user_id,
                "access_role": access_role,
                "is_active": is_active
            })

        cur.execute("""
            DELETE FROM YUGEM_USER_PAGE_ACCESS
            WHERE USER_ID = :user_id
        """, {
            "user_id": user_id
        })

        for page in cleaned_pages:
            cur.execute("""
                INSERT INTO YUGEM_USER_PAGE_ACCESS (
                    USER_ID,
                    PAGE_NAME,
                    IS_ALLOWED
                )
                VALUES (
                    :user_id,
                    :page_name,
                    'Y'
                )
            """, {
                "user_id": user_id,
                "page_name": page
            })

        conn.commit()

        return jsonify({
            "status": "success",
            "message": "User updated successfully.",
            "user_id": user_id,
            "employee_id": employee_id
        }), 200

    except Exception as e:
        if conn:
            conn.rollback()

        print("EDIT USER ERROR:", e)

        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


# =========================================================
# ADMIN - ACTIVATE / DEACTIVATE USER
# =========================================================

@auth_bp.route("/api/admin/users/<int:user_id>", methods=["DELETE"])
def deactivate_user(user_id):
    conn = None
    cur = None

    try:
        logged_user_id = _get_authenticated_user_id()

        if not logged_user_id:
            return jsonify({
                "status": "error",
                "message": "Admin login required."
            }), 401

        logged_role, logged_active, logged_pages = _get_db_user_access(logged_user_id)

        if logged_active != "Y":
            return jsonify({
                "status": "error",
                "message": "Your account is inactive."
            }), 403

        if logged_role != "ADMIN":
            return jsonify({
                "status": "error",
                "message": "Admin access required."
            }), 403

        data = request.get_json(silent=True) or {}
        action = (data.get("action") or "deactivate").strip().lower()

        if action not in ["activate", "deactivate"]:
            action = "deactivate"

        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT USER_ID, EMPLOYEE_ID
            FROM YUGEM_USERS
            WHERE USER_ID = :user_id
        """, {
            "user_id": user_id
        })

        target_user = cur.fetchone()

        if not target_user:
            return jsonify({
                "status": "error",
                "message": "User not found."
            }), 404

        if action == "deactivate":
            cur.execute("""
                SELECT ACCESS_ROLE, IS_ACTIVE
                FROM YUGEM_USER_ACCESS
                WHERE USER_ID = :user_id
            """, {
                "user_id": user_id
            })

            current_access = cur.fetchone()

            currently_admin = (
                current_access is not None
                and current_access[0] == "ADMIN"
                and current_access[1] == "Y"
            )

            if currently_admin:
                cur.execute("""
                    SELECT COUNT(*)
                    FROM YUGEM_USER_ACCESS
                    WHERE ACCESS_ROLE = 'ADMIN'
                      AND IS_ACTIVE = 'Y'
                """)

                admin_count = cur.fetchone()[0]

                if admin_count <= 1:
                    return jsonify({
                        "status": "error",
                        "message": "At least one active Admin is required."
                    }), 400

        new_status = "Y" if action == "activate" else "N"

        cur.execute("""
            UPDATE YUGEM_USERS
            SET
                IS_ACTIVE = :is_active,
                UPDATED_AT = SYSTIMESTAMP
            WHERE USER_ID = :user_id
        """, {
            "is_active": new_status,
            "user_id": user_id
        })

        cur.execute("""
            UPDATE YUGEM_USER_ACCESS
            SET
                IS_ACTIVE = :is_active,
                UPDATED_AT = SYSTIMESTAMP
            WHERE USER_ID = :user_id
        """, {
            "is_active": new_status,
            "user_id": user_id
        })

        conn.commit()

        return jsonify({
            "status": "success",
            "message": "User activated successfully." if action == "activate" else "User deactivated successfully."
        }), 200

    except Exception as e:
        if conn:
            conn.rollback()

        print("CHANGE USER STATUS ERROR:", e)

        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()