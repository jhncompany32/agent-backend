export default async function handler(req, res) {
  // --- CORS (para preflight y para que cualquier cliente pueda pegarle) ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const {
      userName = "",
      password = "",
      phoneNumber = "",
      currencyCode = ""
    } = req.body || {};

    // Variables de entorno (Vercel)
    const CHATWOOT_BASE_URL = process.env.CHATWOOT_BASE_URL || "https://app.chatwoot.com";
    const CHATWOOT_ACCOUNT_ID = process.env.CHATWOOT_ACCOUNT_ID;
    const CHATWOOT_INBOX_ID = process.env.CHATWOOT_INBOX_ID;
    const CHATWOOT_API_TOKEN = process.env.CHATWOOT_API_TOKEN;

    if (!CHATWOOT_ACCOUNT_ID || !CHATWOOT_INBOX_ID || !CHATWOOT_API_TOKEN) {
      return res.status(500).json({
        ok: false,
        error: "Missing env vars",
        missing: {
          CHATWOOT_ACCOUNT_ID: !CHATWOOT_ACCOUNT_ID,
          CHATWOOT_INBOX_ID: !CHATWOOT_INBOX_ID,
          CHATWOOT_API_TOKEN: !CHATWOOT_API_TOKEN
        }
      });
    }

    const apiBase = `${CHATWOOT_BASE_URL.replace(/\/$/, "")}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}`;
    const headers = {
      "Content-Type": "application/json",
      "api_access_token": CHATWOOT_API_TOKEN
    };

    // 1) Crear (o reutilizar) contacto
    // phone_number suele servir bien para que Chatwoot lo identifique
    const contactResp = await fetch(`${apiBase}/contacts`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: userName || phoneNumber || "Nuevo usuario",
        phone_number: phoneNumber || undefined,
        identifier: userName || undefined
      })
    });

    const contactData = await contactResp.json().catch(() => ({}));
    if (!contactResp.ok) {
      return res.status(500).json({
        ok: false,
        step: "create_contact",
        status: contactResp.status,
        chatwoot: contactData
      });
    }

    const contactId = contactData?.payload?.contact?.id || contactData?.id;
    if (!contactId) {
      return res.status(500).json({ ok: false, step: "contact_id_missing", chatwoot: contactData });
    }

    // 2) Crear conversación en Inbox
    const convResp = await fetch(`${apiBase}/conversations`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        inbox_id: Number(CHATWOOT_INBOX_ID),
        contact_id: Number(contactId)
      })
    });

    const convData = await convResp.json().catch(() => ({}));
    if (!convResp.ok) {
      return res.status(500).json({
        ok: false,
        step: "create_conversation",
        status: convResp.status,
        chatwoot: convData
      });
    }

    const conversationId = convData?.id || convData?.payload?.id;
    if (!conversationId) {
      return res.status(500).json({ ok: false, step: "conversation_id_missing", chatwoot: convData });
    }

    // 3) Mandar un mensaje interno (nota privada) con user + pass
    const content =
`🆕 Usuario creado desde panel
👤 Usuario: ${userName}
🔑 Password: ${password}
📞 Tel: ${phoneNumber}
💱 Moneda: ${currencyCode}`;

    const msgResp = await fetch(`${apiBase}/conversations/${conversationId}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        content,
        message_type: "outgoing",
        private: true
      })
    });

    const msgData = await msgResp.json().catch(() => ({}));
    if (!msgResp.ok) {
      return res.status(500).json({
        ok: false,
        step: "send_message",
        status: msgResp.status,
        chatwoot: msgData
      });
    }

    return res.status(200).json({
      ok: true,
      contactId,
      conversationId
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
