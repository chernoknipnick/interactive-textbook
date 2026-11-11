"""Exercise account RLS in an isolated local PostgreSQL cluster.

Requires psycopg2 and PostgreSQL tools. Never connects to an existing database.
"""

from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import argparse
import socket
import subprocess
import tempfile

import psycopg2


parser = argparse.ArgumentParser()
parser.add_argument("--pg-bin", type=Path, required=True)
args = parser.parse_args()
scratch = Path(tempfile.gettempdir()).resolve()

with tempfile.TemporaryDirectory(prefix="textbook-db-check-", dir=scratch) as work:
    work = Path(work).resolve()
    assert work.parent == scratch
    data = work / "data"
    init = subprocess.run(
        [str(args.pg_bin / "initdb.exe"), "-D", str(data), "-U", "postgres",
         "-A", "trust", "--no-locale", "-E", "UTF8"],
        capture_output=True, text=True,
    )
    if init.returncode:
        raise RuntimeError(init.stdout + init.stderr)
    with socket.socket() as reserve:
        reserve.bind(("127.0.0.1", 0))
        port = reserve.getsockname()[1]
    subprocess.run(
        [str(args.pg_bin / "pg_ctl.exe"), "-D", str(data), "-l",
         str(work / "postgres.log"), "-o", f"-h 127.0.0.1 -p {port}", "-w", "start"],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=20,
    )
    try:
        def connection():
            database = psycopg2.connect(
                host="127.0.0.1", port=port, user="postgres", dbname="postgres", connect_timeout=5,
            )
            database.autocommit = True
            return database

        owner = connection()
        users = [f"00000000-0000-0000-0000-{number:012d}" for number in range(1, 5)]
        with owner.cursor() as cursor:
            cursor.execute("""
                CREATE ROLE anon NOLOGIN;
                CREATE ROLE authenticated NOLOGIN;
                CREATE SCHEMA auth;
                CREATE TABLE auth.users(id uuid primary key);
                CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
                  'SELECT nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
                GRANT USAGE ON SCHEMA auth TO anon,authenticated;
            """)
            cursor.executemany("INSERT INTO auth.users VALUES (%s)", [(uid,) for uid in users])
        migration = Path(__file__).with_name("001_accounts_and_groups.sql").read_text(encoding="utf-8")
        with owner.cursor() as cursor:
            cursor.execute(migration)
            cursor.execute("INSERT INTO textbook_teachers VALUES (%s),(%s)", users[:2])

        def call(user, query, params=()):
            database = connection()
            try:
                with database.cursor() as cursor:
                    cursor.execute("SET ROLE authenticated" if user else "SET ROLE anon")
                    if user:
                        cursor.execute("SELECT set_config('request.jwt.claim.sub',%s,false)", (user,))
                    cursor.execute(query, params)
                    return cursor.fetchall() if cursor.description else []
            finally:
                database.close()

        def denied(user, query, params=()):
            try:
                call(user, query, params)
            except psycopg2.Error:
                return
            raise AssertionError("Unexpected permission for " + query)

        teacher1, teacher2, student1, student2 = users
        for uid, name in zip(users, ["Teacher One", "Teacher Two", "Student One", "Student Two"]):
            call(uid, "SELECT textbook_save_profile(%s)", (name,))
        group = call(teacher1, "SELECT textbook_create_group('Group One')")[0][0]
        code = call(teacher1, "SELECT textbook_group_code(%s,false)", (group,))[0][0]
        assert len(code) == 32
        denied(None, "SELECT * FROM textbook_profiles")
        denied(None, "SELECT textbook_join_group(%s)", (code,))
        denied(student1, "INSERT INTO textbook_teachers VALUES (%s)", (student1,))
        denied(student1, "SELECT textbook_create_group('Student Owned')")
        denied(teacher2, "SELECT textbook_group_code(%s,false)", (group,))
        denied(student1, "SELECT textbook_group_code(%s,false)", (group,))
        assert call(student1, "SELECT id FROM textbook_groups") == []
        assert call(teacher2, "SELECT id FROM textbook_groups") == []
        with ThreadPoolExecutor(max_workers=2) as pool:
            list(pool.map(lambda _: call(student1, "SELECT textbook_join_group(%s)", (code,)), range(2)))
        call(student2, "SELECT textbook_join_group(%s)", (code,))
        assert len(call(teacher1, "SELECT user_id FROM textbook_memberships WHERE group_id=%s", (group,))) == 2
        assert len(call(student1, "SELECT user_id FROM textbook_memberships WHERE group_id=%s", (group,))) == 1
        assert call(student1, "SELECT user_id FROM textbook_profiles WHERE user_id=%s", (student2,)) == []
        assert len(call(teacher1, "SELECT user_id FROM textbook_profiles WHERE user_id=%s", (student2,))) == 1
        assert call(teacher2, "SELECT user_id FROM textbook_profiles WHERE user_id=%s", (student2,)) == []
        assert call(student1, "UPDATE textbook_groups SET name='Changed' WHERE id=%s RETURNING id", (group,)) == []
        denied(teacher1, "UPDATE textbook_groups SET owner_id=%s WHERE id=%s", (student1, group))
        denied(student1, "INSERT INTO textbook_memberships VALUES (%s,%s,now())", (group, student2))
        replacement = call(teacher1, "SELECT textbook_group_code(%s,true)", (group,))[0][0]
        assert replacement != code
        denied(student2, "SELECT textbook_join_group(%s)", (code,))
        call(teacher1, "DELETE FROM textbook_memberships WHERE group_id=%s AND user_id=%s", (group, student2))
        assert call(student2, "SELECT id FROM textbook_groups") == []
        with owner.cursor() as cursor:
            cursor.execute(migration)
        assert call(teacher1, "SELECT textbook_group_code(%s,false)", (group,))[0][0] == replacement
        assert len(call(teacher1, "SELECT user_id FROM textbook_memberships WHERE group_id=%s", (group,))) == 1
        feedback_migration = Path(__file__).with_name("002_feedback.sql").read_text(encoding="utf-8")
        with owner.cursor() as cursor:
            cursor.execute(feedback_migration)
        feedback_id = "10000000-0000-0000-0000-000000000001"
        send = "SELECT textbook_send_feedback(%s,%s,%s,%s,%s,%s)"
        values = (feedback_id, "unclear", "Please explain this example", "https://chernoknipnick.github.io/interactive-textbook/it/lecture-01.html", "Student demo", "")
        assert call(None, send, values)[0][0] == feedback_id
        call(None, send, values)
        denied(None, "SELECT * FROM textbook_feedback")
        assert call(student1, "SELECT id FROM textbook_feedback") == []
        assert call(teacher1, "SELECT id::text FROM textbook_feedback") == [(feedback_id,)]
        assert call(student1, "UPDATE textbook_feedback SET status='done' RETURNING id") == []
        denied(teacher1, "UPDATE textbook_feedback SET message='Changed message'")
        call(teacher1, "UPDATE textbook_feedback SET status='planned' WHERE id=%s", (feedback_id,))
        denied(None, send, (feedback_id, "idea", "A valid suggestion text", "https://example.com/", "", ""))
        denied(None, send, (feedback_id, "idea", "A valid suggestion text", "https://chernoknipnick.github.io/interactive-textbook/account/#access_token=bad", "", ""))
        denied(None, send, (feedback_id, "idea", "A valid suggestion text", "", "", "bot"))
        with owner.cursor() as cursor:
            cursor.execute(feedback_migration)
        assert call(teacher1, "SELECT status FROM textbook_feedback WHERE id=%s", (feedback_id,)) == [("planned",)]
        owner.close()
        print("Passed: account/group isolation, repeatable migrations, feedback submission/deduplication, private inbox and limited status updates.")
    finally:
        subprocess.run(
            [str(args.pg_bin / "pg_ctl.exe"), "-D", str(data), "-m", "immediate", "-w", "stop"],
            check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=20,
        )
