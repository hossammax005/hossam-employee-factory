'use strict';

const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');
const path = require('node:path');

// Node.js 24 includes a built-in .env loader; no extra dependency is required.
try {
  process.loadEnvFile(path.join(process.cwd(), '.env'));
} catch (error) {
  if (error.code !== 'ENOENT') console.error('تعذر تحميل ملف .env:', error.message);
}

const SESSION_DIR = path.join(process.cwd(), 'runtime', 'e1-auth');
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const SYSTEM_PROMPT = process.env.E1_SYSTEM_PROMPT
  || 'أنت موظف ذكي تابع لحسام. رد بالعامية المصرية بأسلوب محترم وودود وواضح. أجب عن سؤال العميل مباشرة، ولا تدّعِ تنفيذ إجراء أو امتلاك معلومة غير موجودة. إذا لم تعرف الإجابة فقل ذلك بوضوح.';
const MAX_CONCURRENT_AI = 2;
const AI_TIMEOUT_MS = 20000;
const seenMessageIds = new Set();

let activeAiRequests = 0;
let reconnectTimer = null;
let reconnectAttempts = 0;
let phoneNumber = null;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getText(message) {
  const content = message?.message;
  return content?.conversation || content?.extendedTextMessage?.text || '';
}

function fallbackReply(reason) {
  if (reason === 'busy') {
    return 'وصلتني رسالتك، وفيه طلبات تانية بتتجهز دلوقتي. ابعتلي بعد لحظات وهرد عليك.';
  }
  return 'وصلتني رسالتك، لكن خدمة الرد الذكي مش متاحة للحظات. حسام هيتابع معاك قريب.';
}

async function getGroqResponse(userText) {
  if (!GROQ_API_KEY) {
    console.error('GROQ_API_KEY غير موجود في ملف .env.');
    return fallbackReply('unavailable');
  }

  if (activeAiRequests >= MAX_CONCURRENT_AI) return fallbackReply('busy');

  activeAiRequests += 1;
  try {
    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + GROQ_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userText.slice(0, 6000) }
        ],
        max_completion_tokens: 400
      }),
      signal: AbortSignal.timeout(AI_TIMEOUT_MS)
    });

    if (!response.ok) {
      console.error('Groq API returned HTTP ' + response.status + '.');
      return fallbackReply('unavailable');
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content?.trim();
    if (!answer) {
      console.error('Groq API returned an empty response.');
      return fallbackReply('unavailable');
    }

    return answer.slice(0, 4000);
  } catch (error) {
    console.error('AI request failed:', error.name === 'TimeoutError' ? 'timeout' : error.message);
    return fallbackReply('unavailable');
  } finally {
    activeAiRequests -= 1;
  }
}

async function main() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

  // Use the WhatsApp Web version currently recommended by Baileys maintainers.
  const waVersionInfo = await fetchLatestBaileysVersion();
  const waVersion = waVersionInfo.version;
  console.log('WhatsApp Web version: ' + waVersion.join('.') + ' (maintainer latest: ' + waVersionInfo.isLatest + ')');
  if (!waVersionInfo.isLatest && waVersionInfo.error) {
    console.warn('تعذر جلب إصدار Baileys الأحدث؛ سيتم استخدام الإصدار المضمّن:', waVersionInfo.error.message || waVersionInfo.error);
  }

  if (!state.creds.registered) {
    const rl = readline.createInterface({ input: stdin, output: stdout });
    phoneNumber = (await rl.question(
      'اكتب رقم WhatsApp Business الموجود على هذا الهاتف بصيغة دولية، أرقام فقط وبدون +: '
    )).trim();
    rl.close();

    if (!/^\d{10,15}$/.test(phoneNumber)) {
      throw new Error('صيغة الرقم غير صحيحة. استخدم رمز الدولة ثم الرقم، أرقام فقط.');
    }
  }

  if (!GROQ_API_KEY) {
    console.error('تنبيه: GROQ_API_KEY غير موجود؛ سيستخدم الموظف ردًا احتياطيًا.');
  } else {
    console.log('AI configured: Groq / ' + GROQ_MODEL);
  }

  function connect() {
    let pairingRequested = false;
    const sock = makeWASocket({
      auth: state,
      version: waVersion,
      printQRInTerminal: false,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
      if (connection === 'connecting' && !state.creds.registered && !pairingRequested) {
        pairingRequested = true;
        try {
          await wait(1200);
          const code = await sock.requestPairingCode(phoneNumber);
          console.log('\n========================================');
          console.log('كود ربط WhatsApp Business (لا تشاركه مع أي شخص):');
          console.log(code);
          console.log('========================================');
          console.log('واتساب للأعمال > الأجهزة المرتبطة > ربط جهاز > الربط برقم الهاتف.');
          console.log('أدخل الكود بنفسك داخل واتساب. لا ترسله هنا.\n');
        } catch (error) {
          pairingRequested = false;
          console.error('تعذر إنشاء كود الاقتران:', error.message);
        }
      }

      if (connection === 'open') {
        reconnectAttempts = 0;
        console.log('\n✅ E1 متصل بواتساب وجاهز لاستقبال الرسائل.');
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;
        console.error('اتصال واتساب أُغلق:', lastDisconnect?.error?.message || 'سبب غير متاح');

        if (loggedOut) {
          console.error('الحساب خرج من الأجهزة المرتبطة. يلزم ربطه يدويًا من جديد.');
          return;
        }

        if (reconnectTimer) return;
        reconnectAttempts += 1;
        const delay = Math.min(2000 * (2 ** Math.min(reconnectAttempts - 1, 4)), 30000);
        console.log('محاولة إعادة الاتصال بعد ' + Math.round(delay / 1000) + ' ثانية...');
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          connect();
        }, delay);
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const message of messages) {
        const jid = message.key?.remoteJid;
        const id = message.key?.id;
        if (!jid || !id || message.key.fromMe) continue;
        if (jid === 'status@broadcast' || jid.endsWith('@g.us') || jid.endsWith('@newsletter')) continue;
        if (!(jid.endsWith('@s.whatsapp.net') || jid.endsWith('@lid'))) continue;
        if (seenMessageIds.has(id)) continue;

        const incomingText = getText(message).trim();
        if (!incomingText) continue;

        seenMessageIds.add(id);
        if (seenMessageIds.size > 500) {
          const oldest = seenMessageIds.values().next().value;
          seenMessageIds.delete(oldest);
        }

        console.log('📩 رسالة نصية واردة من محادثة مباشرة.');
        const aiResponse = await getGroqResponse(incomingText);
        try {
          await sock.sendMessage(jid, { text: aiResponse });
          console.log('📤 تم إرسال الرد.');
        } catch (error) {
          console.error('تعذر إرسال الرد:', error.message);
        }
      }
    });
  }

  connect();
}

main().catch((error) => {
  console.error('تعذر تشغيل الموظف E1:', error.message);
  process.exitCode = 1;
});
