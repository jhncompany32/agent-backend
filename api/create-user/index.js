// /api/create-user/index.js

const json = (res, status, data) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
};

const allowCors = (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
};

async function chatwootSend({ userName, phoneNumber, password }) {
  const {
    CHATWOOT_BASE_URL,      // ej: https://chatwoot.tudominio.com
    CHATWOOT_ACCOUNT_ID,    // ej: 1
    CHATWOOT_INBOX_ID,      // ej: 2
    CHATWOOT_API_TOKEN      // token de Chatwoot
  } = process.env;

  if (!CHATWOOT_BASE_URL || !CHATWOOT_ACCOUNT_ID || !CHATWOOT_INBOX_ID || !CHATWOOT_API_TOKEN) {
    throw new Error("Faltan variables de entorno de Chatwoot");
  }

  // 1) Crear/actualizar contacto
  const contactRes = await fetch(`${CHATWOOT_BASE_URL}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/contacts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api_access_token": CHATWOOT_API_TOKEN
    },
    body: JSON.stringify({
      name: userName,
      phone_number: phoneNumber,
      identifier: phoneNumber || userName
    })
  });

  const contactJson = await contactRes.json().catch(() => ({}));
  if (!contactRes.ok) {
    throw new Error(`Chatwoot contact error: ${contactRes.status} ${JSON.stringify(contactJson)}`);
  }

  const contactId = contactJson?.payload?.contact?.id || contactJson?.id || contactJson?.payload?.id;

  // 2) Crear conversación
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

  const convJson = await convRes.json().catch(() => ({}));
  if (!convRes.ok) {
    throw new Error(`Chatwoot conversation error: ${convRes.status} ${JSON.stringify(convJson)}`);
  }

  const conversationId = convJson?.id || convJson?.payload?.id;

  // 3) Enviar mensaje (nota: estás pidiendo enviar password; es sensible)
  const msg = `✅ Usuario creado\n\n👤 Usuario: ${userName}\n🔑 Contraseña: ${password}\n📱 Tel: ${phoneNumber || "-"}\n\n(Generado automáticamente desde el panel admin)`;

  const msgRes = await fetch(`${CHATWOOT_BASE_URL}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api_access_token": CHATWOOT_API_TOKEN
    },
    body: JSON.stringify({
      content: msg,
      message_type: "outgoing"
    })
  });

  const msgJson = await msgRes.json().catch(() => ({}));
  if (!msgRes.ok) {
    throw new Error(`Chatwoot message error: ${msgRes.status} ${JSON.stringify(msgJson)}`);
  }

  return { contactId, conversationId };
}

module.exports = async (req, res) => {
  allowCors(req, res);

  if (req.method === "OPTIONS") return json(res, 200, { ok: true });

  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const { userName, phoneNumber, password, confirmPassword, currencyCode } = body || {};

    if (!userName || !password) {
      return json(res, 400, { ok: false, error: "Falta userName o password" });
    }

    // 1) Crear usuario en tu API externa
    const AGT_TOKEN = process.env.AGT_API_TOKEN; // Bearer token
    if (!AGT_TOKEN) throw new Error("Falta AGT_API_TOKEN en variables de entorno");

    const createRes = await fetch("https://admin-api.agt-digi.com/Player/Create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "authorization": `Bearer ${AGT_TOKEN}`
      },
      body: JSON.stringify({
        userName,
        phoneNumber,
        password,
        confirmPassword: confirmPassword || password,
        currencyCode: currencyCode || "PYG"
      })
    });

    const createJson = await createRes.json().catch(() => ({}));

    if (!createRes.ok) {
      return json(res, createRes.status, {
        ok: false,
        step: "AGT_CREATE",
        error: createJson
      });
    }

    // 2) Avisar a Chatwoot
    const cw = await chatwootSend({ userName, phoneNumber, password });

    return json(res, 200, {
      ok: true,
      created: true,
      agt: createJson,
      chatwoot: cw
    });
  } catch (err) {
    return json(res, 500, { ok: false, error: String(err?.message || err) });
  }
};
