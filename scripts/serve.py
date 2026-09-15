"""Development-only static server with caching disabled."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


if __name__ == '__main__':
    address = ('127.0.0.1', 8080)
    print(f'VCF Communication Matrix: http://{address[0]}:{address[1]}/', flush=True)
    print('The Path diagram is the default view. Press Ctrl+C to stop.', flush=True)
    ThreadingHTTPServer(address, NoCacheHandler).serve_forever()
