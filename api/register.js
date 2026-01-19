export default async function handler(req, res) {
  // CORS (neocities)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { name = "", phone = "", email = "" } = req.body || {};
    if (!name || !phone || !email) {
      return res.status(400).json({ error: "Faltan datos (name/phone/email)" });
    }

    // 1) Generar credenciales
    const rnd = Math.floor(Math.random() * 9000) + 1000;
    const userName = (name.split(" ")[0] || "user").toLowerCase().replace(/[^a-z0-9]/g, "") + rnd;
    const password = "Azar" + rnd + "!"; // simple. Si querés, lo hacemos más fuerte.

    // 2) Crear usuario en tu admin API
    const AGT_BASE_URL = process.env.AGT_BASE_URL; // ej: https://admin-api.agt-digi.com
    const AGT_API_TOKEN = process.env.AGT_API_TOKEN;

    const createRes = await fetch(`${AGT_BASE_URL}/Player/Create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "authorization": `Bearer ${AGT_API_TOKEN}`
      },
      body: JSON.stringify({
        userName,
        phoneNumber: phone,
        password,
        confirmPassword: password,
        currencyCode: "PYG"
      })
    });

    const createText = await createRes.text();
    if (!createRes.ok) {
      return res.status(500).json({ error: "Falló Player/Create", detail: createText });
    }

    // 3) Enviar a Chatwoot (contacto + conversación + mensaje)
    const CHATWOOT_BASE_URL = process.env.CHATWOOT_BASE_URL; // https://app.chatwoot.com
    const CHATWOOT_ACCOUNT_ID = process.env.CHATWOOT_ACCOUNT_ID; // 148466
    const CHATWOOT_INBOX_ID = process.env.CHATWOOT_INBOX_ID;     // el número del inbox (ej 91814)
    const CHATWOOT_API_TOKEN = process.env.CHATWOOT_API_TOKEN;   // access token (profile)

    // Crear / obtener contacto
    const contactRes = await fetch(`${CHATWOOT_BASE_URL}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/contacts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api_access_token": CHATWOOT_API_TOKEN
      },
      body: JSON.stringify({
        name,
        email,
        phone_number: phone
      })
    });

    const contactJson = await contactRes.json().catch(() => null);
    if (!contactRes.ok || !contactJson?.payload?.contact?.id) {
      return res.status(500).json({ error: "Falló crear contacto Chatwoot", detail: contactJson });
    }
    const contactId = contactJson.payload.contact.id;

    // Crear conversación
    const convRes = await fetch(`${CHATWOOT_BASE_URL}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/conversations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api_access_token": CHATWOOT_API_TOKEN
      },
      body: JSON.stringify({
        inbox_id: Number(CHATWOOT_INBOX_ID),
        contact_id: Number(contactId)
      })
    });

    const convJson = await convRes.json().catch(() => null);
    const conversationId = convJson?.id;
    if (!convRes.ok || !conversationId) {
      return res.status(500).json({ error: "Falló crear conversación Chatwoot", detail: convJson });
    }

    // Mensaje con credenciales
    const msg = `✅ Usuario creado\n\n👤 Usuario: ${userName}\n🔑 Contraseña: ${password}\n📲 WhatsApp: ${phone}\n📧 Email: ${email}`;

    await fetch(`${CHATWOOT_BASE_URL}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api_access_token": CHATWOOT_API_TOKEN
      },
      body: JSON.stringify({
        content: msg,
        message_type: "incoming"
      })
    });

    return res.status(200).json({ ok: true, userName, password, conversationId });

  } catch (e) {
    return res.status(500).json({ error: "Server error", detail: String(e?.message || e) });
  }
}
