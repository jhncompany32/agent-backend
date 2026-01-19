const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

function generarPasswordFacil() {
  return "Casa" + Math.floor(1000 + Math.random() * 9000);
}

app.post("/create-player", (req, res) => {
  const { userName, phoneNumber } = req.body;
  const password = generarPasswordFacil();

  console.log("Usuario creado:", { userName, phoneNumber, password });

  res.json({
    success: true,
    userName,
    password,
    link: "https://azar247.com"
  });
});

app.get("/", (req, res) => {
  res.send("Backend activo");
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log("Servidor activo en puerto", PORT);
});
