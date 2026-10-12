import https from "node:https";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { XMLParser } from "fast-xml-parser";
import { createHash } from "node:crypto";

export function publicAddress(address) {
  const value = address.toLowerCase();
  if (isIP(value) === 6) {
    // Only global unicast; rejects loopback, mapped IPv4, local and multicast.
    return /^[23][0-9a-f]{3}:/.test(value) && !value.startsWith("2001:db8:");
  }
  if (isIP(value) !== 4) return false;
  const [a, b] = value.split(".").map(Number);
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && [0, 168].includes(b)) ||
    (a === 198 && [18, 19, 51].includes(b)) ||
    (a === 203 && b === 0)
  );
}

export function publicUrl(raw) {
  const url = new URL(raw);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    url.hostname === "localhost" ||
    url.hostname.endsWith(".local")
  )
    throw new Error("Public HTTPS URL required");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) && !publicAddress(host))
    throw new Error("Private address rejected");
  return url;
}

export async function readPublic(raw, redirects = 0) {
  const url = publicUrl(raw);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host)
    ? [{ address: host, family: isIP(host) }]
    : await lookup(host, { all: true });
  if (
    !addresses.length ||
    addresses.some(({ address }) => !publicAddress(address))
  )
    throw new Error("Non-public DNS result");
  // Pin the validated address for this connection, avoiding a second DNS lookup.
  const pinned = addresses[0];
  const result = await new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: { "user-agent": "PersonalAI-News-Hub/2.0 (RSS reader)" },
        lookup: (_hostname, options, callback) =>
          options.all
            ? callback(null, [pinned])
            : callback(null, pinned.address, pinned.family),
      },
      res => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
          res.resume();
          resolve({ redirect: res.headers.location });
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        let size = 0;
        const chunks = [];
        res.on("data", chunk => {
          size += chunk.length;
          if (size > 5_000_000)
            res.destroy(new Error("Feed size limit exceeded"));
          else chunks.push(chunk);
        });
        res.on("end", () =>
          resolve({ text: Buffer.concat(chunks).toString("utf8") })
        );
        res.on("error", reject);
      }
    );
    const timer = setTimeout(
      () => req.destroy(new Error("Feed timeout")),
      20_000
    );
    req.on("close", () => clearTimeout(timer));
    req.on("error", reject);
  });
  if (result.redirect) {
    if (redirects >= 3) throw new Error("Redirect limit exceeded");
    return readPublic(new URL(result.redirect, url).href, redirects + 1);
  }
  return result.text;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  parseTagValue: false,
  processEntities: false,
});
const array = v => (v == null ? [] : Array.isArray(v) ? v : [v]);
export const clean = v =>
  String(typeof v === "object" && v !== null ? (v["#text"] ?? "") : (v ?? ""))
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
export const articleId = url =>
  createHash("sha256").update(url).digest("hex").slice(0, 24);

export function parseFeed(xml, feed) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("DTD is not supported");
  const document = parser.parse(xml);
  if (!document.feed && !document.rss?.channel && !document["rdf:RDF"])
    throw new Error("RSS or Atom required");
  const atom = !!document.feed;
  const entries = array(
    atom
      ? document.feed.entry
      : (document.rss?.channel?.item ?? document["rdf:RDF"]?.item)
  );
  return entries.slice(0, 100).flatMap(entry => {
    try {
      const link = atom
        ? array(entry.link).find(
            l => !l["@_rel"] || l["@_rel"] === "alternate"
          )?.["@_href"]
        : clean(entry.link) || clean(entry.guid);
      const url = publicUrl(link).href;
      const title = clean(entry.title).slice(0, 1024);
      if (!title) return [];
      const date = new Date(
        clean(
          entry.published ||
            entry.updated ||
            entry.pubDate ||
            entry["dc:date"] ||
            entry.date
        )
      );
      return [
        {
          id: articleId(url),
          title,
          url,
          publishedAt: Number.isNaN(date.getTime()) ? null : date.toISOString(),
          description: clean(
            entry.summary ||
              entry.content ||
              entry.description ||
              entry["content:encoded"]
          ).slice(0, 10000),
          sourceName: feed.name,
          category: feed.category,
          feedId: feed.id,
        },
      ];
    } catch {
      return [];
    }
  });
}
