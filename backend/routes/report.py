import io
from datetime import datetime

from flask import Blueprint, jsonify, request, send_file
from openpyxl import Workbook
from openpyxl.styles import Font

from database import get_connection

report_bp = Blueprint("report", __name__)


def _err(message, code=500):
    return jsonify({"status": "error", "message": message}), code


def _f(v):
    return float(v or 0)


def _date(v):
    return v.strftime("%d/%m/%Y") if v else ""


def _filters(args):
    where, p = ["1=1"], {}

    q = (args.get("q") or "").strip()
    if q:
        where.append(
            "(UPPER(p.CLIENT_NAME) LIKE UPPER(:q) OR UPPER(p.COMPANY_NAME) "
            "LIKE UPPER(:q) OR UPPER(p.BDE_NAME) LIKE UPPER(:q))"
        )
        p["q"] = f"%{q}%"

    status = (args.get("status") or "").strip()
    if status:
        where.append("p.PAYMENT_STATUS = :pstatus")
        p["pstatus"] = status

    for key, bind, sql in (
        ("from", "dfrom", "p.PAYMENT_DATE >= TO_DATE(:dfrom, 'YYYY-MM-DD')"),
        ("to", "dto", "p.PAYMENT_DATE < TO_DATE(:dto, 'YYYY-MM-DD') + 1"),
    ):
        val = (args.get(key) or "").strip()
        if val:
            datetime.strptime(val, "%Y-%m-%d")  # ValueError if invalid
            where.append(sql)
            p[bind] = val

    return " AND ".join(where), p


LIST_SQL = """
    SELECT p.PAYMENT_ID, p.PAYMENT_DATE, p.BDE_NAME, p.BDE_PAN, p.CLIENT_NAME,
           p.COMPANY_NAME, p.TOTAL_AMOUNT, p.RECEIVED_AMOUNT,
           p.BALANCE_AMOUNT, p.PAYMENT_STATUS,
           (SELECT LISTAGG(s.SERVICE_NAME, ', ')
                   WITHIN GROUP (ORDER BY s.SERVICE_NAME)
              FROM YUGEM_PAYMENT_SERVICES s
             WHERE s.PAYMENT_ID = p.PAYMENT_ID) AS SERVICES
      FROM YUGEM_PAYMENTS p
     WHERE {where}
     ORDER BY p.PAYMENT_ID DESC
"""


@report_bp.route("/api/payment-entries", methods=["GET"])
def list_entries():
    conn = None
    try:
        where, p = _filters(request.args)
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM (" + LIST_SQL.format(where=where) + ") WHERE ROWNUM <= 500", p
        )
        entries = [
            {
                "payment_id": r[0],
                "payment_date": _date(r[1]),
                "bde_name": r[2],
                "bde_pan": r[3],
                "client_name": r[4],
                "company_name": r[5],
                "total_amount": _f(r[6]),
                "received_amount": _f(r[7]),
                "balance_amount": _f(r[8]),
                "payment_status": r[9],
                "services": r[10] or "",
            }
            for r in cur.fetchall()
        ]
        return jsonify({"status": "success", "entries": entries})
    except ValueError:
        return _err("Invalid date filter", 400)
    except Exception as e:
        return _err(str(e))
    finally:
        if conn:
            conn.close()


@report_bp.route("/api/payment-entries/<int:payment_id>", methods=["GET"])
def entry_detail(payment_id):
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT p.PAYMENT_ID, p.PAYMENT_DATE, p.PAYMENT_TIME, p.BDE_NAME,
                   p.BDE_PAN, p.EMPLOYEE_ID, p.CLIENT_NAME, p.CLIENT_CONTACT,
                   p.CLIENT_EMAIL, p.COMPANY_NAME, p.COMPANY_TYPE,
                   p.PAYMENT_PERCENTAGE, p.GST_STATUS, p.GST_RATE,
                   p.TOTAL_AMOUNT, p.RECEIVED_AMOUNT, p.BASIC_AMOUNT,
                   p.GST_AMOUNT, p.BALANCE_AMOUNT, p.PAYMENT_STATUS,
                   p.REMARKS, b1.BDM_NAME, b2.BDM_NAME, b3.BDM_NAME
              FROM YUGEM_PAYMENTS p
              LEFT JOIN YUGEM_BDMS b1 ON b1.BDM_ID = p.BDM1_ID
              LEFT JOIN YUGEM_BDMS b2 ON b2.BDM_ID = p.BDM2_ID
              LEFT JOIN YUGEM_BDMS b3 ON b3.BDM_ID = p.BDM3_ID
             WHERE p.PAYMENT_ID = :pid
        """, {"pid": payment_id})
        r = cur.fetchone()
        if not r:
            return _err("Entry not found", 404)

        cur.execute(
            "SELECT SERVICE_NAME FROM YUGEM_PAYMENT_SERVICES "
            "WHERE PAYMENT_ID = :pid ORDER BY SERVICE_NAME",
            {"pid": payment_id},
        )
        services = [x[0] for x in cur.fetchall()]

        entry = {
            "payment_id": r[0],
            "date_time": f"{_date(r[1])} {r[2] or ''}".strip(),
            "bde_name": r[3],
            "bde_pan": r[4],
            "employee_id": r[5],
            "client_name": r[6],
            "contact": r[7],
            "email": r[8],
            "company_name": r[9],
            "company_type": r[10],
            "payment_terms": f"{int(r[11] or 0)}%",
            "gst_type": "GST Including" if r[12] == "included" else "GST Excluding",
            "gst_rate": _f(r[13]),
            "total_amount": _f(r[14]),
            "received_amount": _f(r[15]),
            "received_excl_gst": _f(r[16]),
            "gst_amount": _f(r[17]),
            "balance_amount": _f(r[18]),
            "payment_status": r[19],
            "remarks": r[20] or "",
            "bdms": [n for n in (r[21], r[22], r[23]) if n],
            "services": services,
        }
        return jsonify({"status": "success", "entry": entry})
    except Exception as e:
        return _err(str(e))
    finally:
        if conn:
            conn.close()


@report_bp.route("/api/reports/summary", methods=["GET"])
def summary():
    conn = None
    try:
        where, p = _filters(request.args)
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(f"""
            SELECT COUNT(*), NVL(SUM(p.TOTAL_AMOUNT), 0),
                   NVL(SUM(p.RECEIVED_AMOUNT), 0), NVL(SUM(p.GST_AMOUNT), 0),
                   NVL(SUM(p.BALANCE_AMOUNT), 0)
              FROM YUGEM_PAYMENTS p WHERE {where}
        """, p)
        t = cur.fetchone()
        totals = {
            "entries": t[0], "deal": _f(t[1]), "received": _f(t[2]),
            "gst": _f(t[3]), "balance": _f(t[4]),
        }

        cur.execute(f"""
            SELECT p.BDE_NAME, COUNT(*), NVL(SUM(p.TOTAL_AMOUNT), 0),
                   NVL(SUM(p.RECEIVED_AMOUNT), 0), NVL(SUM(p.BALANCE_AMOUNT), 0)
              FROM YUGEM_PAYMENTS p WHERE {where}
             GROUP BY p.BDE_NAME ORDER BY 3 DESC
        """, p)
        by_bde = [
            {"name": r[0], "count": r[1], "deal": _f(r[2]),
             "received": _f(r[3]), "balance": _f(r[4])}
            for r in cur.fetchall()
        ]

        cur.execute(f"""
            SELECT s.SERVICE_NAME, COUNT(*)
              FROM YUGEM_PAYMENT_SERVICES s
              JOIN YUGEM_PAYMENTS p ON p.PAYMENT_ID = s.PAYMENT_ID
             WHERE {where}
             GROUP BY s.SERVICE_NAME ORDER BY 2 DESC
        """, p)
        by_service = [{"name": r[0], "count": r[1]} for r in cur.fetchall()]

        cur.execute(f"""
            SELECT p.PAYMENT_STATUS, COUNT(*)
              FROM YUGEM_PAYMENTS p WHERE {where}
             GROUP BY p.PAYMENT_STATUS ORDER BY 2 DESC
        """, p)
        by_status = [{"name": r[0], "count": r[1]} for r in cur.fetchall()]

        return jsonify({
            "status": "success", "totals": totals, "by_bde": by_bde,
            "by_service": by_service, "by_status": by_status,
        })
    except ValueError:
        return _err("Invalid date filter", 400)
    except Exception as e:
        return _err(str(e))
    finally:
        if conn:
            conn.close()


@report_bp.route("/api/reports/export", methods=["GET"])
def export_excel():
    conn = None
    try:
        where, p = _filters(request.args)
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(LIST_SQL.format(where=where), p)
        rows = cur.fetchall()

        wb = Workbook()
        ws = wb.active
        ws.title = "Payments"
        headers = ["Payment ID", "Date", "BDE", "PAN", "Client", "Company", "Services",
                   "Total Deal", "Received (incl. GST)", "Remaining", "Status"]
        ws.append(headers)
        for c in ws[1]:
            c.font = Font(bold=True)

        for r in rows:
            ws.append([r[0], _date(r[1]), r[2], r[3] or "", r[4], r[5], r[10] or "",
                       _f(r[6]), _f(r[7]), _f(r[8]), r[9]])

        for col in ws.columns:
            width = max(len(str(c.value or "")) for c in col) + 2
            ws.column_dimensions[col[0].column_letter].width = min(width, 45)

        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        return send_file(
            buf,
            as_attachment=True,
            download_name=f"yugem_payments_{datetime.now():%Y%m%d_%H%M}.xlsx",
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    except ValueError:
        return _err("Invalid date filter", 400)
    except Exception as e:
        return _err(str(e))
    finally:
        if conn:
            conn.close()


@report_bp.route("/api/dashboard-data", methods=["GET"])
def dashboard_data():
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT COUNT(*),
                   NVL(SUM(CASE WHEN TRUNC(p.PAYMENT_DATE) = TRUNC(SYSDATE)
                                THEN 1 ELSE 0 END), 0),
                   NVL(SUM(p.TOTAL_AMOUNT), 0),
                   NVL(SUM(p.BALANCE_AMOUNT), 0)
              FROM YUGEM_PAYMENTS p
        """)
        t = cur.fetchone()

        cur.execute(
            "SELECT * FROM (" + LIST_SQL.format(where="1=1") + ") WHERE ROWNUM <= 7"
        )
        recent = [
            {
                "payment_id": r[0],
                "client_name": r[4],
                "company_name": r[5],
                "services": r[10] or "",
                "total_amount": _f(r[6]),
                "payment_status": r[9],
            }
            for r in cur.fetchall()
        ]

        return jsonify({
            "status": "success",
            "summary": {
                "total_payments": t[0],
                "today_entries": t[1],
                "total_amount": _f(t[2]),
                "pending_amount": _f(t[3]),
            },
            "recent": recent,
        })
    except Exception as e:
        return _err(str(e))
    finally:
        if conn:
            conn.close()