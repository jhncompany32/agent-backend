export default async function handler(req, res) {
  // --- CORS ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const { userName, password, phoneNumber, currencyCode } = req.body || {};

    if (!userName || !password) {
      return res.status(400).json({ ok: false, error: "Missing userName/password" });
    }

    const CHATWOOT_BASE_URL = process.env.CHATWOOT_BASE_URL; // ej: https://app.chatwoot.com
    const CHATWOOT_ACCOUNT_ID = process.env.CHATWOOT_ACCOUNT_ID; // ej: 148466
    const CHATWOOT_INBOX_ID = process.env.CHATWOOT_INBOX_ID; // ej: 91814
    const CHATWOOT_API_TOKEN = process.env.CHATWOOT_API_TOKEN; // el token de Chatwoot

    if (!CHATWOOT_BASE_URL || !CHATWOOT_ACCOUNT_ID || !CHATWOOT_INBOX_ID || !CHATWOOT_API_TOKEN) {
      return res.status(500).json({ ok: false, error: "Missing Chatwoot env vars" });
    }

    const headers = {
      "Content-Type": "application/json",
      api_access_token: CHATWOOT_API_TOKEN,
    };

    // 1) Crear/obtener contacto
    const contactPayload = {
      name: userName,
      phone_number: phoneNumber || "",
      identifier: userName,
    };

    const contactRes = await fetch(
      `${CHATWOOT_BASE_URL}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/contacts`,
      { method: "POST", headers, body: JSON.stringify(contactPayload) }
    );

    const contactJson = await contactRes.json();
    if (!contactRes.ok) {
      return res.status(500).json({ ok: false, step: "create_contact", chatwoot: contactJson });
    }

    const contactId = contactJson?.payload?.contact?.id || contactJson?.id;

    // 2) Crear conversación en inbox
    const convRes = await fetch(
      `${CHATWOOT_BASE_URL}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/conversations`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          inbox_id: Number(CHATWOOT_INBOX_ID),
          contact_id: Number(contactId),
        }),
      }
    );

    const convJson = await convRes.json();
    if (!convRes.ok) {
      return res.status(500).json({ ok: false, step: "create_conversation", chatwoot: convJson });
    }

    const conversationId = convJson?.id;

    // 3) Mandar mensaje (nota: mandar password por chat es riesgoso)
    const text =
`✅ Usuario creado

👤 Usuario: ${userName}
🔑 Password: ${password}
📞 Tel: ${phoneNumber || "-"}
💱 Moneda: ${currencyCode || "-"}`;

    const msgRes = await fetch(
      `${CHATWOOT_BASE_URL}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/conversations/${conversationId}/messages`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          content: text,
          message_type: "outgoing",
          private: true, // para que quede como nota interna
        }),
      }
    );

    const msgJson = await msgRes.json();
    if (!msgRes.ok) {
      return res.status(500).json({ ok: false, step: "send_message", chatwoot: msgJson });
    }

    return res.status(200).json({ ok: true, conversationId });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}
