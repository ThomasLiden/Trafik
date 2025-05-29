# 🔔 Notification Service – SMS via Render

Detta är en notifieringstjänst för att skicka SMS (och e-post) via ett REST API. Andra grupper kan enkelt använda tjänsten för att testa SMS-utskick via vår backend.

## 🌍 URL till tjänsten

**Base URL:**  
`https://trafikwidget-projekt.onrender.com`

---

## 📤 Skicka SMS

**Endpoint:**  
`POST /send-sms`

**Headers:**
```http
Content-Type: application/json
```

**Request body:**
```json
{
  "to": "+46701234567",
  "message": "Väg 1067 är avstängd pga snö",
  "sender": "GruppX"  // valfritt (max 11 tecken, inga mellanslag)
}
```

### ✅ Exempel med `curl`:

```bash
curl -X POST https://trafikwidget-projekt.onrender.com/send-sms \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+46701234567",
    "message": "Trafikmeddelande från grupp X",
    "sender": "GruppX"
  }'
```

---

## ❗ Viktigt att tänka på

- Telefonnummer **måste börja med +46** (inte 07...).
- Fältet `"sender"` är valfritt – max **11 tecken** och får **inte** innehålla mellanslag.
- Varje sms som skickas kostar pengar via 46elks, så **testa sparsamt**.
- Skickar du flera mottagare samtidigt? Skicka `"to"` som en array:
  ```json
  "to": ["+46701112233", "+46704445566"]
  ```


---

## 🚦 Hälsokontroll

Kolla att servern är igång:
```bash
curl https://trafikwidget-projekt.onrender.com/health
# Svar: OK
```

---

## 🛠️ Under huven

Servern är byggd med:
- Node.js / Express
- 46elks API (för sms)
- Nodemailer + SMTP (för e-post)

---

🧪 Testa gärna och hör av dig om ni har frågor!
