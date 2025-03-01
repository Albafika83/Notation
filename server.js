const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Créer un serveur HTTP basique pour servir les fichiers statiques
const server = http.createServer((req, res) => {
    // Ajouter les en-têtes CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Upgrade, Connection');
    res.setHeader('Access-Control-Max-Age', '86400');

    // Gérer les requêtes OPTIONS pour CORS
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Route spécifique pour les WebSockets
    if (req.url === '/ws') {
        if (req.headers.upgrade && req.headers.upgrade.toLowerCase() === 'websocket') {
            console.log('Requête WebSocket sur /ws - sera gérée par le serveur WebSocket');
            return;
        } else {
            // Si quelqu'un accède à /ws sans WebSocket, renvoyer une réponse informative
            res.writeHead(400);
            res.end('Cette route est réservée aux connexions WebSocket');
            return;
        }
    }

    // Gérer les requêtes WebSocket sur d'autres routes
    if (req.headers.upgrade && req.headers.upgrade.toLowerCase() === 'websocket') {
        console.log('Requête de mise à niveau WebSocket détectée sur:', req.url);
        return;
    }

    // Traiter les requêtes HTTP normales
    let parsedUrl = url.parse(req.url, true);
    let filePath = '.' + parsedUrl.pathname;
    if (filePath === './') {
        filePath = './index.html';
    } else if (filePath === './admin') {
        filePath = './admin.html';
    } else if (filePath === './evaluation') {
        filePath = './evaluation.html';
    } else if (filePath === './notes') {
        filePath = './notes.html';
    }

    const extname = path.extname(filePath);
    let contentType = 'text/html';
    switch (extname) {
        case '.js':
            contentType = 'text/javascript';
            break;
        case '.css':
            contentType = 'text/css';
            break;
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('Fichier non trouvé');
            } else {
                res.writeHead(500);
                res.end('Erreur serveur: ' + err.code);
            }
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

// Stocker les assignations actuelles
const assignations = {};
const evaluations = {};  // Nouvelle variable pour stocker les évaluations

// Stocker les données d'administration
let adminData = {
    classes: {}
};

// Charger les données d'administration initiales (si elles existent)
try {
    if (fs.existsSync('./admin_data.json')) {
        const data = fs.readFileSync('./admin_data.json', 'utf8');
        adminData = JSON.parse(data);
        console.log('Données d\'administration chargées avec succès');
    } else {
        console.log('Aucun fichier de données d\'administration trouvé, utilisation des valeurs par défaut');
    }
} catch (err) {
    console.error('Erreur lors du chargement des données d\'administration:', err);
}

// Créer le serveur WebSocket avec gestion des en-têtes
const wss = new WebSocket.Server({ 
    noServer: true // Important: ne pas attacher directement au serveur
});

// Gérer manuellement les mises à niveau WebSocket
server.on('upgrade', (request, socket, head) => {
    console.log('Événement de mise à niveau détecté:', {
        url: request.url,
        method: request.method
    });

    // Vérifier si c'est une requête WebSocket valide
    if (!request.headers.upgrade || request.headers.upgrade.toLowerCase() !== 'websocket') {
        console.log('Requête de mise à niveau non valide, fermeture du socket');
        socket.destroy();
        return;
    }

    // Gérer la mise à niveau WebSocket
    wss.handleUpgrade(request, socket, head, (ws) => {
        console.log('Mise à niveau WebSocket réussie, émission de l\'événement de connexion');
        wss.emit('connection', ws, request);
    });
});

// Fonction pour générer le fichier eleves.html à partir des données d'administration
function genererFichierEleves() {
    let contenuHTML = `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Listes des Élèves</title>
</head>
<body>
`;

    // Générer le contenu pour chaque classe
    Object.entries(adminData.classes).forEach(([classeId, classe]) => {
        contenuHTML += `    <!-- Liste des élèves de la ${classe.nom} -->\n`;
        contenuHTML += `    <div id="${classeId}">\n`;
        contenuHTML += `        <h2>${classe.nom}</h2>\n`;
        
        // Dans cette nouvelle version, nous n'assignons plus automatiquement les élèves à des groupes
        // Tous les élèves sont disponibles pour chaque groupe
        if (classe.eleves && classe.eleves.length > 0) {
            // Groupe 1 - contient tous les élèves
            contenuHTML += `        <div class="groupe" data-groupe-id="groupe-1">\n`;
            contenuHTML += `            <h3>Groupe 1</h3>\n`;
            contenuHTML += `            <ul>\n`;
            classe.eleves.forEach(eleve => {
                contenuHTML += `                <li>${eleve}</li>\n`;
            });
            contenuHTML += `            </ul>\n`;
            contenuHTML += `        </div>\n`;
            
            // Groupe 2 - contient aussi tous les élèves
            contenuHTML += `        <div class="groupe" data-groupe-id="groupe-2">\n`;
            contenuHTML += `            <h3>Groupe 2</h3>\n`;
            contenuHTML += `            <ul>\n`;
            classe.eleves.forEach(eleve => {
                contenuHTML += `                <li>${eleve}</li>\n`;
            });
            contenuHTML += `            </ul>\n`;
            contenuHTML += `        </div>\n`;
        }
        
        contenuHTML += `    </div>\n\n`;
    });

    contenuHTML += `</body>
</html>`;

    // Écrire le fichier
    fs.writeFile('./eleves.html', contenuHTML, 'utf8', (err) => {
        if (err) {
            console.error('Erreur lors de l\'écriture du fichier eleves.html:', err);
            return;
        }
        console.log('Fichier eleves.html généré avec succès');
    });
}

// Sauvegarder les données d'administration dans un fichier JSON
function sauvegarderDonneesAdmin() {
    fs.writeFile('./admin_data.json', JSON.stringify(adminData, null, 2), 'utf8', (err) => {
        if (err) {
            console.error('Erreur lors de la sauvegarde des données d\'administration:', err);
            return;
        }
        console.log('Données d\'administration sauvegardées avec succès');
    });
}

// Gérer les connexions WebSocket
wss.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress;
    const clientUrl = req.url;
    console.log(`Nouvelle connexion client établie depuis: ${ip}, URL: ${clientUrl}`);

    // Envoyer les données d'administration au nouveau client
    ws.send(JSON.stringify({ type: 'ADMIN_DATA', data: adminData }));

    // Gérer les messages reçus
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('Message reçu:', data);

            // Gérer les différents types de messages
            switch (data.type) {
                case 'ADMIN_UPDATE':
                    console.log('Mise à jour des données d\'administration reçue');
                    adminData = data.adminData;
                    sauvegarderDonneesAdmin();
                    genererFichierEleves();
                    // Diffuser la mise à jour à tous les clients
                    broadcastToAll({ type: 'ADMIN_DATA', data: adminData });
                    // Confirmer la mise à jour au client
                    ws.send(JSON.stringify({
                        type: 'ADMIN_UPDATE_CONFIRM',
                        success: true
                    }));
                    break;
                
                case 'IMPORT_CSV':
                    console.log('Importation CSV reçue');
                    // Traiter les données CSV
                    processCSVData(data.csvData);
                    // Sauvegarder les données d'administration
                    sauvegarderDonneesAdmin();
                    // Générer le fichier eleves.html
                    genererFichierEleves();
                    // Diffuser la mise à jour à tous les clients
                    broadcastToAll({ type: 'ADMIN_DATA', data: adminData });
                    // Confirmer l'importation au client
                    ws.send(JSON.stringify({
                        type: 'IMPORT_CSV_CONFIRM',
                        success: true
                    }));
                    break;
                
                case 'GET_ASSIGNMENTS':
                    console.log('Demande d\'assignations reçue pour', data.classe, data.groupe);
                    const classAssignments = assignations[data.classe] || {};
                    const groupAssignments = classAssignments[data.groupe] || {};
                    const classEvaluations = evaluations[data.classe] || {};
                    const groupEvaluations = classEvaluations[data.groupe] || {};
                    ws.send(JSON.stringify({
                        type: 'INIT',
                        classe: data.classe,
                        groupe: data.groupe,
                        assignations: groupAssignments,
                        evaluations: groupEvaluations
                    }));
                    break;
                
                case 'UPDATE':
                    console.log('Mise à jour reçue pour', data.classe, data.groupe);
                    
                    // Vérifier que les données d'assignation sont présentes
                    if (data.assignations) {
                        let updates = {};
                        let rejectedUpdates = {};
                        
                        // Pour chaque assignation reçue, vérifier si l'élève est déjà assigné dans un autre groupe
                        Object.entries(data.assignations).forEach(([seatId, eleve]) => {
                            // Si l'élève est vide (suppression d'assignation), on l'accepte toujours
                            if (!eleve) {
                                updates[seatId] = eleve;
                                return;
                            }
                            
                            // Vérifier si l'élève est déjà assigné dans un autre groupe
                            let dejaAssigne = false;
                            
                            if (assignations[data.classe]) {
                                Object.entries(assignations[data.classe]).forEach(([groupe, groupeAssignations]) => {
                                    // Ne pas vérifier dans le groupe actuel
                                    if (groupe !== data.groupe) {
                                        // Vérifier si l'élève est déjà dans ce groupe
                                        if (Object.values(groupeAssignations).includes(eleve)) {
                                            dejaAssigne = true;
                                            console.log(`L'élève ${eleve} est déjà assigné dans le groupe ${groupe}`);
                                        }
                                    }
                                });
                            }
                            
                            // Si l'élève est déjà assigné ailleurs, rejeter cette mise à jour
                            if (dejaAssigne) {
                                rejectedUpdates[seatId] = eleve;
                            } else {
                                // Sinon, accepter la mise à jour
                                updates[seatId] = eleve;
                            }
                        });
                        
                        // Mettre à jour les assignations avec les mises à jour acceptées
                        if (!assignations[data.classe]) {
                            assignations[data.classe] = {};
                        }
                        if (!assignations[data.classe][data.groupe]) {
                            assignations[data.classe][data.groupe] = {};
                        }
                        
                        // Appliquer les mises à jour acceptées
                        assignations[data.classe][data.groupe] = { 
                            ...assignations[data.classe][data.groupe], 
                            ...updates 
                        };
                        
                        // Diffuser la mise à jour aux autres clients
                        broadcastToOthers(ws, {
                            type: 'UPDATE',
                            classe: data.classe,
                            groupe: data.groupe,
                            assignations: updates
                        });
                        
                        // Si certaines mises à jour ont été rejetées, en informer le client demandeur
                        if (Object.keys(rejectedUpdates).length > 0) {
                            ws.send(JSON.stringify({
                                type: 'UPDATE_REJECTED',
                                classe: data.classe,
                                groupe: data.groupe,
                                rejectedAssignations: rejectedUpdates,
                                message: "Certains élèves sont déjà assignés dans d'autres groupes."
                            }));
                        }
                    }
                    
                    // Mettre à jour les évaluations comme avant
                    if (data.evaluations) {
                        if (!evaluations[data.classe]) {
                            evaluations[data.classe] = {};
                        }
                        if (!evaluations[data.classe][data.groupe]) { 
                            evaluations[data.classe][data.groupe] = {};
                        }
                        evaluations[data.classe][data.groupe] = {
                            ...evaluations[data.classe][data.groupe],
                            ...data.evaluations
                        };
                        
                        // Diffuser la mise à jour des évaluations
                        broadcastToOthers(ws, {
                            type: 'UPDATE',
                            classe: data.classe,
                            groupe: data.groupe,
                            evaluations: data.evaluations
                        });
                    }
                    break;
                
                case 'IMPORT_STUDENTS':
                    console.log('Importation d\'élèves reçue pour la classe:', data.classeId);
                    if (data.classeId && adminData.classes[data.classeId] && Array.isArray(data.eleves)) {
                        // Ajouter les élèves à la classe
                        adminData.classes[data.classeId].eleves = data.eleves;
                        // Sauvegarder les données d'administration
                        sauvegarderDonneesAdmin();
                        // Générer le fichier eleves.html
                        genererFichierEleves();
                        // Diffuser la mise à jour à tous les clients
                        broadcastToAll({ type: 'ADMIN_DATA', data: adminData });
                        // Confirmer l'importation au client
                        ws.send(JSON.stringify({
                            type: 'IMPORT_STUDENTS_CONFIRM',
                            success: true,
                            message: `${data.eleves.length} élèves importés avec succès.`
                        }));
                    } else {
                        ws.send(JSON.stringify({
                            type: 'IMPORT_STUDENTS_CONFIRM',
                            success: false,
                            message: 'Données d\'importation invalides.'
                        }));
                    }
                    break;
                
                case 'ADD_CLASS':
                    console.log('Ajout de classe reçu:', data.nom);
                    if (data.nom) {
                        // Créer un ID de classe à partir du nom (en minuscules, sans espaces)
                        const classeId = 'classe-' + data.nom.toLowerCase().replace(/\s+/g, '-');
                        
                        // Créer la classe si elle n'existe pas
                        adminData.classes[classeId] = {
                            nom: data.nom,
                            eleves: []
                        };
                        
                        // Sauvegarder les données d'administration
                        sauvegarderDonneesAdmin();
                        // Générer le fichier eleves.html
                        genererFichierEleves();
                        // Diffuser la mise à jour à tous les clients
                        broadcastToAll({ type: 'ADMIN_DATA', data: adminData });
                    }
                    break;
                
                case 'DELETE_CLASS':
                    console.log('Suppression de classe reçue:', data.classeId);
                    if (data.classeId && adminData.classes[data.classeId]) {
                        // Supprimer la classe
                        delete adminData.classes[data.classeId];
                        
                        // Sauvegarder les données d'administration
                        sauvegarderDonneesAdmin();
                        // Générer le fichier eleves.html
                        genererFichierEleves();
                        // Diffuser la mise à jour à tous les clients
                        broadcastToAll({ type: 'ADMIN_DATA', data: adminData });
                    }
                    break;
                
                case 'CLEAR_CLASS_STUDENTS':
                    console.log('Vidage des élèves de la classe reçu:', data.classeId);
                    if (data.classeId && adminData.classes[data.classeId]) {
                        // Vider la liste des élèves de la classe
                        adminData.classes[data.classeId].eleves = [];
                        
                        // Sauvegarder les données d'administration
                        sauvegarderDonneesAdmin();
                        // Générer le fichier eleves.html
                        genererFichierEleves();
                        // Diffuser la mise à jour à tous les clients
                        broadcastToAll({ type: 'ADMIN_DATA', data: adminData });
                        
                        // Confirmer l'opération au client
                        ws.send(JSON.stringify({
                            type: 'CLEAR_STUDENTS_CONFIRM',
                            success: true,
                            message: 'Tous les élèves ont été supprimés de la classe.'
                        }));
                    } else {
                        ws.send(JSON.stringify({
                            type: 'CLEAR_STUDENTS_CONFIRM',
                            success: false,
                            message: 'Classe non trouvée.'
                        }));
                    }
                    break;
                
                case 'RESET_ASSIGNMENTS':
                    console.log('Réinitialisation des assignations reçue pour', data.classe, data.groupe);
                    // Réinitialiser les assignations
                    if (assignations[data.classe] && assignations[data.classe][data.groupe]) {
                        assignations[data.classe][data.groupe] = {};
                        console.log('Assignations réinitialisées pour', data.classe, data.groupe);
                    }
                    
                    // Réinitialiser les évaluations si demandé
                    if (data.resetEvaluations && evaluations[data.classe] && evaluations[data.classe][data.groupe]) {
                        evaluations[data.classe][data.groupe] = {};
                        console.log('Évaluations réinitialisées pour', data.classe, data.groupe);
                    }
                    
                    // Diffuser la mise à jour aux autres clients
                    broadcastToAll({
                        type: 'INIT',
                        classe: data.classe,
                        groupe: data.groupe,
                        assignations: {},
                        evaluations: {}  // Toujours envoyer un objet vide pour les évaluations lors d'une réinitialisation
                    });
                    break;
                
                case 'IMPORT_CLASSES_WITH_STUDENTS':
                    console.log('Importation de classes avec élèves reçue');
                    if (data.classes && typeof data.classes === 'object') {
                        let classesCreees = 0;
                        let elevesImportes = 0;
                        
                        // Traiter chaque classe
                        Object.entries(data.classes).forEach(([classeNom, eleves]) => {
                            if (Array.isArray(eleves) && eleves.length > 0) {
                                // Créer un ID de classe à partir du nom
                                const classeId = 'classe-' + classeNom.toLowerCase().replace(/\s+/g, '-');
                                
                                // Vérifier si la classe existe déjà
                                if (!adminData.classes[classeId]) {
                                    // Créer la classe
                                    adminData.classes[classeId] = {
                                        nom: classeNom,
                                        eleves: []
                                    };
                                    classesCreees++;
                                }
                                
                                // Ajouter les élèves à la classe
                                adminData.classes[classeId].eleves = eleves;
                                elevesImportes += eleves.length;
                            }
                        });
                        
                        // Sauvegarder les données d'administration
                        sauvegarderDonneesAdmin();
                        // Générer le fichier eleves.html
                        genererFichierEleves();
                        // Diffuser la mise à jour à tous les clients
                        broadcastToAll({ type: 'ADMIN_DATA', data: adminData });
                        
                        // Confirmer l'importation au client
                        ws.send(JSON.stringify({
                            type: 'IMPORT_CLASSES_CONFIRM',
                            success: true,
                            message: `${classesCreees} classes créées, ${elevesImportes} élèves importés avec succès.`
                        }));
                    } else {
                        ws.send(JSON.stringify({
                            type: 'IMPORT_CLASSES_CONFIRM',
                            success: false,
                            message: 'Données d\'importation invalides.'
                        }));
                    }
                    break;
                
                case 'ADD_STUDENT':
                    console.log('Ajout d\'élève reçu pour la classe:', data.classeId);
                    if (data.classeId && adminData.classes[data.classeId] && data.nomEleve) {
                        // Vérifier si l'élève existe déjà
                        const eleveExiste = adminData.classes[data.classeId].eleves && 
                                          adminData.classes[data.classeId].eleves.includes(data.nomEleve);
                        
                        if (eleveExiste) {
                            // Informer que l'élève existe déjà
                            ws.send(JSON.stringify({
                                type: 'ADD_STUDENT_CONFIRM',
                                success: false,
                                message: 'Cet élève existe déjà dans cette classe.'
                            }));
                        } else {
                            // Initialiser le tableau des élèves s'il n'existe pas
                            if (!adminData.classes[data.classeId].eleves) {
                                adminData.classes[data.classeId].eleves = [];
                            }
                            
                            // Ajouter l'élève à la classe
                            adminData.classes[data.classeId].eleves.push(data.nomEleve);
                            
                            // Sauvegarder les données d'administration
                            sauvegarderDonneesAdmin();
                            // Générer le fichier eleves.html
                            genererFichierEleves();
                            // Diffuser la mise à jour à tous les clients
                            broadcastToAll({ type: 'ADMIN_DATA', data: adminData });
                            
                            // Confirmer l'ajout au client
                            ws.send(JSON.stringify({
                                type: 'ADD_STUDENT_CONFIRM',
                                success: true,
                                message: 'Élève ajouté avec succès.'
                            }));
                        }
                    } else {
                        ws.send(JSON.stringify({
                            type: 'ADD_STUDENT_CONFIRM',
                            success: false,
                            message: 'Données d\'ajout invalides.'
                        }));
                    }
                    break;
                
                case 'DELETE_STUDENT':
                    console.log('Suppression d\'élève reçue pour la classe:', data.classeId, 'index:', data.index);
                    if (data.classeId && 
                        adminData.classes[data.classeId] && 
                        adminData.classes[data.classeId].eleves && 
                        typeof data.index === 'number' && 
                        data.index >= 0 && 
                        data.index < adminData.classes[data.classeId].eleves.length) {
                        
                        // Enregistrer le nom de l'élève pour le message de confirmation
                        const nomEleve = adminData.classes[data.classeId].eleves[data.index];
                        
                        // Supprimer l'élève de la classe
                        adminData.classes[data.classeId].eleves.splice(data.index, 1);
                        
                        // Sauvegarder les données d'administration
                        sauvegarderDonneesAdmin();
                        // Générer le fichier eleves.html
                        genererFichierEleves();
                        // Diffuser la mise à jour à tous les clients
                        broadcastToAll({ type: 'ADMIN_DATA', data: adminData });
                        
                        // Confirmer la suppression au client
                        ws.send(JSON.stringify({
                            type: 'DELETE_STUDENT_CONFIRM',
                            success: true,
                            message: `L'élève ${nomEleve} a été supprimé avec succès.`
                        }));
                    } else {
                        ws.send(JSON.stringify({
                            type: 'DELETE_STUDENT_CONFIRM',
                            success: false,
                            message: 'Données de suppression invalides ou élève non trouvé.'
                        }));
                    }
                    break;
                
                case 'GET_ALL_GROUP_ASSIGNMENTS':
                    console.log('Demande de toutes les assignations pour la classe:', data.classe);
                    
                    // Récupérer toutes les assignations pour cette classe
                    const allAssignments = {};
                    
                    // Parcourir tous les groupes de cette classe
                    if (assignations[data.classe]) {
                        // Pour chaque groupe, fusionner les assignations
                        Object.values(assignations[data.classe]).forEach(groupAssignments => {
                            Object.assign(allAssignments, groupAssignments);
                        });
                    }
                    
                    // Envoyer les assignations globales au client
                    ws.send(JSON.stringify({
                        type: 'ALL_GROUP_ASSIGNMENTS',
                        classe: data.classe,
                        assignations: allAssignments
                    }));
                    break;
                
                case 'GET_ALL_ASSIGNMENTS_GLOBAL':
                    console.log('Demande de toutes les assignations globales pour la classe:', data.classe);
                    
                    // Liste pour stocker tous les élèves assignés
                    const tousElevesAssignes = new Set();
                    
                    // Si la classe existe dans les assignations
                    if (assignations[data.classe]) {
                        // Pour chaque groupe
                        Object.entries(assignations[data.classe]).forEach(([groupe, groupeAssignations]) => {
                            // Pour chaque assignation dans ce groupe
                            Object.values(groupeAssignations).forEach(eleve => {
                                if (eleve) {
                                    tousElevesAssignes.add(eleve);
                                }
                            });
                        });
                    }
                    
                    // Envoyer la liste complète des élèves assignés
                    ws.send(JSON.stringify({
                        type: 'ALL_ASSIGNMENTS_GLOBAL',
                        classe: data.classe,
                        elevesAssignes: Array.from(tousElevesAssignes)
                    }));
                    break;
                
                default:
                    console.log('Type de message non reconnu:', data.type);
            }
        } catch (error) {
            console.error('Erreur lors du traitement du message:', error);
        }
    });

    // Gérer la déconnexion
    ws.on('close', (code, reason) => {
        console.log(`Client déconnecté. Code: ${code}, Raison: ${reason || 'Non spécifiée'}`);
    });

    // Gérer les erreurs
    ws.on('error', (error) => {
        console.error('Erreur WebSocket:', error);
    });
});

// Fonction pour traiter les données CSV
function processCSVData(csvData) {
    console.log('Début du traitement des données CSV:', csvData);
    
    // Réinitialiser les classes existantes
    adminData.classes = {};
    
    // Traiter chaque ligne du CSV
    csvData.forEach((row, index) => {
        console.log(`Traitement de la ligne ${index}:`, row);
        
        // Vérifier que row est un tableau avec au moins 2 éléments
        if (Array.isArray(row) && row.length >= 2) {
            const [nomPrenom, classeNom] = row;
            
            // Vérifier que les deux valeurs sont définies
            if (nomPrenom && classeNom) {
                // Créer un ID de classe à partir du nom (en minuscules, sans espaces)
                const classeId = 'classe-' + classeNom.toLowerCase().replace(/\s+/g, '-');
                
                // Créer la classe si elle n'existe pas
                if (!adminData.classes[classeId]) {
                    adminData.classes[classeId] = {
                        nom: classeNom,
                        eleves: []
                    };
                    console.log(`Nouvelle classe créée: ${classeNom} (ID: ${classeId})`);
                }
                
                // Ajouter l'élève à la classe
                adminData.classes[classeId].eleves.push(nomPrenom);
                console.log(`Élève ajouté: ${nomPrenom} à la classe ${classeNom}`);
            } else {
                console.warn(`Ligne CSV ${index} ignorée car incomplète:`, row);
            }
        } else {
            console.warn(`Ligne CSV ${index} ignorée car format invalide:`, row);
        }
    });
    
    console.log('Données CSV traitées, classes créées:', Object.keys(adminData.classes).length);
    if (Object.keys(adminData.classes).length > 0) {
        console.log('Détail des classes:');
        Object.entries(adminData.classes).forEach(([classeId, classe]) => {
            console.log(`- ${classe.nom}: ${classe.eleves.length} élèves`);
        });
    } else {
        console.warn('Aucune classe n\'a été créée à partir des données CSV.');
    }
}

// Gérer les erreurs du serveur WebSocket
wss.on('error', (error) => {
    console.error('Erreur du serveur WebSocket:', error);
});

// Fonction pour diffuser les mises à jour à tous les autres clients
function broadcastToOthers(sender, message) {
    wss.clients.forEach(client => {
        if (client !== sender && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}

// Fonction pour diffuser les mises à jour à tous les clients, y compris l'expéditeur
function broadcastToAll(message) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            console.log('Structure reçue du serveur:', message.assignations);
            console.log('Type de message.assignations:', typeof message.assignations);
            client.send(JSON.stringify(message));
        }
    });
}

// Générer le fichier eleves.html au démarrage
genererFichierEleves();

// Démarrer le serveur
// Utiliser le port fourni par Glitch ou 3000 par défaut
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
    console.log(`URL du serveur: http://localhost:${PORT}`);
    console.log(`URL WebSocket: ws://localhost:${PORT}/ws`);
});