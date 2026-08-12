import urllib.parse
from server import NemesisHandler

class MockHandler:
    def send_response(self, *args): pass
    def send_header(self, *args): pass
    def end_headers(self, *args): pass
    class WFile:
        def write(self, data):
            print("WROTE:", data)
    wfile = WFile()

h = MockHandler()
class MockUrl:
    query = "symbol=HUM-USDT"
NemesisHandler._handle_crypto_analysis(h, MockUrl())
