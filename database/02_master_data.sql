/* =========================================================
 YUGEM CRM - MASTER DATA
 Oracle Database 11g XE
 ========================================================= */
/* =========================================================
 1. BDE / USER
 ========================================================= */
INSERT INTO YUGEM_USERS (
        EMPLOYEE_ID,
        LOGIN_ID,
        PASSWORD_HASH,
        FULL_NAME,
        ROLE_NAME,
        CONTACT_NO,
        EMAIL,
        IS_ACTIVE
    )
VALUES (
        'YA001',
        'admin',
        'admin123',
        'BDE User',
        'BDE',
        NULL,
        NULL,
        'Y'
    );
/* =========================================================
 2. BDM MASTER DATA
 ========================================================= */
INSERT INTO YUGEM_BDMS (
        BDM_NAME,
        CONTACT_NO,
        EMAIL,
        IS_ACTIVE
    )
VALUES ('BDM 1', NULL, NULL, 'Y');
INSERT INTO YUGEM_BDMS (
        BDM_NAME,
        CONTACT_NO,
        EMAIL,
        IS_ACTIVE
    )
VALUES ('BDM 2', NULL, NULL, 'Y');
/* =========================================================
 3. SERVICES
 ========================================================= */
INSERT INTO YUGEM_SERVICES (
        SERVICE_NAME,
        DESCRIPTION,
        IS_ACTIVE
    )
VALUES (
        'Service 1',
        'Yugem Service 1',
        'Y'
    );
INSERT INTO YUGEM_SERVICES (
        SERVICE_NAME,
        DESCRIPTION,
        IS_ACTIVE
    )
VALUES (
        'Service 2',
        'Yugem Service 2',
        'Y'
    );
INSERT INTO YUGEM_SERVICES (
        SERVICE_NAME,
        DESCRIPTION,
        IS_ACTIVE
    )
VALUES (
        'Service 3',
        'Yugem Service 3',
        'Y'
    );
/* =========================================================
 4. SUB-SERVICES
 ========================================================= */
INSERT INTO YUGEM_SUB_SERVICES (
        SERVICE_ID,
        SUB_SERVICE_NAME,
        DESCRIPTION,
        IS_ACTIVE
    )
SELECT SERVICE_ID,
    'Sub Service 1',
    'Sub service 1',
    'Y'
FROM YUGEM_SERVICES
WHERE SERVICE_NAME = 'Service 1';
INSERT INTO YUGEM_SUB_SERVICES (
        SERVICE_ID,
        SUB_SERVICE_NAME,
        DESCRIPTION,
        IS_ACTIVE
    )
SELECT SERVICE_ID,
    'Sub Service 2',
    'Sub service 2',
    'Y'
FROM YUGEM_SERVICES
WHERE SERVICE_NAME = 'Service 1';
INSERT INTO YUGEM_SUB_SERVICES (
        SERVICE_ID,
        SUB_SERVICE_NAME,
        DESCRIPTION,
        IS_ACTIVE
    )
SELECT SERVICE_ID,
    'Sub Service 3',
    'Sub service 3',
    'Y'
FROM YUGEM_SERVICES
WHERE SERVICE_NAME = 'Service 2';
COMMIT;