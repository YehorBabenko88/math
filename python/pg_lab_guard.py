"""Disposable PG18 test harness only; explicit operator approval and cluster identity."""
import os
import re

PORT = 25432
ROLES = {'math_experiment_owner': 'math_experiment_test',
         'math_experiment_host': 'math_experiment_test', 'memory_lab': 'scientific_memory_test'}
APPROVAL = 'MASTER_APPROVED_DISPOSABLE_PG18_25432'


def refuse():
    raise ValueError('PG_LAB_REFUSED')


def lab_environment(env=None):
    env = os.environ if env is None else env
    identity = env.get('MATH_PG_LAB_SYSTEM_ID')
    if (any(k.upper().startswith('PG') or k.upper() == 'NODE_PG_FORCE_NATIVE' for k in env)
            or env.get('MATH_PG_LAB_APPROVAL') != APPROVAL
            or type(identity) is not str or not re.fullmatch(r'[1-9][0-9]{0,19}', identity)
            or int(identity) > 18446744073709551615):
        refuse()
    return dict(env)


def lab_config(url, role, env=None):
    lab_environment(env)
    if type(role) is not str or role not in ROLES or type(url) is not str or len(url) > 512:
        refuse()
    m = re.fullmatch(r'postgresql://([a-z_]+):([A-Za-z0-9._~-]{1,128})@127\.0\.0\.1:25432/([a-z_]+)', url)
    if not m or m[1] != role or m[3] != ROLES[role]:
        refuse()
    return dict(host='127.0.0.1', hostaddr='127.0.0.1', port=PORT, dbname=ROLES[role], user=role,
                password=m[2], sslmode='disable', gssencmode='disable', connect_timeout=3)


def checked_conninfo(driver, url, role):
    from psycopg.conninfo import make_conninfo, conninfo_to_dict
    cfg = lab_config(url, role)
    info = make_conninfo(**cfg)
    if conninfo_to_dict(info) != {k: str(v) for k, v in cfg.items()}:
        refuse()
    return info


def connect_lab(driver, url, role, *, autocommit=False):
    env = lab_environment()
    cfg = lab_config(url, role)
    checked_conninfo(driver, url, role)
    c = None
    try:
        c = driver.connect(**cfg, autocommit=True)
        row = c.execute("SELECT pg_catalog.current_database(),current_user,session_user,pg_catalog.current_setting('server_version_num')::int,pg_catalog.host(pg_catalog.inet_server_addr()),pg_catalog.inet_server_port(),(SELECT system_identifier::text FROM pg_catalog.pg_control_system()),(SELECT r.rolsuper OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication OR r.rolbypassrls OR EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m WHERE m.member=r.oid) FROM pg_catalog.pg_roles r WHERE r.rolname=current_user)").fetchone()
        if (not row or row[:3] != (ROLES[role], role, role) or type(row[3]) is not int
                or not 180000 <= row[3] < 190000 or row[4:] != ('127.0.0.1', PORT, env['MATH_PG_LAB_SYSTEM_ID'], False)
                or row[7] is not False):
            refuse()
        c.autocommit = autocommit
        return c
    except Exception:
        if c is not None:
            try:
                c.close()
            except Exception:
                pass
        raise ValueError('PG_LAB_REFUSED') from None
