import crypto from "crypto";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export default async function handler(req, res) {
  cors(res);

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { name, phone, email } = req.body || {};

    if (!name || (!phone && !email)) {
      return res.status(400).json({ error: "Falta name y (phone o email)" });
    }

    // ====== 1) CREAR USUARIO EN TU PLATAFORMA (ADMIN) ======
    // Ajustá estas variables en Vercel -> Environment Variables
    const PLATFORM_CREATE_USER_URL = process.env.PLATFORM_CREATE_USER_URL; // ej: https://tudominio.com/admin/api/users
    const PLATFORM_ADMIN_TOKEN = process.env.PLATFORM_ADMIN_TOKEN; // token secreto

    if (!PLATFORM_CREATE_USER_URL || !PLATFORM_ADMIN_TOKEN) {
      return res.status(500).json({ error: "Faltan variables PLATFORM_CREATE_USER_URL / PLATFORM_ADMIN_TOKEN" });
    }

    // Ejemplo genérico: POST con Bearer token
    const createResp = await fetch(PLATFORM_CREATE_USER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${PLATFORM_ADMIN_TOKEN}`,
      },
      body: JSON.stringify({
        name,
        phone: phone || null,
        email: email || null,
        source: "landing_chatwoot",
      }),
    });

    const createData = await createResp.json().catch(() => ({}));

    if (!createResp.ok) {
      return res.status(502).json({
        error: "No se pudo crear usuario en la plataforma",
        status: createResp.status,
        details: createData,
      });
    }

    // ====== 2) (OPCIONAL) DEVOLVER HASH PARA IDENTIFICAR EN CHATWOOT ======
    // Esto sirve si querés que Chatwoot “reconozca” siempre al mismo usuario
    const CHATWOOT_HMAC_SECRET = process.env.CHATWOOT_HMAC_SECRET; // opcional
    const identifier = (email && email.toLowerCase()) || phone;

    let identifier_hash = null;
    if (CHATWOOT_HMAC_SECRET && identifier) {
      identifier_hash = crypto
        .createHmac("sha256", CHATWOOT_HMAC_SECRET)
        .update(identifier)
        .digest("hex");
    }

    return res.status(200).json({
      ok: true,
      platform_user: createData,  // lo que devuelva tu API (id, username, etc.)
      chatwoot: {
        identifier,
        identifier_hash,
        name,
        email: email || null,
        phone: phone || null,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: "Server error", details: String(err?.message || err) });
  }
}
