// CHANGE THIS ONE LINE to switch models
const MODEL = "deepseek/deepseek-chat-v4";

// === CONFIG (change these two lines only) ===
const COUNTRY = "Germany";
const RSS_URL = "https://news.google.com/rss/search?q=indian+germany&hl=de&gl=DE&ceid=DE:de";

const fs = require("fs");
const path = require("path");
const https = require("https");

const DIR = __dirname;
const KEY_FILE = path.join(DIR, "key.txt");
const DIGEST_FILE = path.join(DIR, "digest.html");
const MAX_ITEMS = 5;

function log(msg) { console.log("[digest] " + msg); }

// --- fetch Google News RSS (follows redirects) ---
function fetchRss(url) {
  return new Promise((resolve, reject) => {
    const attempt = (u, depth) => {
      if (depth <= 0) return reject(new Error("Too many redirects"));
      const req = https.get(u, { headers: { "User-Agent": "Mozilla/5.0 (compatible; digest-bot/1.0)" } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 303 || res.statusCode === 307 || res.statusCode === 308) {
          const loc = res.headers.location;
          res.resume();
          if (!loc) return reject(new Error("Redirect with no Location header"));
          return attempt(loc, depth - 1);
        }
        if (res.statusCode !== 200) { res.resume(); return reject(new Error("RSS HTTP " + res.statusCode)); }
        let data = "";
        res.on("data", (chunk) => { data += chunk; });
        res.on("end", () => resolve(data));
      });
      req.on("error", reject);
      req.setTimeout(30000, () => { req.destroy(); reject(new Error("RSS timeout")); });
    };
    attempt(url, 5);
  });
}

// --- parse and dedupe RSS items ---
function parseItems(xml) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1];
    const titleMatch = block.match(/<title>([\s\S]*?)<\/title>/);
    const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/);
    const pubMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    if (titleMatch) {
      items.push({
        title: decodeEntities(titleMatch[1].replace(/<[^>]+>/g, "")),
        link: linkMatch ? decodeEntities(linkMatch[1]) : "",
        date: pubMatch ? pubMatch[1] : "",
      });
    }
  }
  return items;
}

function decodeEntities(s) {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, String.fromCharCode(34)).replace(/&#39;/g, String.fromCharCode(39));
}

function dedupe(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const key = it.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 60);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

// --- AI summarization ---
function summarize(items, apiKey, model) {
  const payload = items.map((it, i) => (i + 1) + ". " + it.title + (it.date ? " (" + it.date + ")" : "")).join("\n");
  const system = "You are writing a daily digest for an immigration and settlement consultant in " + COUNTRY + " who works with Indian expatriates. For each headline, write exactly two lines: Line 1 = what happened. Line 2 = what it means for Indian expats in " + COUNTRY + " (housing, jobs, visa, migration, studies, schooling, insurance, driving licence). Keep it concrete and short. Do not add a title or intro. Separate each item with a blank line.";
  const user = "Headlines:\n" + payload + "\n\nWrite the two-line summary for each headline, in the same order, nothing else.";
  const body = JSON.stringify({ model: model, messages: [{ role: "system", content: system }, { role: "user", content: user }], max_tokens: 600, temperature: 0.4 });
  return new Promise((resolve, reject) => {
    const isOr = apiKey.startsWith("sk-or-");
    const host = isOr ? "openrouter.ai" : "api.deepseek.com";
    const path = isOr ? "/api/v1/chat/completions" : "/v1/chat/completions";
    const opts = {
      hostname: host, port: 443, path: path, method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey, "Content-Length": Buffer.byteLength(body) }
    };
    const req = https.request(opts, (res) => {
      let data = "";
      res.on("data", (c) => { data += c; });
      res.on("end", () => {
        if (res.statusCode !== 200) { return reject(new Error("AI HTTP " + res.statusCode + " " + data.slice(0, 300))); }
        try {
          const json = JSON.parse(data);
          const text = json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
          if (!text) return reject(new Error("AI returned no content: " + JSON.stringify(json).slice(0, 300)));
          resolve(text.trim());
        } catch (e) { reject(new Error("AI parse error: " + data.slice(0, 300))); }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}
// --- build HTML ---
function buildHtml(items, summaries, aiError) {
  const now = new Date();
  const stamp = now.toLocaleString("en-GB", { timeZone: "Europe/Berlin" });
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const rows = items.map((it, i) => {
    const s = (summaries && summaries[i]) ? summaries[i].trim() : null;
    const dateStr = it.date ? esc(it.date) : "no date";
    const link = it.link
      ? '<a href="' + esc(it.link) + '" target="_blank" rel="noopener">' + esc(it.title) + "</a>"
      : esc(it.title);
    const summaryHtml = s
      ? '<div class="summary">' + esc(s).replace(/\n/g, "<br>") + "</div>"
      : '<div class="summary missing">Summary unavailable.</div>';
    return '<div class="item"><h3>' + link + "</h3><div class=\"meta\">" + dateStr + "</div>" + summaryHtml + "</div>";
  }).join("\n    ");
  const aiBanner = aiError
    ? '<div class="banner">Summaries are missing: ' + esc(aiError) + "</div>"
    : "";
  const html = [
    "<!DOCTYPE html>",
    '<html lang="en"><head><meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    "<title>Digest - " + esc(COUNTRY) + "</title>",
    "<style>",
    "  body { font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif; max-width: 760px; margin: 0 auto; padding: 24px 16px 60px; color: #1a1a1a; background: #f7f3ec; line-height: 1.55; }",
    "  h1 { font-size: 28px; margin: 0 0 4px; }",
    "  .sub { color: #666; margin: 0 0 24px; font-size: 14px; }",
    "  .banner { background: #fff3cd; border: 1px solid #ffeaa7; color: #6b4e00; padding: 12px 14px; border-radius: 6px; margin: 0 0 20px; font-size: 14px; }",
    "  .item { background: #fff; border: 1px solid #e7e1d6; border-radius: 8px; padding: 16px 18px; margin-bottom: 16px; }",
    "  .item h3 { margin: 0 0 4px; font-size: 18px; }",
    "  .item h3 a { color: #1f2a44; text-decoration: none; }",
    "  .item h3 a:hover { color: #e08a2e; }",
    "  .meta { color: #888; font-size: 12px; margin: 0 0 10px; }",
    "  .summary { font-size: 15px; color: #333; }",
    "  .summary.missing { color: #999; font-style: italic; }",
    "  .accent { color: #e08a2e; }",
    "</style></head><body>",
    "  <h1>Digest for <span class=\"accent\">" + esc(COUNTRY) + "</span></h1>",
    "  <p class=\"sub\">Indian expat news - generated " + stamp + "</p>",
    "  " + aiBanner,
    "  <hr style=\"border:none;border-top:1px solid #e08a2e;margin:0 0 20px\">",
    "  <div class=\"items\">",
    "    " + rows,
    "  </div>",
    "</body></html>",
    ""
  ].join("\n");
  return html;
}

// --- email digest via Composio (GMAIL_SEND_EMAIL) ---
const { sendDigestEmail } = require("./_email.js");

// --- main ---
async function main() {
  log("starting digest run");
  let items = [];
  let aiError = null;
  let summaries = [];

  // 1. fetch RSS
  try {
    const xml = await fetchRss(RSS_URL);
    items = dedupe(parseItems(xml)).slice(0, MAX_ITEMS);
    log("rss items: " + items.length);
  } catch (e) {
    aiError = aiError || ("RSS fetch failed: " + e.message);
    log("rss error: " + e.message);
  }

  // 2. summarize
  if (items.length > 0) {
    let apiKey = "";
    try { apiKey = fs.readFileSync(KEY_FILE, "utf8").trim(); } catch (e) { apiKey = ""; }
    if (!apiKey) {
      aiError = aiError || "key.txt is missing or empty";
      log("no key file");
    } else {
      try {
        const text = await summarize(items, apiKey, MODEL);
        const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
        summaries = blocks.slice(0, items.length);
        if (summaries.length < items.length) {
          aiError = aiError || ("AI returned " + summaries.length + " summaries for " + items.length + " headlines");
        }
        log("summaries: " + summaries.length);
      } catch (e) {
        aiError = aiError || ("AI refused: " + e.message);
        log("ai error: " + e.message);
      }
    }
  } else {
    aiError = aiError || "No headlines found from RSS";
  }

  // 3. write digest
  const html = buildHtml(items, summaries, aiError);
  fs.writeFileSync(DIGEST_FILE, html, "utf8");
  log("wrote " + DIGEST_FILE);

  // 3b. email digest via Composio
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const subject = COUNTRY + " Indian expat digest - " + today;
  try {
    await sendDigestEmail(html, subject, DIR, log);
  } catch (e) {
    log("email failed: " + e.message);
    console.log("NOTE: email failed - " + e.message);
  }

  // 4. print to terminal
  console.log("\n===== DIGEST (" + COUNTRY + ") =====");
  items.forEach((it, i) => {
    const s = summaries[i] ? summaries[i].trim() : "(no summary)";
    console.log((i + 1) + ". " + it.title);
    if (it.date) console.log("   " + it.date);
    console.log("   " + s.replace(/\n/g, " / "));
    console.log("");
  });
  if (aiError) console.log("NOTE: " + aiError);
  log("done");
}

main().catch((e) => { console.error("fatal: " + e.message); process.exit(1); });
