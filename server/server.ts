import express, { Request, Response } from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { URL } from "url";
import dns from "dns/promises";
import net from "net";
import cors from "cors";


const app = express();
app.use(express.json());

const PORT = 3000;

// --- Config ---
const MAX_SIZE = 1512 * 1024; // 512 KB
const TIMEOUT = 5000; // 5s
const MAX_REDIRECTS = 3;
const GOAL_USER_AGENT = "MyPreviewBot/1.0";

// --- Rate Limiter (10 req/min/IP) ---
const rateLimiter = new RateLimiterMemory({
  points: 10,
  duration: 60,
});


async function fetchHtml(url: string) {
  const { data } = await axios.get(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  return cheerio.load(data);
}

function isPrivateIp(ip: string): boolean {
    // IPv4 private ranges
    return (
      ip.startsWith("10.") || // 10.0.0.0/8
      ip.startsWith("192.168.") || // 192.168.0.0/16
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip) || // 172.16.0.0/12
      ip === "127.0.0.1" || // loopback
      ip === "::1" || // IPv6 loopback
      ip.startsWith("fc") || ip.startsWith("fd") // IPv6 unique local
    );
  }

  
// SSRF Protection: block private/local IPs
async function validateUrl(url: string) {
  try {
    const parsed = new URL(url);
    const ips = await dns.lookup(parsed.hostname, { all: true });
    for (const { address } of ips) {
      if (
        isPrivateIp(address) || // local network
        address.startsWith("127.") ||
        address.startsWith("0.") ||
        address === "::1"
      ) {
        throw new Error("Blocked private/loopback address (SSRF protection).");
      }
    }
    return parsed.toString();
  } catch (err) {
    throw new Error("Invalid or unsafe URL.");
  }
}


function extractMeta($: cheerio.CheerioAPI, url: string) {
  const get = (sel: string) =>
    $(`meta[property="${sel}"]`).attr("content") ||
    $(`meta[name="${sel}"]`).attr("content");

  let title =
    get("og:title") || get("twitter:title") || $("title").text();
  let image =
    get("og:image") ||
    get("twitter:image") ||
    $("link[rel='image_src']").attr("href");
  let price: string | undefined;
  let currency: string | undefined;

  // 1. JSON-LD (works across Amazon, Walmart, Flipkart)
  $("script[type='application/ld+json']").each((_, el) => {
    try {
      const json = JSON.parse($(el).html() || "{}");
      if (json["@type"] === "Product") {
        if (json.name) title = json.name;
        if (json.image) {
          image = Array.isArray(json.image) ? json.image[0] : json.image;
        }
        if (json.offers) {
          const offers = Array.isArray(json.offers) ? json.offers[0] : json.offers;
          if (offers.price) price = offers.price;
          if (offers.priceCurrency) currency = offers.priceCurrency;
        }
      }
    } catch {}
  });

  const html = $.html();

  // 2. Flipkart inline JSON (price, images)
  if (!price || !image) {
    const priceMatch = html.match(/"price"\s*:\s*"₹?([\d,.]+)"/i);
    if (priceMatch) {
      price = priceMatch[1].replace(/,/g, "");
      currency = "INR";
    }
    const imgMatch = html.match(/"images":\s*\[(\s*".*?")\]/);
    if (imgMatch) {
      try {
        const arr = JSON.parse(`[${imgMatch[1]}]`);
        if (Array.isArray(arr) && arr.length > 0) {
          image = arr[0];
        }
      } catch {}
    }
  }

  // 3.Amazon DOM fallback
  if (!price) {
    const spanPrice = $(".a-price-whole").first().text();
    if (spanPrice) price = spanPrice.replace(/[^\d.]/g, "");
  }
  if (!currency) {
    const symbol =
      $(".a-price-symbol").first().text().trim() ||
      $("span.priceSymbol").first().text().trim();
    if (symbol === "₹") currency = "INR";
    else if (symbol === "$") currency = "USD";
    else if (symbol) currency = symbol;
  }

  return {
    title: title?.trim() || null,
    image: image ? new URL(image, url).toString() : null,
    price: price ? parseFloat(price) : null,
    currency: currency || null,
    siteName: new URL(url).hostname,
    sourceUrl: url,
  };
}



// Allow requests from your frontend
app.use(
  cors({
    origin: ["http://localhost:8080", "http://localhost:8081", "http://localhost:8082"],
    methods: ["GET", "POST", "OPTIONS"], // allow OPTIONS
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true, // if you need cookies/auth headers
  })
);

// --- Endpoint ---
app.post("/preview", async (req: Request, res: Response) => {
  const ip = req.ip;

  try {
    // @ts-ignore
    await rateLimiter.consume(ip);
  } catch {
    return res.status(429).json({ error: "Rate limit exceeded (10/min/IP)" });
  }

  let { url } = req.body;
  if (!url) return res.status(400).json({ error: "url is required" });

  try {
    url = await validateUrl(url);

    const resp = await axios.get(url, {
      timeout: TIMEOUT,
      maxRedirects: MAX_REDIRECTS,
      responseType: "arraybuffer",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!resp.headers["content-type"]?.includes("text/html")) {
      return res.status(400).json({ error: "URL did not return HTML" });
    }

    if (resp.data.length > MAX_SIZE) {
      return res.status(400).json({ error: "HTML exceeds max size (512KB)" });
    }

    const html = resp.data.toString("utf-8");
    const $ = cheerio.load(html);
    const meta = extractMeta($, url);

    return res.json(meta);
  } catch (err: any) {
    console.error("Error fetching preview:", err.message);
    return res.status(400).json({ error: err.message });
  }
});


app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
