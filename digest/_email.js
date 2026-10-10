// --- email digest via Composio (GMAIL_SEND_EMAIL) ---
// Set USER_ID to the user_id your Gmail was connected under in Composio.
// Set RECIPIENT to the address the digest should land in.
const fs = require("fs");
const path = require("path");
const https = require("https");

const USER_ID = "PASTE_YOUR_COMPOSIO_USER_ID_HERE";
const RECIPIENT = "PASTE_RECIPIENT_EMAIL_HERE";

async function sendDigestEmail(htmlBody, subject, dir, logFn) {
  const keyFile = path.join(dir, "composio-key.txt");
  let apiKey = "";
  try { apiKey = fs.readFileSync(keyFile, "utf8").trim(); } catch (e) { apiKey = ""; }
  if (!apiKey) {
    logFn("email off: composio-key.txt is missing or empty");
    return null;
  }
  if (!apiKey.startsWith("ak_")) {
    logFn("email off: composio-key.txt does not start with ak_ (got: " + apiKey.slice(0, 6) + ")");
    return null;
  }
  const payload = JSON.stringify({
    user_id: USER_ID,
    version: "latest",
    arguments: {
      recipient_email: RECIPIENT,
      subject: subject,
      body: htmlBody,
      is_html: true,
    },
  });
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "backend.composio.dev",
        port: 443,
        path: "/api/v3/tools/execute/GMAIL_SEND_EMAIL",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => { data += c; });
        res.on("end", () => {
          let json = null;
          try { json = JSON.parse(data); } catch (e) {
            return reject(new Error("Composio returned non-JSON: " + data.slice(0, 300)));
          }
          if (json && json.success === true) {
            logFn("email sent to " + RECIPIENT);
            resolve(json);
          } else {
            const errRaw = json && json.error;
            const errStr = (typeof errRaw === "object" && errRaw !== null)
              ? JSON.stringify(errRaw)
              : String(errRaw || JSON.stringify(json).slice(0, 300));
            logFn("Composio raw response: " + data.slice(0, 500));
            reject(new Error("Composio reported success=false: " + errStr));
          }
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(60000, () => { req.destroy(); reject(new Error("Composio timeout")); });
    req.write(payload);
    req.end();
  });
}

module.exports = { sendDigestEmail };