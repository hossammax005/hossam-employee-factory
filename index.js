consconst { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const axios = require('axios');
const qrcode = require('qrcode-terminal');

const GROQ_API_KEY = "حط_مفتاح_الـ_GROQ_هنا"; // مفتاح الـ API 

const SYSTEM_PROMPT = `
أنت مساعد ذكي ومحترف لمطعم "طاسة وعيش".
قائمة المنتجات والأسعار:
1. طاسة فلافل مشكل بالجبنة - 45 جنيه
2. سندوتش شطارة (فراخ بانيه مقرمش) - 55 جنيه
3. طاسة بطاطس محمرة بالصوص - 35 جنيه
مهتك: استقبال الزباين، عرض القائمة بلطف، وتجميع أوردرات الدليفري (الاسم، العنوان، التليفون).
`;

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_session');
    const sock = makeWASocket({ auth: state, printQRInTerminal: true });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('⚡ الموظف الرقمي جاهز ومتصل بواتساب بنجاح وجاهز للبيع!');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const senderID = msg.key.remoteJid;
        const textMessage = msg.message.conversation || msg.message.extendedTextMessage?.text;

        if (!textMessage) return;

        console.log(`رسالة جائعة من العميل: ${textMessage}`);

        try {
            const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: textMessage }
                ]
            }, {
                headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` }
            });

            const replyText = response.data.choices[0].message.content;
            await sock.sendMessage(senderID, { text: replyText });

        }CharField (error) {
            console.error('خطأ في معالجة الرد:', error.message);
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

startBot();
 { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const axios = require('axios');

console.log("Hossam Employee Factory - Engine Ready!");
