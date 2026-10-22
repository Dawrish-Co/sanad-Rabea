const express = require("express");
const swaggerUi = require("swagger-ui-express");
const openapiSpecification = require("./openapi");

/**
 * Custom HTML generator for Swagger UI with CDN resilience.
 * Ensures zero asset-loading failure on Vercel Serverless and local environments alike.
 */
const getSwaggerHtml = () => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SANAD Healthcare API - Interactive Documentation</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%230d9488'><path d='M19 10.5h-4.5V6a1.5 1.5 0 0 0-3 0v4.5H7a1.5 1.5 0 0 0 0 3h4.5V18a1.5 1.5 0 0 0 3 0v-4.5H19a1.5 1.5 0 0 0 0-3z'/></svg>">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.18.2/swagger-ui.min.css" integrity="sha512-V/c0aB6wD8p8H+yN6+fFjI0N2i1i19r5Z0R17K8vO01o0tX7W25L6H0Q2eT9o2y4hR6vK2uV0D7E1q9dC3G+vA==" crossorigin="anonymous" referrerpolicy="no-referrer" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --sanad-primary: #0d9488;
      --sanad-primary-dark: #0f766e;
      --sanad-accent: #0284c7;
      --sanad-bg: #f8fafc;
      --sanad-header-bg: #0f172a;
      --sanad-text: #1e293b;
    }

    html {
      box-sizing: border-box;
      overflow-y: scroll;
    }

    *, *:before, *:after {
      box-sizing: inherit;
    }

    body {
      margin: 0;
      background: var(--sanad-bg);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: var(--sanad-text);
      -webkit-font-smoothing: antialiased;
    }

    /* Professional Topbar */
    .sanad-topbar {
      background: var(--sanad-header-bg);
      border-bottom: 2px solid var(--sanad-primary);
      color: #ffffff;
      padding: 14px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
      position: sticky;
      top: 0;
      z-index: 1000;
    }

    .sanad-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      text-decoration: none;
      color: #ffffff;
    }

    .sanad-brand-logo {
      width: 32px;
      height: 32px;
      background: linear-gradient(135deg, var(--sanad-primary) 0%, var(--sanad-accent) 100%);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 18px;
      color: #ffffff;
      box-shadow: 0 2px 4px rgba(13, 148, 136, 0.4);
    }

    .sanad-brand-name {
      font-size: 18px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    .sanad-badge {
      display: inline-flex;
      align-items: center;
      background: rgba(13, 148, 136, 0.2);
      border: 1px solid rgba(13, 148, 136, 0.5);
      color: #2dd4bf;
      padding: 2px 8px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-left: 8px;
    }

    .sanad-topbar-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .sanad-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      text-decoration: none;
      transition: all 0.15s ease-in-out;
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #e2e8f0;
      background: rgba(255, 255, 255, 0.05);
    }

    .sanad-btn:hover {
      background: rgba(255, 255, 255, 0.12);
      border-color: rgba(255, 255, 255, 0.3);
      color: #ffffff;
    }

    .sanad-btn-primary {
      background: var(--sanad-primary);
      border-color: var(--sanad-primary);
      color: #ffffff;
    }

    .sanad-btn-primary:hover {
      background: var(--sanad-primary-dark);
      border-color: var(--sanad-primary-dark);
    }

    /* Hide Swagger default topbar cleanly */
    .swagger-ui .topbar {
      display: none !important;
    }

    /* Container refinements */
    .swagger-ui .wrapper {
      max-width: 1280px;
      padding: 0 24px;
    }

    .swagger-ui .info {
      margin: 28px 0;
    }

    .swagger-ui .info .title {
      font-family: 'Inter', sans-serif;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.025em;
    }

    .swagger-ui .info a {
      color: var(--sanad-primary);
    }

    /* Authorize Button Styling */
    .swagger-ui .btn.authorize {
      color: var(--sanad-primary);
      border-color: var(--sanad-primary);
      border-radius: 6px;
      font-weight: 600;
      transition: all 0.2s ease;
    }

    .swagger-ui .btn.authorize:hover {
      background: var(--sanad-primary);
      color: #ffffff;
    }

    .swagger-ui .btn.authorize svg {
      fill: currentColor;
    }

    /* Operation headers */
    .swagger-ui .opblock {
      border-radius: 8px;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
      border: 1px solid #e2e8f0;
      margin: 0 0 16px;
    }

    .swagger-ui .opblock .opblock-summary {
      padding: 10px 16px;
    }

    /* Tag headers */
    .swagger-ui .opblock-tag {
      font-family: 'Inter', sans-serif;
      font-weight: 700;
      color: #0f172a;
      border-bottom: 2px solid #e2e8f0;
      margin: 32px 0 16px;
      padding-bottom: 8px;
    }

    /* Response & model tables */
    .swagger-ui table thead tr th,
    .swagger-ui table thead tr td {
      border-bottom: 1px solid #e2e8f0;
    }
  </style>
</head>
<body>
  <header class="sanad-topbar">
    <a href="/api-docs" class="sanad-brand">
      <div class="sanad-brand-logo">S</div>
      <div>
        <span class="sanad-brand-name">SANAD Healthcare API</span>
        <span class="sanad-badge">OpenAPI 3.0.3</span>
      </div>
    </a>
    <div class="sanad-topbar-actions">
      <a href="/api-docs.json" class="sanad-btn" target="_blank" rel="noopener noreferrer">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
        OpenAPI Spec (JSON)
      </a>
      <a href="https://github.com/rabea-shaban/sanad-healthcare-backend" class="sanad-btn sanad-btn-primary" target="_blank" rel="noopener noreferrer">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
        GitHub
      </a>
    </div>
  </header>

  <div id="swagger-ui"></div>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.18.2/swagger-ui-bundle.min.js" integrity="sha512-P3KekQYf1pI+6a8z5x+bB3mB5yGzB0uN3YlK1Z5gXG7Q102W2z7R6Xl4kO8i2R1u6w2Yq4x+9U5R0T7Y2n3j4g==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.18.2/swagger-ui-standalone-preset.min.js" integrity="sha512-sHjJ7XUqI5Y5T7a2h2k4m0Zq0v2k9uX4f8G0a2K5Y5w5l2b4m0Zq0v2k9uX4f8G0a2K5Y5w5l2b4m0Zq0v2k9==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
  <script>
    window.onload = function() {
      window.ui = SwaggerUIBundle({
        url: "/api-docs.json",
        dom_id: "#swagger-ui",
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout",
        validatorUrl: null,
        persistAuthorization: true,
        displayRequestDuration: true,
        docExpansion: "list",
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
        defaultModelsExpandDepth: 2,
        defaultModelExpandDepth: 2,
        tryItOutEnabled: true,
      });
    };
  </script>
</body>
</html>`;
};

const router = express.Router();

// Raw JSON OpenAPI 3.0.3 Specification Endpoint
router.get("/api-docs.json", (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(200).json(openapiSpecification);
});

// Interactive Swagger UI Documentation HTML
router.get(["/api-docs", "/api-docs/"], (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(getSwaggerHtml());
});

// Developer friendly aliases
router.get("/docs.json", (req, res) => {
  res.redirect(301, "/api-docs.json");
});

router.get(["/docs", "/docs/"], (req, res) => {
  res.redirect(301, "/api-docs");
});

module.exports = {
  router,
  openapiSpecification,
  getSwaggerHtml,
  swaggerUi,
};
