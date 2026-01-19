export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    service: "agent-backend",
    time: new Date().toISOString()
  });
}
