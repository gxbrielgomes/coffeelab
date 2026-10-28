#!/usr/bin/env python3
"""
CoffeeLab — servidor local.

Só usa a biblioteca padrão do Python (nada pra instalar).
- Serve o app (pasta public/)
- Guarda tudo num banco SQLite em data/coffeelab.db
- Faz backup automático do banco toda vez que inicia (data/backups/)
- Guarda as fotos em data/photos/

Rodar:  python3 server.py      (depois abra http://localhost:5173)
"""

import base64
import json
import mimetypes
import os
import re
import shutil
import sqlite3
import sys
import threading
import time
import uuid
import webbrowser
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, unquote

ROOT = os.path.dirname(os.path.abspath(__file__))
PUBLIC = os.path.join(ROOT, "public")
DATA = os.path.join(ROOT, "data")
PHOTOS = os.path.join(DATA, "photos")
BACKUPS = os.path.join(DATA, "backups")
DB_PATH = os.path.join(DATA, "coffeelab.db")

HOST = os.environ.get("COFFEELAB_HOST", "127.0.0.1")
PORT = int(os.environ.get("COFFEELAB_PORT", "5173"))
KEEP_BACKUPS = 30
MAX_BODY = 25 * 1024 * 1024  # 25 MB

COLLECTIONS = ("coffees", "bags", "brews", "equipment")

LOCK = threading.Lock()


# ---------------------------------------------------------------- utilidades

def now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def new_id():
    return uuid.uuid4().hex[:12]


def connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    os.makedirs(PHOTOS, exist_ok=True)
    os.makedirs(BACKUPS, exist_ok=True)
    conn = connect()
    with conn:
        for c in COLLECTIONS:
            conn.execute(
                "CREATE TABLE IF NOT EXISTS %s ("
                " id TEXT PRIMARY KEY,"
                " data TEXT NOT NULL,"
                " created_at TEXT NOT NULL,"
                " updated_at TEXT NOT NULL)" % c
            )
        conn.execute(
            "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)"
        )
    conn.close()


def backup_db():
    """Cópia consistente do banco, mantendo só os últimos KEEP_BACKUPS."""
    if not os.path.exists(DB_PATH):
        return
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    dest = os.path.join(BACKUPS, "coffeelab-%s.db" % stamp)
    src = sqlite3.connect(DB_PATH)
    dst = sqlite3.connect(dest)
    with dst:
        src.backup(dst)
    src.close()
    dst.close()
    files = sorted(f for f in os.listdir(BACKUPS) if f.endswith(".db"))
    for old in files[:-KEEP_BACKUPS]:
        try:
            os.remove(os.path.join(BACKUPS, old))
        except OSError:
            pass


def row_to_doc(row):
    doc = json.loads(row["data"])
    doc["id"] = row["id"]
    doc["created_at"] = row["created_at"]
    doc["updated_at"] = row["updated_at"]
    return doc


def all_docs(conn, coll):
    rows = conn.execute("SELECT * FROM %s ORDER BY created_at" % coll).fetchall()
    return [row_to_doc(r) for r in rows]


def get_doc(conn, coll, doc_id):
    row = conn.execute("SELECT * FROM %s WHERE id=?" % coll, (doc_id,)).fetchone()
    return row_to_doc(row) if row else None


def clean(doc):
    d = dict(doc)
    for k in ("id", "created_at", "updated_at"):
        d.pop(k, None)
    return d


def insert_doc(conn, coll, doc, created_at=None):
    doc_id = doc.get("id") or new_id()
    ts = now_iso()
    created = created_at or doc.get("created_at") or ts
    conn.execute(
        "INSERT INTO %s (id, data, created_at, updated_at) VALUES (?,?,?,?)" % coll,
        (doc_id, json.dumps(clean(doc), ensure_ascii=False), created, ts),
    )
    return get_doc(conn, coll, doc_id)


def update_doc(conn, coll, doc_id, patch):
    cur = get_doc(conn, coll, doc_id)
    if cur is None:
        return None
    merged = clean(cur)
    merged.update(clean(patch))
    created = patch.get("created_at") or cur["created_at"]
    conn.execute(
        "UPDATE %s SET data=?, updated_at=?, created_at=? WHERE id=?" % coll,
        (json.dumps(merged, ensure_ascii=False), now_iso(), created, doc_id),
    )
    return get_doc(conn, coll, doc_id)


def delete_doc(conn, coll, doc_id):
    conn.execute("DELETE FROM %s WHERE id=?" % coll, (doc_id,))


def get_settings(conn):
    rows = conn.execute("SELECT key, value FROM settings").fetchall()
    return {r["key"]: json.loads(r["value"]) for r in rows}


# ---------------------------------------------------------- estoque (sacos)

def num(v, default=0.0):
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def bag_queue(conn, coffee_id):
    """Sacos ainda com café: primeiro o aberto, depois os lacrados (mais antigo primeiro)."""
    bags = [b for b in all_docs(conn, "bags") if b.get("coffee_id") == coffee_id]
    alive = [b for b in bags if b.get("status") != "finished" and num(b.get("remaining_g")) > 0]
    alive.sort(key=lambda b: (0 if b.get("status") == "open" else 1, b.get("created_at", "")))
    return alive


def consume(conn, coffee_id, grams):
    """Desconta gramas dos sacos. Retorna (consumo por saco, sacos que acabaram, falta)."""
    left = round(num(grams), 2)
    used = []
    finished = []
    for bag in bag_queue(conn, coffee_id):
        if left <= 0:
            break
        rem = num(bag.get("remaining_g"))
        take = min(rem, left)
        rem = round(rem - take, 2)
        left = round(left - take, 2)
        patch = {"remaining_g": rem}
        if bag.get("status") != "open":
            patch["status"] = "open"
            patch["opened_at"] = now_iso()
        if rem <= 0:
            patch["status"] = "finished"
            patch["finished_at"] = now_iso()
            finished.append(bag["id"])
        update_doc(conn, "bags", bag["id"], patch)
        used.append({"bag_id": bag["id"], "g": take})
    # se acabou um saco, o próximo da fila "abre" automaticamente
    if finished:
        nxt = bag_queue(conn, coffee_id)
        if nxt and nxt[0].get("status") != "open":
            update_doc(conn, "bags", nxt[0]["id"], {"status": "open", "opened_at": now_iso()})
    return used, finished, max(left, 0)


def refund(conn, consumed):
    """Devolve as gramas de um preparo apagado/editado."""
    for c in consumed or []:
        bag = get_doc(conn, "bags", c.get("bag_id"))
        if not bag:
            continue
        rem = round(num(bag.get("remaining_g")) + num(c.get("g")), 2)
        rem = min(rem, num(bag.get("size_g"), rem))
        patch = {"remaining_g": rem}
        if bag.get("status") == "finished" and rem > 0:
            patch["status"] = "open"
            patch["finished_at"] = None
        update_doc(conn, "bags", bag["id"], patch)


# ------------------------------------------------------------------ fotos

DATAURL_RE = re.compile(r"^data:image/(png|jpe?g|webp|gif);base64,(.+)$", re.S)


def save_photo(data_url):
    m = DATAURL_RE.match(data_url or "")
    if not m:
        raise ValueError("Imagem inválida")
    ext = "jpg" if m.group(1) in ("jpg", "jpeg") else m.group(1)
    raw = base64.b64decode(m.group(2))
    name = "%s-%s.%s" % (datetime.now().strftime("%Y%m%d%H%M%S"), new_id()[:6], ext)
    with open(os.path.join(PHOTOS, name), "wb") as f:
        f.write(raw)
    return "/photos/" + name


# ------------------------------------------------------------------ HTTP

class Handler(BaseHTTPRequestHandler):
    server_version = "CoffeeLab/1.0"

    def log_message(self, fmt, *args):
        if "/api/" in (args[0] if args else ""):
            sys.stderr.write("  %s\n" % (fmt % args))

    # -- respostas
    def send_json(self, obj, status=200, extra_headers=None):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for k, v in (extra_headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def send_error_json(self, status, msg):
        self.send_json({"error": msg}, status)

    def read_json(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length > MAX_BODY:
            raise ValueError("Arquivo grande demais")
        raw = self.rfile.read(length) if length else b"{}"
        return json.loads(raw.decode("utf-8") or "{}")

    def send_file(self, path):
        if not os.path.isfile(path):
            self.send_error_json(404, "Não encontrado")
            return
        ctype = mimetypes.guess_type(path)[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype in ("application/javascript", "application/json"):
            ctype += "; charset=utf-8"
        with open(path, "rb") as f:
            body = f.read()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(body)

    # -- roteamento
    def route(self, method):
        path = unquote(urlparse(self.path).path)
        if not path.startswith("/api/"):
            if method != "GET":
                return self.send_error_json(405, "Método não permitido")
            return self.static(path)
        parts = [p for p in path[len("/api/"):].split("/") if p]
        try:
            with LOCK:
                self.api(method, parts)
        except ValueError as e:
            self.send_error_json(400, str(e))
        except Exception as e:  # noqa
            import traceback
            traceback.print_exc()
            self.send_error_json(500, "Erro no servidor: %s" % e)

    def static(self, path):
        if path.startswith("/photos/"):
            name = os.path.basename(path)
            return self.send_file(os.path.join(PHOTOS, name))
        if path in ("", "/"):
            path = "/index.html"
        full = os.path.normpath(os.path.join(PUBLIC, path.lstrip("/")))
        if not full.startswith(PUBLIC):
            return self.send_error_json(403, "Proibido")
        if not os.path.exists(full):
            full = os.path.join(PUBLIC, "index.html")
        self.send_file(full)

    def do_GET(self):
        self.route("GET")

    def do_POST(self):
        self.route("POST")

    def do_PUT(self):
        self.route("PUT")

    def do_DELETE(self):
        self.route("DELETE")

    # -- API
    def api(self, method, parts):
        conn = connect()
        try:
            with conn:
                self._api(conn, method, parts)
        finally:
            conn.close()

    def _api(self, conn, method, parts):
        head = parts[0] if parts else ""
        rid = parts[1] if len(parts) > 1 else None
        sub = parts[2] if len(parts) > 2 else None

        if head == "state" and method == "GET":
            out = {c: all_docs(conn, c) for c in COLLECTIONS}
            out["settings"] = get_settings(conn)
            return self.send_json(out)

        if head == "settings" and method == "PUT":
            body = self.read_json()
            for k, v in body.items():
                conn.execute(
                    "INSERT INTO settings(key,value) VALUES(?,?) "
                    "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                    (k, json.dumps(v, ensure_ascii=False)),
                )
            return self.send_json(get_settings(conn))

        if head == "photos" and method == "POST":
            body = self.read_json()
            return self.send_json({"url": save_photo(body.get("data"))})

        if head == "export" and method == "GET":
            out = {c: all_docs(conn, c) for c in COLLECTIONS}
            out["settings"] = get_settings(conn)
            out["exported_at"] = now_iso()
            out["app"] = "coffeelab"
            fname = "coffeelab-backup-%s.json" % datetime.now().strftime("%Y-%m-%d")
            return self.send_json(out, extra_headers={
                "Content-Disposition": 'attachment; filename="%s"' % fname})

        if head == "import" and method == "POST":
            body = self.read_json()
            if body.get("app") != "coffeelab":
                raise ValueError("Esse arquivo não parece um backup do CoffeeLab")
            conn.commit()
            backup_db()
            for c in COLLECTIONS:
                conn.execute("DELETE FROM %s" % c)
                for d in body.get(c, []):
                    insert_doc(conn, c, d, d.get("created_at"))
            for k, v in (body.get("settings") or {}).items():
                conn.execute("INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)",
                             (k, json.dumps(v, ensure_ascii=False)))
            return self.send_json({"ok": True})

        # ----- cafés
        if head == "coffees":
            if method == "POST" and rid is None:
                body = self.read_json()
                bags = body.pop("bags", []) or []
                coffee = insert_doc(conn, "coffees", body)
                for i, b in enumerate(bags):
                    size = num(b.get("size_g"))
                    if size <= 0:
                        continue
                    insert_doc(conn, "bags", {
                        "coffee_id": coffee["id"],
                        "size_g": size,
                        "remaining_g": num(b.get("remaining_g"), size),
                        "price": b.get("price"),
                        "status": "open" if i == 0 else "sealed",
                        "opened_at": now_iso() if i == 0 else None,
                    })
                return self.send_json(coffee, 201)
            if method == "PUT" and rid and sub is None:
                doc = update_doc(conn, "coffees", rid, self.read_json())
                return self.send_json(doc) if doc else self.send_error_json(404, "Café não encontrado")
            if method == "DELETE" and rid:
                for b in all_docs(conn, "bags"):
                    if b.get("coffee_id") == rid:
                        delete_doc(conn, "bags", b["id"])
                delete_doc(conn, "coffees", rid)
                return self.send_json({"ok": True})
            if method == "POST" and rid and sub == "bags":
                body = self.read_json()
                size = num(body.get("size_g"))
                if size <= 0:
                    raise ValueError("Informe o tamanho do saco em gramas")
                has_open = any(b.get("status") == "open" for b in bag_queue(conn, rid))
                bag = insert_doc(conn, "bags", {
                    "coffee_id": rid,
                    "size_g": size,
                    "remaining_g": num(body.get("remaining_g"), size),
                    "price": body.get("price"),
                    "status": "sealed" if has_open else "open",
                    "opened_at": None if has_open else now_iso(),
                })
                return self.send_json(bag, 201)

        # ----- sacos
        if head == "bags" and rid:
            if method == "PUT":
                body = self.read_json()
                if "remaining_g" in body:
                    rem = max(num(body["remaining_g"]), 0)
                    body["remaining_g"] = rem
                    if rem <= 0 and body.get("status") is None:
                        body["status"] = "finished"
                        body["finished_at"] = now_iso()
                doc = update_doc(conn, "bags", rid, body)
                return self.send_json(doc) if doc else self.send_error_json(404, "Saco não encontrado")
            if method == "DELETE":
                delete_doc(conn, "bags", rid)
                return self.send_json({"ok": True})

        # ----- preparos
        if head == "brews":
            if method == "POST" and rid is None:
                body = self.read_json()
                coffee_id = body.get("coffee_id")
                if not get_doc(conn, "coffees", coffee_id or ""):
                    raise ValueError("Escolha um café")
                used, finished, short = consume(conn, coffee_id, body.get("dose_g"))
                body["consumed"] = used
                brew = insert_doc(conn, "brews", body)
                return self.send_json({"brew": brew, "finished_bags": finished, "short_g": short}, 201)
            if method == "PUT" and rid:
                body = self.read_json()
                cur = get_doc(conn, "brews", rid)
                if not cur:
                    return self.send_error_json(404, "Preparo não encontrado")
                finished, short = [], 0
                dose_changed = "dose_g" in body and num(body["dose_g"]) != num(cur.get("dose_g"))
                coffee_changed = "coffee_id" in body and body["coffee_id"] != cur.get("coffee_id")
                if dose_changed or coffee_changed:
                    refund(conn, cur.get("consumed"))
                    used, finished, short = consume(
                        conn, body.get("coffee_id", cur.get("coffee_id")),
                        body.get("dose_g", cur.get("dose_g")))
                    body["consumed"] = used
                brew = update_doc(conn, "brews", rid, body)
                return self.send_json({"brew": brew, "finished_bags": finished, "short_g": short})
            if method == "DELETE" and rid:
                cur = get_doc(conn, "brews", rid)
                if cur:
                    refund(conn, cur.get("consumed"))
                    delete_doc(conn, "brews", rid)
                return self.send_json({"ok": True})

        # ----- equipamentos
        if head == "equipment":
            if method == "POST" and rid is None:
                return self.send_json(insert_doc(conn, "equipment", self.read_json()), 201)
            if method == "PUT" and rid:
                doc = update_doc(conn, "equipment", rid, self.read_json())
                return self.send_json(doc) if doc else self.send_error_json(404, "Não encontrado")
            if method == "DELETE" and rid:
                delete_doc(conn, "equipment", rid)
                return self.send_json({"ok": True})

        self.send_error_json(404, "Rota não encontrada")


def main():
    init_db()
    backup_db()
    url = "http://localhost:%d" % PORT
    try:
        httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    except OSError:
        print("\n  A porta %d já está em uso — o CoffeeLab provavelmente já está aberto." % PORT)
        print("  Abrindo %s\n" % url)
        webbrowser.open(url)
        return
    print("\n  ☕  CoffeeLab rodando em %s" % url)
    print("  Dados em: %s" % DATA)
    print("  Para fechar: Ctrl + C\n")
    if "--no-browser" not in sys.argv:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n  Até o próximo café! ☕\n")
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
