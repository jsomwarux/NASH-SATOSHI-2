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
