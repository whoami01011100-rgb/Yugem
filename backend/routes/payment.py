import os

import uuid



from datetime import datetime

from decimal import Decimal, InvalidOperation



from flask import Blueprint, jsonify, request, send_file



from database import get_connection





payment_bp = Blueprint("payment", __name__)





# =========================================================

# PATHS

# =========================================================



BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))



UPLOAD_ROOT = os.path.abspath(

    os.path.join(BASE_DIR, "..", "uploads")

)





# =========================================================

# CONSTANTS

# =========================================================



TWO = Decimal("0.01")

HUNDRED = Decimal("100")





# =========================================================

# FILE RULES

# =========================================================



FILE_RULES = {

    "payment_screenshot": (

        "SCREENSHOT",

        "payment_screenshots",

        {".png", ".jpg", ".jpeg"},

        5,

        True,

    ),



    "invoice": (

        "INVOICE",

        "invoices",

        {".pdf", ".png", ".jpg", ".jpeg"},

        10,

        False,

    ),

}





# =========================================================

# COMMON ERROR

# =========================================================



def _error(message, code=500):

    return jsonify({

        "status": "error",

        "message": message

    }), code





# =========================================================

# DECIMAL HELPER

# =========================================================



def _dec(value, field):



    try:

        d = Decimal(str(value).strip())



    except (InvalidOperation, AttributeError):



        raise ValueError(

            f"{field} must be a valid number"

        )



    if d < 0:



        raise ValueError(

            f"{field} cannot be negative"

        )



    return d.quantize(TWO)





# =========================================================

# INTEGER HELPER

# =========================================================



def _int_or_none(value):



    value = (value or "").strip()



    return int(value) if value else None





# =========================================================

# CLEANUP

# =========================================================



def _cleanup(paths):



    for p in paths:



        try:



            if os.path.exists(p):

                os.remove(p)



        except Exception:



            pass





# =========================================================

# CREATE PAYMENT

# =========================================================



@payment_bp.route("/api/payments", methods=["POST"])

def create_payment():



    form = request.form



    saved_paths = []



    conn = None



    try:



        # =====================================================

        # VALIDATION

        # =====================================================



        bde_user_id = _int_or_none(

            form.get("bde_user_id")

        )



        client_name = (

            form.get("client_name") or ""

        ).strip()[:150]



        contact = (

            form.get("contact_number") or ""

        ).strip()



        company_name = (

            form.get("company_name") or ""

        ).strip()



        company_type = (

            form.get("company_type") or ""

        ).strip()



        bde_name_form = (form.get("bde_name") or "").strip()[:150]

        bde_pan = (form.get("bde_pan") or "").strip().upper()[:20]



       # =====================================================

        # BDM NAMES

        # =====================================================



        # =====================================================

        # BDM NAMES

        # =====================================================



        bdm1_name = (

            form.get("bdm_1_name") or ""

        ).strip()[:150]



        bdm2_name = (

            form.get("bdm_2_name") or ""

        ).strip()[:150]



        bdm1_id = None

        bdm2_id = None



        # =====================================================

        # SERVICES

        # =====================================================



        services = []



        for s in (

            form.get("services") or ""

        ).split(","):



            s = s.strip()[:150]



            if s and s not in services:



                services.append(s)





        # =====================================================

        # REQUIRED VALIDATION

        # =====================================================



        if not bde_user_id:



            return _error(

                "BDE user is missing. Please login again.",

                400

            )



        if not client_name:



            return _error(

                "Client name is required",

                400

            )



        if (

            not contact

            or not company_name

            or not company_type

        ):



            return _error(

                "Contact, company name and company type are required",

                400

            )



        if not services:



            return _error(

                "Select at least one service",

                400

            )



        if not bdm1_name:



            return _error(

                "BDM Name 1 is required",

                400

            )





        # =====================================================

        # AMOUNTS

        # =====================================================



        deal = _dec(

            form.get("total_deal_amount"),

            "Total deal amount"

        )



        recv = _dec(

            form.get("received_amount"),

            "Amount received"

        )



        rate = _dec(

            form.get("gst_rate") or "18",

            "GST rate"

        )





        if deal <= 0:



            return _error(

                "Total deal amount must be greater than 0",

                400

            )





        # =====================================================

        # GST

        # =====================================================



        gst_status = form.get(

            "gst_status",

            "included"

        )





        if gst_status not in (

            "included",

            "excluded"

        ):



            return _error(

                "Invalid GST type",

                400

            )





        # =====================================================

        # GST CALCULATION

        # =====================================================



        if gst_status == "included":



            received_incl = recv



            excl = (

                recv / (

                    1 + rate / HUNDRED

                )

            ).quantize(TWO)



            gst = (

                received_incl - excl

            ).quantize(TWO)



        else:



            excl = recv



            gst = (

                recv * rate / HUNDRED

            ).quantize(TWO)



            received_incl = (

                excl + gst

            ).quantize(TWO)





        # =====================================================

        # BALANCE

        # =====================================================



        balance = (

            deal - received_incl

        ).quantize(TWO)





        if balance < 0:



            return _error(

                "Amount received cannot exceed Total Deal Amount",

                400

            )





        status = (
            form.get("payment_status") or ""
        ).strip().upper()

        if status not in ("RECEIVED", "PENDING"):
            return _error(
                "Please select Received or Pending status",
                400
            )




        # =====================================================

        # PAYMENT PERCENTAGE

        # =====================================================



        pct = (

            form.get("payment_percentage")

            or "100"

        )





        if pct not in (

            "50",

            "100"

        ):



            return _error(

                "Invalid payment terms",

                400

            )





        # =====================================================

        # FILE VALIDATION

        # =====================================================



        files = {}





        for (

            field,

            (

                ftype,

                folder,

                exts,

                max_mb,

                required

            )

        ) in FILE_RULES.items():



            f = request.files.get(field)





            if not f or not f.filename:



                if required:



                    return _error(

                        "Payment screenshot is required",

                        400

                    )



                continue





            ext = os.path.splitext(

                f.filename

            )[1].lower()





            if ext not in exts:



                return _error(

                    f"{f.filename}: file type not allowed",

                    400

                )





            f.seek(

                0,

                os.SEEK_END

            )



            size = f.tell()



            f.seek(0)





            if size > max_mb * 1024 * 1024:



                return _error(

                    f"{f.filename} is larger than {max_mb} MB",

                    400

                )





            files[field] = (

                f,

                ftype,

                folder,

                ext,

                size

            )





        # =====================================================

        # DATABASE

        # =====================================================



        conn = get_connection()



        cur = conn.cursor()





        # =====================================================

        # BDE USER

        # =====================================================



        cur.execute(

            """

            SELECT FULL_NAME, EMPLOYEE_ID

            FROM YUGEM_USERS

            WHERE USER_ID = :id

              AND IS_ACTIVE = 'Y'

            """,

            {

                "id": bde_user_id

            }

        )





        user = cur.fetchone()





        if not user:



            return _error(

                "Invalid BDE user",

                400

            )





        # =====================================================

        # CLIENT

        # =====================================================



        cur.execute(

            """

            SELECT CLIENT_ID

            FROM YUGEM_CLIENTS

            WHERE UPPER(CLIENT_NAME)

                  = UPPER(:cname)

            """,

            {

                "cname": client_name

            }

        )





        row = cur.fetchone()





        if row:



            client_id = row[0]



        else:



            cid = cur.var(int)





            cur.execute(

                """

                INSERT INTO YUGEM_CLIENTS

                (

                    CLIENT_NAME,

                    CONTACT_NO,

                    EMAIL,

                    COMPANY_NAME,

                    COMPANY_TYPE,

                    CREATED_BY

                )

                VALUES

                (

                    :cname,

                    :contact,

                    :email,

                    :company,

                    :ctype,

                    :created_by

                )

                RETURNING CLIENT_ID INTO :cid

                """,

                {

                    "cname": client_name,



                    "contact": contact[:20],



                    "email": (

                        form.get("email_address")

                        or ""

                    ).strip()[:150] or None,



                    "company": company_name[:200],



                    "ctype": company_type[:100],



                    "created_by": bde_user_id,



                    "cid": cid

                }

            )





            client_id = cid.getvalue()[0]





        # =====================================================

        # PAYMENT INSERT

        # =====================================================

        # =====================================================

        # PAYMENT INSERT

        # =====================================================



        payment_id = cur.var(int)



        cur.execute(

            """

            INSERT INTO YUGEM_PAYMENTS

            (

                BDE_USER_ID,

                BDE_NAME,

                EMPLOYEE_ID,

                BDE_PAN,



                PAYMENT_DATE,

                PAYMENT_TIME,



                CLIENT_ID,

                CLIENT_NAME,

                CLIENT_CONTACT,

                CLIENT_EMAIL,



                COMPANY_NAME,

                COMPANY_TYPE,



                PAYMENT_PERCENTAGE,

                SERVICE_FEE,

                GST_STATUS,

                GST_RATE,



                BASIC_AMOUNT,

                GST_AMOUNT,

                TOTAL_AMOUNT,



                RECEIVED_AMOUNT,

                BALANCE_AMOUNT,



                BDM1_ID,

                BDM2_ID,



                BDM1_NAME,

                BDM2_NAME,



                PAYMENT_TYPE,

                REMARKS,

                PAYMENT_STATUS

            )

            VALUES

            (

                :bde_user_id,

                :bde_name,

                :employee_id,

                :bde_pan,



                SYSDATE,

                :payment_time,



                :client_id,

                :client_name,

                :client_contact,

                :client_email,



                :company_name,

                :company_type,



                :pct,

                :deal,

                :gst_status,

                :rate,



                :basic,

                :gst,

                :total,



                :received,

                :balance,



                :bdm1_id,

                :bdm2_id,



                :bdm1_name,

                :bdm2_name,



                :payment_type,

                :remarks,

                :status

            )

            RETURNING PAYMENT_ID INTO :payment_id

            """,

            {

                "bde_user_id": bde_user_id,



                "bde_name": bde_name_form or user[0],



                "employee_id": user[1],



                "bde_pan": bde_pan or None,



                "payment_time": (

                    datetime.now().strftime("%H:%M")

                ),



                "client_id": client_id,



                "client_name": client_name,



                "client_contact": contact[:20],



                "client_email": (

                    form.get("email_address")

                    or ""

                ).strip()[:150] or None,



                "company_name": company_name[:200],



                "company_type": company_type[:100],



                "pct": pct,



                "deal": deal,



                "gst_status": gst_status,



                "rate": rate,



                "basic": excl,



                "gst": gst,



                "total": deal,



                "received": received_incl,



                "balance": balance,



                # BDM IDs are not used anymore

                "bdm1_id": None,

                "bdm2_id": None,



                # BDM names from textbox

                "bdm1_name": bdm1_name,



                "bdm2_name": bdm2_name,



                "payment_type": (

                    "FULL"

                    if pct == "100"

                    else "HALF"

                ),



                "remarks": (

                    form.get("remarks")

                    or ""

                ).strip()[:1000] or None,



                "status": status,



                "payment_id": payment_id

            }

        )
        new_payment_id = payment_id.getvalue()[0]


        # =====================================================

        # SERVICES

        # =====================================================



        cur.executemany(

            """

            INSERT INTO YUGEM_PAYMENT_SERVICES

            (

                PAYMENT_ID,

                SERVICE_NAME

            )

            VALUES

            (

                :pid,

                :sname

            )

            """,

            [

                {

                    "pid": new_payment_id,

                    "sname": s

                }

                for s in services

            ]

        )





        # =====================================================

        # ATTACHMENTS

        # =====================================================



        for (

            field,

            (

                f,

                ftype,

                folder,

                ext,

                size

            )

        ) in files.items():



            folder_path = os.path.join(

                UPLOAD_ROOT,

                folder

            )





            os.makedirs(

                folder_path,

                exist_ok=True

            )





            stored_name = (

                f"{new_payment_id}_"

                f"{uuid.uuid4().hex}"

                f"{ext}"

            )





            full_path = os.path.join(

                folder_path,

                stored_name

            )





            f.save(full_path)



            saved_paths.append(full_path)





            cur.execute(

                """

                INSERT INTO YUGEM_PAYMENT_ATTACHMENTS

                (

                    PAYMENT_ID,

                    FILE_TYPE,

                    ORIGINAL_FILE_NAME,

                    MIME_TYPE,

                    FILE_SIZE,

                    FILE_PATH

                )

                VALUES

                (

                    :pid,

                    :ftype,

                    :orig,

                    :mime,

                    :fsize,

                    :fpath

                )

                """,

                {

                    "pid": new_payment_id,



                    "ftype": ftype,



                    "orig": os.path.basename(

                        f.filename

                    )[:255],



                    "mime": f.mimetype,



                    "fsize": size,



                    "fpath": (

                        f"{folder}/{stored_name}"

                    )

                }

            )





        # =====================================================

        # COMMIT

        # =====================================================



        conn.commit()





        return jsonify(

            {

                "status": "success",



                "message": (

                    f"Payment entry "

                    f"#{new_payment_id} "

                    f"saved successfully"

                ),



                "payment_id": new_payment_id

            }

        ), 201





    except ValueError as e:



        if conn:



            conn.rollback()



        _cleanup(saved_paths)



        return _error(

            str(e),

            400

        )





    except Exception as e:



        if conn:



            conn.rollback()



        _cleanup(saved_paths)



        return _error(

            str(e)

        )





    finally:



        if conn:



            conn.close()





# =========================================================

# PAYMENT HISTORY

# =========================================================



@payment_bp.route(

    "/api/payments",

    methods=["GET"]

)

def list_payments():



    conn = None



    try:



        conn = get_connection()



        cur = conn.cursor()





        # =====================================================

        # FILTERS

        # =====================================================



        search = (

            request.args.get("search")

            or ""

        ).strip()





        status = (

            request.args.get("status")

            or ""

        ).strip().upper()





        # =====================================================

        # MAIN PAYMENT QUERY

        # =====================================================



        sql = """

            SELECT



                P.PAYMENT_ID,

                P.PAYMENT_DATE,

                P.PAYMENT_TIME,



                P.BDE_NAME,

                P.EMPLOYEE_ID,

                P.BDE_PAN,



                P.CLIENT_NAME,

                P.CLIENT_CONTACT,

                P.CLIENT_EMAIL,



                P.COMPANY_NAME,

                P.COMPANY_TYPE,



                P.PAYMENT_PERCENTAGE,



                P.GST_STATUS,

                P.GST_RATE,



                P.BASIC_AMOUNT,

                P.GST_AMOUNT,

                P.TOTAL_AMOUNT,



                P.RECEIVED_AMOUNT,

                P.BALANCE_AMOUNT,



                P.BDM1_ID,

                P.BDM2_ID,



                P.BDM1_NAME,

                P.BDM2_NAME,

                P.PAYMENT_TYPE,

                P.REMARKS,

                P.PAYMENT_STATUS



            FROM YUGEM_PAYMENTS P



            WHERE 1 = 1

        """





        params = {}





        # =====================================================

        # SEARCH

        # =====================================================



        if search:



            sql += """

                AND

                (

                    UPPER(P.CLIENT_NAME)

                        LIKE UPPER(:search)



                    OR UPPER(P.COMPANY_NAME)

                        LIKE UPPER(:search)



                    OR UPPER(P.BDE_NAME)

                        LIKE UPPER(:search)



                    OR UPPER(P.EMPLOYEE_ID)

                        LIKE UPPER(:search)

                )

            """





            params["search"] = (

                "%" + search + "%"

            )





        # =====================================================

        # STATUS

        # =====================================================



        if status:



            sql += """

                AND UPPER(P.PAYMENT_STATUS)

                    = :status

            """





            params["status"] = status





        # =====================================================

        # ORDER

        # =====================================================



        sql += """

            ORDER BY P.PAYMENT_ID DESC

        """





        cur.execute(

            sql,

            params

        )





        rows = cur.fetchall()





        payments = []





        # =====================================================

        # LOOP PAYMENTS

        # =====================================================



        for r in rows:



            payment_id = r[0]





            # =================================================

            # BDM names are stored directly on the payment now.
            bdm_names = {
                "bdm1": r[21],
                "bdm2": r[22]
            }


            # SERVICES

            # =================================================



            service_cur = conn.cursor()





            service_cur.execute(

                """

                SELECT SERVICE_NAME

                FROM YUGEM_PAYMENT_SERVICES

                WHERE PAYMENT_ID = :payment_id

                ORDER BY SERVICE_NAME

                """,

                {

                    "payment_id": payment_id

                }

            )





            service_rows = (

                service_cur.fetchall()

            )





            services = [

                service_row[0]

                for service_row in service_rows

            ]





            service_cur.close()





            # =================================================

            # ATTACHMENTS

            # =================================================



            attachment_cur = conn.cursor()





            attachment_cur.execute(

                """

                SELECT

                    FILE_TYPE,

                    ORIGINAL_FILE_NAME

                FROM YUGEM_PAYMENT_ATTACHMENTS

                WHERE PAYMENT_ID = :payment_id

                """,

                {

                    "payment_id": payment_id

                }

            )





            attachment_rows = (

                attachment_cur.fetchall()

            )





            attachment_cur.close()





            has_screenshot = False



            has_invoice = False



            screenshot_name = None



            invoice_name = None





            for attachment in attachment_rows:



                file_type = attachment[0]



                original_name = attachment[1]





                if file_type == "SCREENSHOT":



                    has_screenshot = True



                    screenshot_name = (

                        original_name

                    )





                elif file_type == "INVOICE":



                    has_invoice = True



                    invoice_name = (

                        original_name

                    )





            # =================================================

            # PAYMENT OBJECT

            # =================================================



            payments.append(

                {



                    # -----------------------------

                    # PAYMENT

                    # -----------------------------



                    "payment_id": payment_id,



                    "payment_date": (

                        r[1].strftime(

                            "%d-%m-%Y"

                        )

                        if r[1]

                        else ""

                    ),



                    "payment_time": (

                        str(r[2])

                        if r[2]

                        else ""

                    ),





                    # -----------------------------

                    # BDE

                    # -----------------------------



                    "bde_name": r[3],



                    "employee_id": r[4],



                    "bde_pan": r[5],



                    # -----------------------------

                    # CLIENT

                    # -----------------------------



                    "client_name": r[6],



                    "client_contact": r[7],



                    "client_email": r[8],



                    "company_name": r[9],



                    "company_type": r[10],





                    # -----------------------------

                    # PAYMENT / GST

                    # -----------------------------



                    "payment_percentage": float(

                        r[11] or 0

                    ),



                    "gst_status": r[12],



                    "gst_rate": float(

                        r[13] or 0

                    ),





                    # -----------------------------

                    # AMOUNTS

                    # -----------------------------



                    "basic_amount": float(

                        r[14] or 0

                    ),



                    "gst_amount": float(

                        r[15] or 0

                    ),



                    "total_amount": float(

                        r[16] or 0

                    ),



                    "received_amount": float(

                        r[17] or 0

                    ),



                    "balance_amount": float(

                        r[18] or 0

                    ),





                    # -----------------------------

                    # BDM

                    # -----------------------------



                    "bdm1_id": r[19],



                    "bdm2_id": r[20],



                    "bdm1_name": (

                        bdm_names["bdm1"]

                    ),



                    "bdm2_name": (

                        bdm_names["bdm2"]

                    ),





                    # -----------------------------

                    # PAYMENT TYPE / STATUS

                    # -----------------------------



                    "payment_type": r[23],



                    "remarks": (

                        r[24] or ""

                    ),



                    "payment_status": r[25],





                    # -----------------------------

                    # SERVICES

                    # -----------------------------



                    "services": services,





                    # -----------------------------

                    # SCREENSHOT

                    # -----------------------------



                    "has_screenshot": (

                        has_screenshot

                    ),



                    "screenshot_name": (

                        screenshot_name

                    ),



                    "screenshot_url": (

                        f"/api/payments/"

                        f"{payment_id}/"

                        f"attachment/"

                        f"screenshot"

                        if has_screenshot

                        else None

                    ),





                    # -----------------------------

                    # INVOICE

                    # -----------------------------



                    "has_invoice": (

                        has_invoice

                    ),



                    "invoice_name": (

                        invoice_name

                    ),



                    "invoice_url": (

                        f"/api/payments/"

                        f"{payment_id}/"

                        f"attachment/"

                        f"invoice"

                        if has_invoice

                        else None

                    )

                }

            )





        # =====================================================

        # RESPONSE

        # =====================================================



        return jsonify(

            {

                "status": "success",



                "payments": payments,



                "count": len(payments)

            }

        )





    except Exception as e:



        return _error(

            str(e)

        )





    finally:



        if conn:



            conn.close()





# =========================================================

# PAYMENT ATTACHMENT VIEW

# =========================================================



# =========================================================
# UPDATE PAYMENT
# =========================================================

@payment_bp.route(
    "/api/payments/<int:payment_id>",
    methods=["PUT"]
)
def update_payment(payment_id):

    conn = None

    try:

        form = request.form

        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT PAYMENT_ID
            FROM YUGEM_PAYMENTS
            WHERE PAYMENT_ID = :payment_id
            """,
            {"payment_id": payment_id}
        )

        if not cur.fetchone():
            return _error("Payment entry not found", 404)

        bde_name = (form.get("bde_name") or "").strip()[:150]
        bde_pan = (form.get("bde_pan") or "").strip().upper()[:20]
        client_name = (form.get("client_name") or "").strip()[:150]
        contact = (form.get("contact_number") or "").strip()
        email = (form.get("email_address") or "").strip()[:150] or None
        company_name = (form.get("company_name") or "").strip()[:200]
        company_type = (form.get("company_type") or "").strip()[:100]
        bdm1_name = (form.get("bdm_1_name") or "").strip()[:150]
        bdm2_name = (form.get("bdm_2_name") or "").strip()[:150]

        services = []
        for s in (form.get("services") or "").split(","):
            s = s.strip()[:150]
            if s and s not in services:
                services.append(s)

        if not client_name:
            return _error("Client name is required", 400)
        if not contact or not company_name or not company_type:
            return _error(
                "Contact, company name and company type are required",
                400
            )
        if not services:
            return _error("Select at least one service", 400)
        if not bdm1_name:
            return _error("BDM Name 1 is required", 400)

        deal = _dec(form.get("total_deal_amount"), "Total deal amount")
        recv = _dec(form.get("received_amount"), "Amount received")
        rate = _dec(form.get("gst_rate") or "18", "GST rate")

        if deal <= 0:
            return _error(
                "Total deal amount must be greater than 0",
                400
            )

        gst_status = form.get("gst_status", "included")

        if gst_status not in ("included", "excluded"):
            return _error("Invalid GST type", 400)

        if gst_status == "included":
            received_incl = recv
            excl = (recv / (1 + rate / HUNDRED)).quantize(TWO)
            gst = (received_incl - excl).quantize(TWO)
        else:
            excl = recv
            gst = (recv * rate / HUNDRED).quantize(TWO)
            received_incl = (excl + gst).quantize(TWO)

        balance = (deal - received_incl).quantize(TWO)

        if balance < 0:
            return _error(
                "Amount received cannot exceed Total Deal Amount",
                400
            )

        status = (
            form.get("payment_status") or ""
        ).strip().upper()

        if status not in ("RECEIVED", "PENDING"):
            return _error(
                "Please select Received or Pending status",
                400
            )

        pct = form.get("payment_percentage") or "100"

        if pct not in ("50", "100"):
            return _error("Invalid payment terms", 400)

        payment_type = "FULL" if pct == "100" else "HALF"

        cur.execute(
            """
            UPDATE YUGEM_PAYMENTS
            SET
                BDE_NAME = :bde_name,
                BDE_PAN = :bde_pan,
                CLIENT_NAME = :client_name,
                CLIENT_CONTACT = :client_contact,
                CLIENT_EMAIL = :client_email,
                COMPANY_NAME = :company_name,
                COMPANY_TYPE = :company_type,
                PAYMENT_PERCENTAGE = :pct,
                SERVICE_FEE = :deal,
                GST_STATUS = :gst_status,
                GST_RATE = :rate,
                BASIC_AMOUNT = :basic,
                GST_AMOUNT = :gst,
                TOTAL_AMOUNT = :total,
                RECEIVED_AMOUNT = :received,
                BALANCE_AMOUNT = :balance,
                BDM1_ID = NULL,
                BDM2_ID = NULL,
                BDM1_NAME = :bdm1_name,
                BDM2_NAME = :bdm2_name,
                PAYMENT_TYPE = :payment_type,
                REMARKS = :remarks,
                PAYMENT_STATUS = :status
            WHERE PAYMENT_ID = :payment_id
            """,
            {
                "bde_name": bde_name or None,
                "bde_pan": bde_pan or None,
                "client_name": client_name,
                "client_contact": contact[:20],
                "client_email": email,
                "company_name": company_name,
                "company_type": company_type,
                "pct": pct,
                "deal": deal,
                "gst_status": gst_status,
                "rate": rate,
                "basic": excl,
                "gst": gst,
                "total": deal,
                "received": received_incl,
                "balance": balance,
                "bdm1_name": bdm1_name,
                "bdm2_name": bdm2_name or None,
                "payment_type": payment_type,
                "remarks": (form.get("remarks") or "").strip()[:1000] or None,
                "status": status,
                "payment_id": payment_id
            }
        )

        cur.execute(
            """
            DELETE FROM YUGEM_PAYMENT_SERVICES
            WHERE PAYMENT_ID = :payment_id
            """,
            {"payment_id": payment_id}
        )

        cur.executemany(
            """
            INSERT INTO YUGEM_PAYMENT_SERVICES
            (
                PAYMENT_ID,
                SERVICE_NAME
            )
            VALUES
            (
                :pid,
                :sname
            )
            """,
            [
                {"pid": payment_id, "sname": s}
                for s in services
            ]
        )

        conn.commit()

        return jsonify(
            {
                "status": "success",
                "message": f"Payment entry #{payment_id} updated successfully",
                "payment_id": payment_id
            }
        ), 200

    except ValueError as e:

        if conn:
            conn.rollback()

        return _error(str(e), 400)

    except Exception as e:

        if conn:
            conn.rollback()

        return _error(str(e))

    finally:

        if conn:
            conn.close()


# =========================================================
# DELETE PAYMENT
# =========================================================

@payment_bp.route(
    "/api/payments/<int:payment_id>",
    methods=["DELETE"]
)
def delete_payment(payment_id):

    conn = None

    try:

        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT FILE_PATH
            FROM YUGEM_PAYMENT_ATTACHMENTS
            WHERE PAYMENT_ID = :payment_id
            """,
            {"payment_id": payment_id}
        )

        attachment_rows = cur.fetchall()

        cur.execute(
            """
            SELECT PAYMENT_ID
            FROM YUGEM_PAYMENTS
            WHERE PAYMENT_ID = :payment_id
            """,
            {"payment_id": payment_id}
        )

        if not cur.fetchone():
            return _error("Payment entry not found", 404)

        cur.execute(
            """
            DELETE FROM YUGEM_PAYMENT_SERVICES
            WHERE PAYMENT_ID = :payment_id
            """,
            {"payment_id": payment_id}
        )

        cur.execute(
            """
            DELETE FROM YUGEM_PAYMENT_ATTACHMENTS
            WHERE PAYMENT_ID = :payment_id
            """,
            {"payment_id": payment_id}
        )

        cur.execute(
            """
            DELETE FROM YUGEM_PAYMENTS
            WHERE PAYMENT_ID = :payment_id
            """,
            {"payment_id": payment_id}
        )

        conn.commit()

        for row in attachment_rows:
            relative_path = row[0]

            if not relative_path:
                continue

            full_path = os.path.abspath(
                os.path.join(
                    UPLOAD_ROOT,
                    relative_path
                )
            )

            upload_root_real = os.path.realpath(UPLOAD_ROOT)
            file_real = os.path.realpath(full_path)

            if (
                file_real.startswith(upload_root_real + os.sep)
                and os.path.isfile(file_real)
            ):
                try:
                    os.remove(file_real)
                except Exception:
                    pass

        return jsonify(
            {
                "status": "success",
                "message": f"Payment entry #{payment_id} deleted successfully",
                "payment_id": payment_id
            }
        ), 200

    except Exception as e:

        if conn:
            conn.rollback()

        return _error(str(e))

    finally:

        if conn:
            conn.close()


@payment_bp.route(

    "/api/payments/<int:payment_id>/attachment/<file_type>",

    methods=["GET"]

)

def view_payment_attachment(

    payment_id,

    file_type

):



    # =====================================================

    # VALID FILE TYPE

    # =====================================================



    if file_type not in (

        "screenshot",

        "invoice"

    ):



        return _error(

            "Invalid attachment type",

            400

        )





    conn = None





    try:



        conn = get_connection()



        cur = conn.cursor()





        # =================================================

        # FILE TYPE

        # =================================================



        if file_type == "screenshot":



            db_file_type = "SCREENSHOT"



        else:



            db_file_type = "INVOICE"





        # =================================================

        # DATABASE FILE

        # =================================================



        cur.execute(

            """

            SELECT

                FILE_PATH,

                ORIGINAL_FILE_NAME,

                MIME_TYPE

            FROM YUGEM_PAYMENT_ATTACHMENTS

            WHERE PAYMENT_ID = :payment_id

              AND FILE_TYPE = :file_type

            """,

            {

                "payment_id": payment_id,



                "file_type": db_file_type

            }

        )





        row = cur.fetchone()





        if not row:



            return _error(

                "Attachment not found",

                404

            )





        relative_path = row[0]



        original_name = row[1]



        mime_type = row[2]





        # =================================================

        # FULL PATH

        # =================================================



        full_path = os.path.abspath(

            os.path.join(

                UPLOAD_ROOT,

                relative_path

            )

        )





        # =================================================

        # SECURITY CHECK

        # =================================================



        upload_root_real = os.path.realpath(

            UPLOAD_ROOT

        )



        file_real = os.path.realpath(

            full_path

        )





        if not file_real.startswith(

            upload_root_real + os.sep

        ):



            return _error(

                "Invalid file path",

                403

            )





        # =================================================

        # FILE EXISTS

        # =================================================



        if not os.path.isfile(

            file_real

        ):



            return _error(

                "Attachment file does not exist",

                404

            )





        # =================================================

        # SEND FILE

        # =================================================



        return send_file(

            file_real,



            mimetype=(

                mime_type

                or "application/octet-stream"

            ),



            as_attachment=False,



            download_name=original_name

        )





    except Exception as e:



        return _error(

            str(e)

        )





    finally:



        if conn:



            conn.close()
