const WebSocket = require('ws');

const wsUrl = process.argv[2] || 'ws://localhost:8080/api/gemini/live';
const ws = new WebSocket(wsUrl);

console.log('Connecting to', wsUrl);

ws.on('open', () => {
    console.log('Connected to Proxy');

    // Wait for setup complete
    setTimeout(() => {
        console.log('\n--- Sending Text Query ---');
        ws.send(JSON.stringify({
            clientContent: {
                turns: [{
                    role: 'user',
                    parts: [{ text: 'Hello Gemini! What can you see?' }]
                }],
                turnComplete: true
            }
        }));
    }, 2000);
});

ws.on('message', (data) => {
    const message = data.toString();
    console.log('Received:', message.substring(0, 200) + (message.length > 200 ? '...' : ''));
});

ws.on('close', (code, reason) => {
    console.log(`Disconnected. Code: ${code}, Reason: ${reason}`);
});

ws.on('error', (err) => {
    console.error('WebSocket Error:', err);
});
