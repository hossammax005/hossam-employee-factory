'use strict';

const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');
const path = require('node:path');

const SESSION_DIR = path.join(process.cwd(), 'runtime', 'e1-auth');
const seenMessageIds = new Set();
let pairingRequested = false;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getText(message) {
  const content = message?.message;
  return content?.conversation
    || content?.extendedTextMessage?.text
    || content?.imageMessage?.caption
    || content?.videoMessage?.caption
    || '';
}

function makeReply(input) {
  const text = input.trim();
  const normalized = text.toLowerCase();

  if (/^(السلام عليكم|سلام|مرحبا|مرحباً|اهلا|أهلا|صباح الخير|مساء الخير)[!.؟\s]*$/i.test(text)) {
    return 'وعليكم السلام! أنا موظف HOSSAM-X التجريبي. موجود معاك وجاهز أستقبل تعليماتك. اكتب «مساعدة» لمعرفة ما أستطيع فعله الآن.';
  }

  if (normalized === 'مساعدة' || normalized === 'help') {
    return 'أنا النسخة الأولى من موظف HOSSAM-X. أستقبل الرسائل النصية المباشرة وأرد عليها. حاليًا أختبر الاتصال وسلوك المحادثة، وسيتم تطوير مهامي وذاكرتي معًا خطوة بخطوة.';
  }

  if (/^(اسمك|من أنت|انت مين|إنت مين)[؟?!.]*$/i.test(text)) {
    return 'أنا موظف HOSSAM-X التجريبي، ودي أول نسخة تشغيلية ليا على واتساب. هنتعلم ونطوّر مهامي من محادثاتنا.';
  }

  return 'وصلتني رسالتك بنجاح: «' + text + '»\n\nأنا موظف HOSSAM-X في نسختي التجريبية الأولى. الاتصال والرد النصي شغالان، ولسه هنضيف الذكاء والمهام والذاكرة في الخطوات القادمة.';
}

async function main() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

  if (!state.creds.registered) {
    const rl = readline.createInterface({ input: stdin, output: stdout });
    const phoneNumber = (await rl.question(
      'اكتب رقم WhatsApp Business الموجود على هذا الهاتف بصيغة دولية، أرقام فقط وبدون +: '
    )).trim();
    rl.close();

    if (!/^\d{10,15}$/.test(phoneNumber)) {
      throw new Error('صيغة الرقم غير صحيحة. استخدم رمز الدولة ثم الرقم، أرقام فقط.');
    }

    globalThis.__E1_PHONE_NUMBER = phoneNumber;
  }

  const sock = makeWASocket({
    auth: state,
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
        const code = await sock.requestPairingCode(globalThis.__E1_PHONE_NUMBER);
        console.log('\n========================================');
        console.log('كود ربط WhatsApp Business (لا تشاركه مع أي شخص):');
        console.log(code);
        console.log('========================================');
        console.log('على الهاتف الأزرق: واتساب للأعمال > الأجهزة المرتبطة > ربط جهاز > الربط برقم الهاتف.');
        console.log('أدخل الكود بنفسك داخل واتساب. لا ترسله في المحادثة هنا.\n');
      } catch (error) {
        pairingRequested = false;
        console.error('تعذر إنشاء كود الاقتران:', error.message);
      }
    }

    if (connection === 'open') {
      console.log('\n✅ E1 متصل بواتساب وجاهز لاستقبال الرسائل النصية.');
      console.log('أرسل رسالة من الهاتف الأحمر إلى حساب واتساب Business المرتبط لاختبار الرد.\n');
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      console.error('\n⚠️ اتصال واتساب أُغلق.', loggedOut
        ? 'الحساب خرج من الأجهزة المرتبطة؛ يلزم ربطه من جديد.'
        : 'لم تتم إعادة التشغيل تلقائيًا في هذه النسخة التجريبية.');
      console.error('تفاصيل الإغلاق:', lastDisconnect?.error?.message || 'غير متاحة');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const message of messages) {
      const jid = message.key?.remoteJid;
      const id = message.key?.id;
      if (!jid || !id || message.key.fromMe) continue;
      if (jid === 'status@broadcast' || jid.endsWith('@g.us') || jid.endsWith('@newsletter')) continue;
      if (seenMessageIds.has(id)) continue;

      const incomingText = getText(message).trim();
      if (!incomingText) continue;

      seenMessageIds.add(id);
      if (seenMessageIds.size > 500) {
        const oldest = seenMessageIds.values().next().value;
        seenMessageIds.delete(oldest);
      }

      console.log('📩 رسالة نصية واردة من محادثة مباشرة.');
      try {
        await sock.sendMessage(jid, { text: makeReply(incomingText) });
        console.log('📤 تم إرسال الرد بنجاح.');
      } catch (error) {
        console.error('تعذر إرسال الرد:', error.message);
      }
    }
  });
}

main().catch((error) => {
  console.error('تعذر تشغيل الموظف E1:', error.message);
  process.exitCode = 1;
});
