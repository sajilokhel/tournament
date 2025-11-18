#!/bin/bash

echo ""
echo "🔍 Checking for ngrok tunnel..."
echo ""

URL=$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    tunnels = data.get('tunnels', [])
    if tunnels:
        for tunnel in tunnels:
            url = tunnel.get('public_url', '')
            if url.startswith('https://'):
                print(url)
                break
except:
    pass
")

if [ -z "$URL" ]; then
    echo "❌ No ngrok tunnel found!"
    echo ""
    echo "To start ngrok:"
    echo "  ngrok http 3000"
    echo ""
    echo "Then run this script again."
    echo ""
    exit 1
fi

echo "✅ YOUR NGROK HTTPS URL:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "$URL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📱 Open this on your mobile device"
echo "🎯 Location feature will work with HTTPS!"
echo ""
echo "📊 Dashboard: http://127.0.0.1:4040"
echo ""

# Also show QR code if qrencode is available
if command -v qrencode &> /dev/null; then
    echo "📱 QR Code (scan with mobile):"
    echo ""
    qrencode -t ansiutf8 "$URL"
    echo ""
fi
