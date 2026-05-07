import express, { type Express, type Request, type Response } from "express";
import fs from "fs";
import path from "path";
import escapeHtml from "escape-html";

export function serveStatic(app: Express) {
  // In production, static files are in dist/public relative to cwd
  const distPath = path.resolve(process.cwd(), "dist", "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.get("/robots.txt", (req: Request, res: Response) => {
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    res.type("text/plain").send([
      "User-agent: *",
      "Allow: /",
      "Allow: /rankings",
      "Allow: /methodology",
      "Allow: /token/",
      "Allow: /pricing",
      "Disallow: /admin",
      "Disallow: /account",
      "Disallow: /subscription/",
      `Sitemap: ${baseUrl}/sitemap.xml`,
      "",
    ].join("\n"));
  });

  app.get("/sitemap.xml", async (req: Request, res: Response) => {
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const today = new Date().toISOString().split("T")[0];
    const urls = [
      { path: "/", priority: "1.0", changefreq: "daily" },
      { path: "/rankings", priority: "0.9", changefreq: "daily" },
      { path: "/methodology", priority: "0.8", changefreq: "monthly" },
      { path: "/pricing", priority: "0.7", changefreq: "weekly" },
      { path: "/vote", priority: "0.6", changefreq: "weekly" },
    ];

    try {
      const leaderboardResponse = await fetch(`http://localhost:${process.env.PORT || 5000}/api/leaderboard?limit=10&sortBy=latestScore&order=desc`);
      if (leaderboardResponse.ok) {
        const leaderboard = await leaderboardResponse.json();
        const tokenUrls = (leaderboard.items || [])
          .map((item: { tokenSymbol?: string }) => item.tokenSymbol?.trim())
          .filter(Boolean)
          .slice(0, 10)
          .map((symbol: string) => ({
            path: `/token/${encodeURIComponent(symbol.toUpperCase())}`,
            priority: "0.8",
            changefreq: "daily",
          }));

        urls.push(...tokenUrls);
      }
    } catch (error) {
      console.warn("Unable to add token pages to sitemap:", error);
    }

    const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(({ path: urlPath, priority, changefreq }) => `  <url>
    <loc>${baseUrl}${urlPath}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`).join("\n")}
</urlset>
`;

    res.type("application/xml").send(body);
  });

  app.get("/llms.txt", (req: Request, res: Response) => {
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    res.type("text/plain").send([
      "# Nash Satoshi",
      "",
      "Nash Satoshi ranks crypto tokens using 4-LLM consensus analysis, cross-model validation, and game-theory scoring.",
      "",
      "## Core pages",
      `- Rankings: ${baseUrl}/rankings`,
      `- Methodology: ${baseUrl}/methodology`,
      `- Pricing and token alerts: ${baseUrl}/pricing`,
      `- Token voting: ${baseUrl}/vote`,
      "",
      "## What to cite",
      "- The product compares token opportunities across multiple AI models instead of a single-model score.",
      "- The methodology evaluates narrative strength, incentives, coordination dynamics, liquidity context, and game-theory positioning.",
      "- Scores are positioning research outputs, not price predictions, financial advice, or buy/sell signals.",
      "- Consensus and disagreement both matter: agreement can strengthen a signal, while disagreement can surface uncertainty or fragile assumptions.",
      "- Rankings emphasize consensus level, model reasoning, risk flags, and tiered positioning scores.",
      "- Paid intent centers on early alerts for new high-consensus token picks.",
      "",
    ].join("\n"));
  });

  app.use(express.static(distPath));

  // Handle /analyze/:id routes with dynamic Open Graph meta tags for Twitter cards
  app.get("/analyze/:id", async (req: Request, res: Response) => {
    try {
      const analysisId = req.params.id;
      const indexPath = path.resolve(distPath, "index.html");
      let html = fs.readFileSync(indexPath, "utf-8");

      // Fetch analysis data for OG tags
      const ogDataUrl = `http://localhost:${process.env.PORT || 5000}/api/analyze/${analysisId}/og-data`;
      const ogResponse = await fetch(ogDataUrl);

      if (ogResponse.ok) {
        const analysis = await ogResponse.json();
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        const shareImageUrl = `${baseUrl}/api/share/${analysisId}.png`;
        const pageUrl = `${baseUrl}/analyze/${analysisId}`;

        // Escape user-provided data to prevent XSS
        const safeSymbol = escapeHtml(analysis.tokenSymbol || "");
        const safeTier = escapeHtml(analysis.tier || "N/A");
        const safeRec = escapeHtml(analysis.recommendation || "PENDING");
        const safeConsensus = escapeHtml(analysis.consensusLevel || "MIXED");
        const safeScore = parseFloat(analysis.finalScore || 0).toFixed(1);

        // Create Open Graph meta tags for Twitter card
        const ogTags = `
    <!-- Open Graph / Twitter Card Meta Tags -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${pageUrl}" />
    <meta property="og:title" content="Nash Satoshi $${safeSymbol} Game Theory Analysis" />
    <meta property="og:description" content="Score: ${safeScore}/100 (${safeTier} Tier) | Signal: ${safeRec} | ${safeConsensus} Consensus" />
    <meta property="og:image" content="${shareImageUrl}" />
    <meta property="og:image:width" content="600" />
    <meta property="og:image:height" content="400" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Nash Satoshi $${safeSymbol} Game Theory Analysis" />
    <meta name="twitter:description" content="Score: ${safeScore}/100 (${safeTier} Tier) | Signal: ${safeRec}" />
    <meta name="twitter:image" content="${shareImageUrl}" />
    `;

        // Inject OG tags into the head
        html = html.replace("</head>", `${ogTags}</head>`);
      }

      res.setHeader("Content-Type", "text/html");
      res.send(html);
    } catch (error) {
      console.error("Error serving analyze page with OG tags:", error);
      // Fallback to regular index.html
      res.sendFile(path.resolve(distPath, "index.html"));
    }
  });

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
