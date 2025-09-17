import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;        // any string you choose
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;    // your permanent or temp token
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;  // from WhatsApp Getting Started
const GRAPH_URL = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;

async function sendWa(to, payload) {
  return axios.post(GRAPH_URL,
    { messaging_product: "whatsapp", to, ...payload },
    { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } }
  );
}

// webhook verify
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === VERIFY_TOKEN) return res.status(200).send(challenge);
  res.sendStatus(403);
});

// message handler
app.post("/webhook", async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0]?.value;
    const msg = change?.messages?.[0];
    if (msg?.from) {
      const from = msg.from;
      const text = (msg.text?.body || "").trim().toLowerCase();
      const btn = msg.interactive?.button_reply?.id;
      const list = msg.interactive?.list_reply?.id;

      if (btn === "menu" || ["hi","hello","m","menu","start"].includes(text)) {
        await sendWa(from, {
          type: "interactive",
          interactive: {
            type: "button",
            body: { text: "Welcome to DTT Tourism! Choose a tour:" },
            action: {
              buttons: [
                { type: "reply", reply: { id: "desert_safari", title: "Desert Safari" } },
                { type: "reply", reply: { id: "city_tour", title: "City Tour" } },
                { type: "reply", reply: { id: "agent", title: "Talk to Agent" } }
              ]
            }
          }
        });
      } else if (btn === "desert_safari") {
        await sendWa(from, {
          type: "interactive",
          interactive: {
            type: "list",
            header: { type: "text", text: "Desert Safari" },
            body: { text: "Pick a package:" },
            action: {
              button: "View Options",
              sections: [{
                title: "Packages",
                rows: [
                  { id: "safari_std", title: "Standard", description: "AED 120 – Sharing" },
                  { id: "safari_vip", title: "VIP Private", description: "AED 650 – 4x4" }
                ]
              }]
            }
          }
        });
      } else if (list === "safari_std" || list === "safari_vip") {
        const pkg = list === "safari_std" ? "Standard" : "VIP Private";
        await sendWa(from, {
          type: "text",
          text: { body: `You chose ${pkg}.\nPlease send:\n• Name\n• Date\n• Pickup Area\n• Adults/Children\n\nType M for Main Menu` }
        });
      } else if (btn === "city_tour") {
        await sendWa(from, { type: "text", text: { body: "City Tour options: 4h / 6h / Full day. Type M for menu." } });
      } else if (btn === "agent") {
        await sendWa(from, { type: "text", text: { body: "Thanks! A human agent will reply shortly." } });
      } else {
        await sendWa(from, { type: "text", text: { body: "Type M for menu." } });
      }
    }
    res.sendStatus(200);
  } catch (e) {
    console.error(e?.response?.data || e.message);
    res.sendStatus(200);
  }
});

app.get("/", (_, res) => res.send("OK"));
app.listen(process.env.PORT || 3000);
