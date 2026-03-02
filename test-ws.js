import WebSocket from 'ws';

const ws = new WebSocket('wss://idexx-procyte-assistant-225213488414.us-central1.run.app/api/gemini/live');

ws.on('open', () => {
    console.log('Connected to remote proxy');
});

ws.on('message', (data) => {
    console.log('Received:', data.toString());
});

ws.on('close', (code, reason) => {
    console.log(`Connection closed: ${code} ${reason.toString()}`);
    process.exit(0);
});

ws.on('error', (err) => {
    console.error('Connection error:', err);
    process.exit(1);
});
