const express = require('express');
const session = require('express-session');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const qrcodeLib = require('qrcode');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(session({
    secret: process.env.SESSION_SECRET || 'clave_secreta_default_12345',
    resave: false,
    saveUninitialized: false
}));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// === Credenciales ===
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';

// === Estado global ===
let client = null;
let isReady = false;
let qrCode = null;
let qrCodeImage = null;

// === Autenticación ===
function isAuthenticated(req, res, next) {
    if (req.session.loggedIn) {
        next();
    } else {
        res.redirect('/login');
    }
}

app.get('/login', (req, res) => {
    res.send(`
        <form method="POST" action="/login" style="max-width:300px;margin:auto;margin-top:100px;text-align:center;font-family:Arial;">
            <h2>🔒 Login</h2>
            <input name="user" placeholder="Usuario" required style="margin:5px;padding:10px;width:100%;border-radius:5px;border:1px solid #ccc;" />
            <input name="pass" type="password" placeholder="Contraseña" required style="margin:5px;padding:10px;width:100%;border-radius:5px;border:1px solid #ccc;" />
            <button type="submit" style="padding:10px 20px;background:#25D366;color:white;border:none;border-radius:5px;cursor:pointer;margin-top:10px;">Entrar</button>
        </form>
    `);
});

app.post('/login', (req, res) => {
    const { user, pass } = req.body;
    if (user === ADMIN_USER && pass === ADMIN_PASS) {
        req.session.loggedIn = true;
        console.log('✅ Login correcto');
        res.redirect('/');
    } else {
        res.status(401).send('<h3>❌ Credenciales incorrectas</h3><a href="/login">Volver</a>');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/login'));
});

// === Inicializar WhatsApp ===
async function startWhatsAppClient() {
    try {
        console.log('🟢 Iniciando cliente de WhatsApp...');

        if (client) {
            try { await client.destroy(); } catch (e) {}
        }

        client = new Client({
            authStrategy: new LocalAuth({
                dataPath: path.join(__dirname, '.wwebjs_auth')
            }),
            puppeteer: {
                headless: true,
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
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
            console.log('📱 QR recibido');
            qrcode.generate(qr, { small: true });
            qrCode = qr;
            qrcodeLib.toDataURL(qr, { width: 300 }, (err, url) => {
                if (!err) qrCodeImage = url;
            });
        });

        client.on('authenticated', () => {
            console.log('🔐 Autenticado');
        });

        client.on('auth_failure', (msg) => {
            console.error('❌ Auth falló:', msg);
            isReady = false;
        });

        client.on('ready', () => {
            console.log('✅ WhatsApp LISTO!');
            isReady = true;
            qrCode = null;
            qrCodeImage = null;
        });

        client.on('disconnected', (reason) => {
            console.log('⚠️ Desconectado:', reason);
            isReady = false;
            qrCode = null;
            qrCodeImage = null;
            // NO reiniciar automáticamente
        });

        await client.initialize();
        console.log('🚀 WhatsApp inicializado');

    } catch (err) {
        console.error('💥 Error:', err.message);
    }
}

function checkReady(req, res, next) {
    if (!isReady || !client) {
        return res.status(503).json({
            success: false,
            message: '❌ WhatsApp no conectado. Escanea el QR primero.'
        });
    }
    next();
}

// === Proteger rutas (después del login) ===
app.use(isAuthenticated);

// === ENDPOINTS ===

// Página principal - SIN RECARGAS AUTOMÁTICAS
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
        body { font-family: Arial; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background-color: #0f1115; }
        .container { background: #0f1115; padding: 40px; border-radius: 20px; box-shadow: 0 10px 10px rgba(0, 255, 0, 1); text-align: center; max-width: 600px; width: 90%; }
        h1 { color: #fff; margin-bottom: 20px; }
        .status { font-size: 18px; color: #fff; margin: 20px 0; }
        .checkmark { font-size: 80px; color: #25D366; }
        .endpoints { text-align: left; margin-top: 30px; padding: 20px; background: #000; border-radius: 10px; }
        .endpoint { margin: 10px 0; font-family: monospace; font-size: 13px; padding: 8px; background: white; border-radius: 5px; }
        a { color: #128C7E; text-decoration: none; font-weight: bold; }
        .btn { background: #ffc107; color: #000; padding: 12px 20px; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; margin: 5px; }
        .btn-danger { background: #dc3545; color: white; }
        #statusMsg { color: white; margin-top: 10px; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="checkmark">✓</div>
        <h1>WhatsApp Conectado</h1>
        <div class="status">✅ API lista para recibir peticiones</div>
        
        <div style="margin: 20px 0;">
            <button class="btn" onclick="triggerN8n()">🤖 Entrenar bot con chats</button>
            <button class="btn btn-danger" onclick="resetSession()">🔄 Resetear sesión</button>
        </div>
        <div id="statusMsg"></div>
        
        <div class="endpoints">
            <strong style="color:#fff;">📡 Endpoints:</strong>
            <div class="endpoint"><a href="/status" target="_blank">GET /status</a></div>
            <div class="endpoint"><a href="/chats" target="_blank">GET /chats</a></div>
            <div class="endpoint"><a href="/export/clean-for-training?limit=50&min_words=1" target="_blank">GET /export/clean-for-training</a></div>
        </div>
        
        <p style="margin-top:20px;"><a href="/logout" style="color:#aaa;">Cerrar sesión</a></p>
    </div>
    
    <script>
        async function triggerN8n() {
            document.getElementById('statusMsg').textContent = '⏳ Enviando...';
            try {
                const res = await fetch('/trigger-n8n', { method: 'POST' });
                const data = await res.json();
                document.getElementById('statusMsg').textContent = data.success ? '✅ Workflow ejecutado' : '⚠️ Error: ' + data.error;
            } catch (err) {
                document.getElementById('statusMsg').textContent = '❌ Error: ' + err.message;
            }
        }
        
        async function resetSession() {
            if (!confirm('¿Seguro que quieres resetear la sesión?')) return;
            document.getElementById('statusMsg').textContent = '⏳ Reseteando...';
            try {
                const res = await fetch('/reset-session', { method: 'POST' });
                const data = await res.json();
                document.getElementById('statusMsg').textContent = '✅ ' + data.message + ' - Recarga la página en 10 seg';
            } catch (err) {
                document.getElementById('statusMsg').textContent = '❌ Error: ' + err.message;
            }
        }
    </script>
</body>
</html>`);
    } else if (qrCodeImage) {
        res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>WhatsApp API - Escanear QR</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: Arial; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background-color: #0f1115; }
        .container { box-shadow: 0 10px 10px rgba(0, 255, 0, 1); background: white; padding: 40px; border-radius: 20px; text-align: center; max-width: 500px; width: 90%; }
        h1 { color: #128C7E; margin-bottom: 10px; }
        .qr-container { margin: 20px 0; padding: 20px; background: #000; border-radius: 10px; }
        img { border: 5px solid #25D366; border-radius: 10px; }
        .btn { background: #25D366; color: white; padding: 15px 30px; border: none; border-radius: 10px; cursor: pointer; font-size: 16px; margin-top: 15px; }
        .warning { color: #856404; background: #fff3cd; padding: 10px; border-radius: 5px; margin-top: 15px; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Entrena tu agente con WhatsApp</h1>
        <p>Escanea este código QR con tu WhatsApp</p>
        <div class="qr-container">
            <img src="${qrCodeImage}" alt="QR Code" width="280">
        </div>
        <div class="warning">⚠️ Después de escanear, espera 30 segundos</div>
        <button class="btn" onclick="location.reload()">✅ Ya escaneé - Verificar conexión</button>
        <p style="margin-top:20px;"><a href="/logout">Cerrar sesión</a></p>
    </div>
</body>
</html>`);
    } else {
        res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>WhatsApp API - Iniciando</title>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background-color: #0f1115; }
        .container { background: white; padding: 40px; border-radius: 20px; text-align: center; }
        .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #25D366; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; margin: 20px auto; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .btn { background: #25D366; color: white; padding: 12px 24px; border: none; border-radius: 8px; cursor: pointer; margin-top: 15px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="spinner"></div>
        <h1>Iniciando WhatsApp...</h1>
        <p>Generando código QR</p>
        <button class="btn" onclick="location.reload()">🔄 Recargar</button>
    </div>
</body>
</html>`);
    }
});

// Status
app.get('/status', (req, res) => {
    res.json({
        connected: isReady,
        clientExists: !!client,
        message: isReady ? 'Conectado' : 'Esperando escaneo de QR'
    });
});

// Chats
app.get('/chats', checkReady, async (req, res) => {
    try {
        const chats = await client.getChats();
        res.json({
            total: chats.length,
            chats: chats.map(c => ({
                id: c.id._serialized,
                name: c.name,
                isGroup: c.isGroup
            }))
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Export para training
app.get('/export/clean-for-training', checkReady, async (req, res) => {
    try {
        const clientName = req.query.client_name || 'Unknown';
        const limit = parseInt(req.query.limit) || 100;
        const minWords = parseInt(req.query.min_words) || 1;
        const includeGroups = req.query.include_groups === 'true';

        console.log('📥 Exportando chats...');
        const chats = await client.getChats();
        console.log(`📋 Total chats: ${chats.length}`);

        const trainingData = [];
        let id = 0;

        for (const chat of chats) {
            if (chat.isGroup && !includeGroups) continue;

            try {
                console.log(`💬 ${chat.name || 'Sin nombre'}`);
                const messages = await chat.fetchMessages({ limit });

                for (const msg of messages) {
                    if (!msg.body || msg.type !== 'chat') continue;
                    const words = msg.body.split(/\s+/).length;
                    if (words < minWords) continue;

                    const content = msg.body
                        .replace(/https?:\/\/[^\s]+/g, '[URL]')
                        .replace(/[\u{1F600}-\u{1F9FF}]/gu, '')
                        .trim();

                    if (!content) continue;

                    trainingData.push({
                        id: `msg_${id++}`,
                        role: msg.fromMe ? 'assistant' : 'user',
                        content,
                        chat_name: chat.name || 'Unknown',
                        timestamp: new Date(msg.timestamp * 1000).toISOString()
                    });
                }
            } catch (e) {
                console.log(`⚠️ Error en chat: ${e.message}`);
            }
        }

        console.log(`✅ Exportados: ${trainingData.length} mensajes`);

        res.json({
            metadata: {
                client_name: clientName,
                total_messages: trainingData.length,
                extraction_date: new Date().toISOString()
            },
            training_data: trainingData
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Trigger n8n
app.post('/trigger-n8n', async (req, res) => {
    try {
        const N8N_WEBHOOK_URL =  "https://n8n.xia.ar/webhook-test/6b90987a-8166-4e89-8e16-441db8db9ba8";
        const response = await fetch(N8N_WEBHOOK_URL, { method: 'POST' });
        
        if (!response.ok) throw new Error(`n8n devolvió ${response.status}`);
        
        console.log('📡 Workflow n8n ejecutado');
        res.json({ success: true, message: 'Workflow ejecutado' });
    } catch (err) {
        console.error('❌ Error n8n:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Reset session
app.post('/reset-session', async (req, res) => {
    console.log('🔄 Reset solicitado');
    
    res.json({ success: true, message: 'Reseteando sesión...' });

    setTimeout(async () => {
        try {
            if (client) {
                await client.logout().catch(() => {});
                await client.destroy().catch(() => {});
            }

            const sessionPath = path.join(__dirname, '.wwebjs_auth');
            if (fs.existsSync(sessionPath)) {
                fs.rmSync(sessionPath, { recursive: true, force: true });
            }

            client = null;
            isReady = false;
            qrCode = null;
            qrCodeImage = null;

            await startWhatsAppClient();
        } catch (err) {
            console.error('Error reset:', err.message);
        }
    }, 1000);
});

// Iniciar
startWhatsAppClient();

app.listen(PORT, () => {
    console.log(`🚀 API corriendo en http://localhost:${PORT}`);
});;
