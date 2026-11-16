from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit
ROOT=Path(__file__).resolve().parents[2]
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(ROOT/'build'),**kwargs)
    def do_GET(self):
        if urlsplit(self.path).path=='/account/supabase.js':
            data=(Path(__file__).with_name('account_fixture.js')).read_bytes()
            self.send_response(200);self.send_header('Content-Type','application/javascript; charset=utf-8');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
        else:super().do_GET()
def create_server(): return ThreadingHTTPServer(('127.0.0.1',0),Handler)
if __name__=='__main__':
    server=create_server()
    print('http://127.0.0.1:'+str(server.server_port),flush=True)
    server.serve_forever()
