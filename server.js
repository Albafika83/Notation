const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

// Stocker les données partagées (assignations des sièges)
const sharedData = {};

wss.on('connection', (ws) => {
    console.log('Nouveau client connecté');

    // Envoyer les données actuelles au nouveau client
    ws.send(JSON.stringify({ type: 'INIT', data: sharedData }));

    // Écouter les messages du client
    ws.on('message', (message) => {
        const data = JSON.parse(message);

        // Mettre à jour les données partagées
        Object.assign(sharedData, data);

        // Diffuser les nouvelles données à tous les clients
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'UPDATE', data: sharedData }));
            }
        });
    });

    // Gérer la déconnexion du client
    ws.on('close', () => {
        console.log('Client déconnecté');
    });
});

console.log('Serveur WebSocket démarré sur ws://localhost:8080');