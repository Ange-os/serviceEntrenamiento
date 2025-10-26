const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const qrcodeLib = require('qrcode');

const app = express();
const PORT = 3000;

app.use(express.json());

// Inicializar cliente de WhatsApp

const path = require('path');

let client;
let isReady = false;
let qrCode = null;
let qrCodeImage = null;

async function startWhatsAppClient() {
    try {
        console.log('🟢 Iniciando cliente de WhatsApp...');

        client = new Client({
            authStrategy: new LocalAuth({
                dataPath: path.join(__dirname, '.wwebjs_auth')
            }),
            puppeteer: {
                headless: true,
                executablePath: process.platform === 'win32' 
                    ? undefined  
                    : '/usr/bin/google-chrome-stable',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-gpu',
                    '--disable-dev-shm-usage',
                    '--single-process',
                    '--no-zygote'
                ]
            }
        });

        client.on('qr', (qr) => {
            console.log('🆕 Nuevo código QR recibido:');
            qrcode.generate(qr, { small: true });
            qrCode = qr;

            qrcodeLib.toDataURL(qr, { width: 300 }, (err, url) => {
                if (!err) qrCodeImage = url;
            });
        });

        client.on('authenticated', () => {
            console.log('🔐 Autenticado correctamente.');
        });

        client.on('auth_failure', (msg) => {
            console.error('❌ Fallo de autenticación:', msg);
            console.log('🧹 Eliminando sesión corrupta...');
            const fs = require('fs');
            const sessionPath = path.join(__dirname, '.wwebjs_auth');
            if (fs.existsSync(sessionPath)) {
                fs.rmSync(sessionPath, { recursive: true, force: true });
            }
            console.log('♻️ Reiniciando cliente...');
            startWhatsAppClient();
        });

        client.on('ready', () => {
            console.log('✅ Cliente de WhatsApp listo!');
            isReady = true;
            qrCode = null;
            qrCodeImage = null;
        });

        client.on('disconnected', (reason) => {
            console.log('⚠️ Cliente desconectado:', reason);
            isReady = false;
            qrCode = null;
            qrCodeImage = null;
            console.log('🔁 Reiniciando cliente...');
            startWhatsAppClient();
        });

        await client.initialize();
        console.log('🚀 WhatsApp inicializado correctamente.');
    } catch (err) {
        console.error('💥 Error crítico al iniciar WhatsApp:', err.message);
        console.log('⏳ Reintentando en 5 segundos...');
        setTimeout(startWhatsAppClient, 5000);
    }
}

function checkReady(req, res, next) {
    if (!isReady || !client) {
        return res.status(503).json({
            success: false,
            message: '❌ El cliente de WhatsApp aún no está listo. Escanea el código QR primero.'
        });
    }
    next();
}
// ENDPOINTS

// 0. Página web para escanear QR
app.get('/', (req, res) => {
    if (isReady) {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>WhatsApp API - Conectado</title>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        min-height: 100vh;
                        margin: 0;
                        background-color: #0f1115; 
                    }
                    .container {
                        background: #0f1115;
                        padding: 40px;
                        border-radius: 20px;
                        box-shadow: 0 10px 10px rgba(0, 255, 0, 1);
                        text-align: center;
                        max-width: 600px;
                        width: 90%;
                    }
                    h1 { color: #ffffffff; margin-bottom: 20px; }
                    .status { 
                        font-size: 18px; 
                        color: #ffffffff;
                        margin: 20px 0;
                    }
                    .checkmark {
                        font-size: 80px;
                        color: #25D366;
                    }
                    .endpoints {
                        text-align: left;
                        margin-top: 30px;
                        padding: 20px;
                        background: #000000ff;
                        border-radius: 10px;
                    }
                    .endpoint {
                        margin: 10px 0;
                        font-family: monospace;
                        font-size: 13px;
                        padding: 8px;
                        background: white;
                        border-radius: 5px;
                    }
                    .endpoint-desc {
                        color: #666;
                        font-size: 11px;
                        margin-top: 3px;
                    }
                    a { color: #128C7E; text-decoration: none; font-weight: bold; }
                    a:hover { text-decoration: underline; }
                </style>
                <script>
                    setTimeout(() => location.reload(), 10000);
                </script>
            </head>
            <body>
                <div class="container">
                    <div class="checkmark">✓</div>
                    <h1>WhatsApp Conectado</h1>
                    <div class="status">✅ API lista para recibir peticiones</div>
                    <div class="endpoints">
                        <div class="endpoint" style="background: #505050ff; border: 2px solid #ffc107; text-align:center;">
                        <button 
                            id="triggerN8nBtn"
                            style="background:#ffc107;color:#000;padding:10px 15px;border:none;border-radius:8px;cursor:pointer;font-weight:bold;">
                            🤖 Entrena tu bot con tus chats
                        </button>
                        <div id="n8nStatus" style="color:white;margin-top:8px;font-size:12px;"></div>
                    </div>

                    <script>
                    document.getElementById('triggerN8nBtn').addEventListener('click', async () => {
                        const statusEl = document.getElementById('n8nStatus');
                        statusEl.textContent = '⏳ Enviando datos al workflow...';
                        try {
                            const res = await fetch('/trigger-n8n', { method: 'POST' });
                            const data = await res.json();
                            if (data.success) {
                                statusEl.textContent = '✅ Workflow ejecutado correctamente en n8n';
                            } else {
                                statusEl.textContent = '⚠️ Error en la ejecución: ' + (data.error || 'Desconocido');
                            }
                        } catch (err) {
                            statusEl.textContent = '❌ Error de red: ' + err.message;
                        }
});
</script>
                    </div>
                </div>
            </body>
            </html>
        `);
    } else if (qrCodeImage) {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>WhatsApp API - Escanear QR</title>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        min-height: 100vh;
                        margin: 0;
                        background-color: #0f1115;
                    }
                    .container {
                        box-shadow: 0 10px 10px rgba(0, 255, 0, 1);
                        background: white;
                        padding: 40px;
                        border-radius: 20px;
                        text-align: center;
                        max-width: 500px;
                        width: 90%;
                    }
                    h1 { color: #128C7E; margin-bottom: 10px; }
                    .instructions {
                        color: #666;
                        margin: 20px 0;
                        line-height: 1.6;
                    }
                    .qr-container {
                        margin: 30px 0;
                        padding: 20px;
                        background: #000000ff;
                        border-radius: 10px;
                    }
                    img {
                        border: 5px solid #25D366;
                        border-radius: 10px;
                        max-width: 100%;
                        height: auto;
                    }
                    .steps {
                        text-align: left;
                        margin-top: 20px;
                        padding-left: 20px;
                    }
                    .steps li {
                        margin: 10px 0;
                        color: #555;
                    }
                    .loading {
                        margin-top: 20px;
                        color: #128C7E;
                        font-style: italic;
                    }
                </style>
                <script>
                    setTimeout(() => location.reload(), 3000);
                </script>
            </head>
            <body>
                <div class="container">
                    <h1>Entrena tu agente con WhatsApp</h1>
                    <div class="instructions">
                        Escanea este código QR con tu WhatsApp
                    </div>
                    <div class="qr-container">
                        <img src="${qrCodeImage}" alt="QR Code">
                    </div>
                    <div class="steps">
                        <strong>Pasos:</strong>
                        <ol>
                            <li>Abre WhatsApp en tu teléfono</li>
                            <li>Toca Menú o Configuración</li>
                            <li>Selecciona "Dispositivos vinculados"</li>
                            <li>Toca "Vincular un dispositivo"</li>
                            <li>Escanea este código QR</li>
                        </ol>
                    </div>
                    <div class="loading">⏳ Esperando conexión... (actualizando cada 3 seg)</div>
                </div>
                <script>
                // Revisar el estado del cliente cada 2 segundos
                        async function checkConnection() {
                            try {
                                const res = await fetch('/status');
                                const data = await res.json();

                                if (data.connected) {
                                // Mostrar animación de transición
                                document.body.innerHTML = 
                                <div style="display:flex;justify-content:center;align-items:center;min-height:100vh;background:#0f1115;color:white;font-family:Arial,sans-serif;flex-direction:column;">
                                <div style="font-size:80px;color:#25D366;">✓</div>
                                    <h1 style="color:#25D366;">WhatsApp Conectado</h1>
                                    <p style="color:#ccc;">Redirigiendo al panel...</p>
                                </div>
                                // Esperar un momento para que se vea la animación
                                setTimeout(() => location.reload(), 2000);
                                }
                                } catch (err) {
                                    console.error('Error al verificar conexión:', err);
                                }
                            }

                            // Ejecutar cada 2 segundos
                            setInterval(checkConnection, 2000);
                </script>
            </body>
            </html>
        `);
    } else {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>WhatsApp API - Iniciando</title>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        min-height: 100vh;
                        margin: 0;
                        background-color: #0f1115;
                    }
                    .container {
                        background: white;
                        padding: 40px;
                        border-radius: 20px;
                        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                        text-align: center;
                    }
                    .spinner {
                        border: 4px solid #f3f3f3;
                        border-top: 4px solid #25D366;
                        border-radius: 50%;
                        width: 50px;
                        height: 50px;
                        animation: spin 1s linear infinite;
                        margin: 20px auto;
                    }
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                    h1 { color: #128C7E; }
                </style>
                <script>
                    setTimeout(() => location.reload(), 2000);
                </script>
            </head>
            <body>
                <div class="container">
                    <div class="spinner"></div>
                    <h1>xiA con WhatsApp...</h1>
                    <p>Por favor espera mientras se genera el código QR</p>
                </div>
            </body>
            </html>
        `);
    }
});

// 1. Estado de la conexión (JSON)
app.get('/status', (req, res) => {
    res.json({
        connected: isReady,
        qrCode: qrCode,
        message: isReady ? 'Conectado' : 'Esperando escaneo de QR'
    });
});

// 6. 🎯 ENDPOINT PRINCIPAL: Exportar datos limpios para entrenamiento, limpiar sesión y reiniciar QR
app.get('/export/clean-for-training', checkReady, async (req, res) => {
    try {
        const clientName = req.query.client_name || 'Unknown Client';
        const businessType = req.query.business_type || 'general';
        const messagesPerChat = parseInt(req.query.limit) || 2000;
        const minWordCount = parseInt(req.query.min_words) || 3;
        const includeGroups = req.query.include_groups === 'true';
        const contextWindow = parseInt(req.query.context_window) || 3;

        const chats = await client.getChats();
        const trainingData = [];
        let conversationId = 0;

        for (const chat of chats) {
            if (chat.isGroup && !includeGroups) continue;

            const messages = await chat.fetchMessages({ limit: messagesPerChat });
            const conversationBuffer = [];

            for (let i = 0; i < messages.length; i++) {
                const msg = messages[i];
                if (msg.type !== 'chat' && msg.type !== 'text') continue;
                if (!msg.body || msg.body.trim().length === 0) continue;

                const wordCount = msg.body.trim().split(/\s+/).length;
                if (wordCount < minWordCount) continue;

                const systemPhrases = [
                    'se unió', 'salió del grupo', 'cambió el nombre', 'cambió la descripción',
                    'añadió a', 'eliminó a', 'Messages and calls are end-to-end encrypted'
                ];
                if (systemPhrases.some(p => msg.body.toLowerCase().includes(p))) continue;

                let cleanContent = msg.body
                    .replace(/https?:\/\/[^\s]+/g, '[URL]')
                    .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
                    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
                    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
                    .replace(/[\u{2600}-\u{26FF}]/gu, '')
                    .trim();

                if (cleanContent.length === 0) continue;

                const role = msg.fromMe ? 'assistant' : 'user';
                conversationBuffer.push({ role, content: cleanContent, timestamp: msg.timestamp });

                if (conversationBuffer.length > contextWindow * 2) conversationBuffer.shift();

                const trainingEntry = {
                    id: `conv_${String(conversationId).padStart(6, '0')}`,
                    role,
                    content: cleanContent,
                    timestamp: new Date(msg.timestamp * 1000).toISOString(),
                    chat_name: chat.name,
                    is_group: chat.isGroup,
                    word_count: wordCount,
                    context_window: conversationBuffer.slice(-contextWindow).map(m => m.content)
                };

                if (trainingEntry.context_window.length >= 2) {
                    trainingData.push(trainingEntry);
                    conversationId++;
                }
            }
        }

        const conversationPairs = [];
        for (let i = 0; i < trainingData.length - 1; i++) {
            if (trainingData[i].role === 'user' && trainingData[i + 1].role === 'assistant') {
                conversationPairs.push({
                    id: `pair_${conversationPairs.length}`,
                    question: trainingData[i].content,
                    answer: trainingData[i + 1].content,
                    timestamp: trainingData[i].timestamp,
                    chat_name: trainingData[i].chat_name,
                    context: trainingData[i].context_window.slice(0, -1)
                });
            }
        }

        // ✅ Devolvemos el JSON al cliente
        res.json({
            metadata: {
                client_name: clientName,
                business_type: businessType,
                extraction_date: new Date().toISOString(),
                total_messages: trainingData.length,
                total_conversations: conversationPairs.length,
                filters_applied: {
                    min_word_count: minWordCount,
                    include_groups: includeGroups,
                    context_window: contextWindow
                }
            },
            training_data: trainingData,
            conversation_pairs: conversationPairs
        });

        // 🧹 LIMPIEZA Y REINICIO (asíncrono, después de enviar el JSON)
        (async () => {
            const fs = require('fs');
            const path = require('path');
            const sessionPath = path.join(process.cwd(), '.wwebjs_auth');

            try {
                console.log('\n🧹 Cerrando sesión y limpiando archivos...');
                await client.logout();
                    setTimeout(async () => {
                    await client.destroy();
                    console.log('✅ Cliente destruido correctamente');
                    }, 1000);
                await client.destroy();

                if (fs.existsSync(sessionPath)) {
                    fs.rmSync(sessionPath, { recursive: true, force: true });
                    console.log('📁 Carpeta de sesión eliminada correctamente.');
                }

                // Reiniciar estado global
                isReady = false;
                qrCode = null;
                qrCodeImage = null;

                console.log('♻️ Reiniciando cliente de WhatsApp...');
                const { Client, LocalAuth } = require('whatsapp-web.js');
                const qrcode = require('qrcode-terminal');
                const qrcodeLib = require('qrcode');

                // Nueva instancia del cliente
                const newClient = new Client({
                    authStrategy: new LocalAuth(),
                    puppeteer: {
                        headless: true,
                        args: ['--no-sandbox', '--disable-setuid-sandbox']
                    }
                });

                // Reasignamos handlers y variables globales
                newClient.on('qr', (qr) => {
                    console.log('🔁 Nuevo QR generado, escanea con WhatsApp:');
                    qrcode.generate(qr, { small: true });
                    qrCode = qr;
                    qrcodeLib.toDataURL(qr, { width: 300 }, (err, url) => {
                        if (!err) qrCodeImage = url;
                    });
                });

                newClient.on('ready', () => {
                    console.log('✅ Nuevo cliente de WhatsApp listo!');
                    isReady = true;
                    qrCode = null;
                    qrCodeImage = null;
                });

                newClient.on('authenticated', () => console.log('🔒 Autenticado correctamente'));
                newClient.on('auth_failure', () => console.error('❌ Fallo en la autenticación'));

                await newClient.initialize();
                global.client = newClient; // Reasignar global para próximos endpoints
                console.log('🚀 Nuevo cliente inicializado correctamente.');

            } catch (cleanErr) {
                console.error('❌ Error al limpiar/reiniciar cliente:', cleanErr);
            }
        })();

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 🚀 7. Disparar workflow de n8n manualmente
app.post('/trigger-n8n', async (req, res) => {
    try {
        // URL del webhook de n8n (podés moverla a variable de entorno si querés)
        const N8N_WEBHOOK_URL = "https://n8n.xia.ar/webhook/42d606be-1c1c-4785-89cb-22071847f9b6";

        // Hacer el POST vacío (sin body)
        const response = await fetch(N8N_WEBHOOK_URL, { method: 'POST' });

        if (!response.ok) {
            throw new Error(`n8n devolvió código ${response.status}`);
        }

        console.log('📡 Workflow de n8n disparado correctamente');

        // Responder al frontend o quien llame este endpoint
        res.status(200).json({ success: true, message: 'Workflow de n8n ejecutado correctamente' });
    } catch (error) {
        console.error('❌ Error al disparar workflow de n8n:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});
startWhatsAppClient();
// Iniciar servidor
app.listen(PORT, () => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 API de WhatsApp corriendo en http://localhost:${PORT}`);
    console.log(`${'='.repeat(60)}\n`);
    console.log('📡 Endpoints disponibles:\n');
    console.log(`   🏠  GET  /                              - Interfaz web con QR`);
    console.log(`   📊  GET  /status                        - Estado de conexión`);
    console.log(`   💬  GET  /chats                         - Lista de chats`);
    console.log(`   📝  GET  /chats/:chatId/messages        - Mensajes de un chat`);
    console.log(`   📦  GET  /export/chat/:chatId           - Exportar chat completo`);
    console.log(`   📚  GET  /export/all                    - Exportar TODOS los chats`);
    console.log(`   🎯  GET  /export/clean-for-training     - Datos limpios para IA\n`);
    console.log(`${'='.repeat(60)}\n`);
    console.log('💡 Abre http://localhost:3000 en tu navegador para escanear el QR\n');
});