export default async function handler(req, res) {
  // ✅ CORS: permitir llamadas desde cualquier origen (para pruebas)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    // 👇 para debug rápido
    return res.status(200).json({
      ok: true,
      received: body,
      note: "CORS OK - endpoint reached"
    });
  } catch (e) {
    return res.status(400).json({ ok: false, error: "Bad JSON" });
  }
}
