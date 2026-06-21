export default {
  async fetch(request) {

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // Only allow POST
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    try {
      const body = await request.text();

      // Read headers from the incoming request
      const apiKey        = request.headers.get("x-api-key");
      const anthropicVer  = request.headers.get("anthropic-version") || "2023-06-01";
      const anthropicBeta = request.headers.get("anthropic-beta");

      // Validate API key is present
      if (!apiKey) {
        return new Response(JSON.stringify({ error: { message: "Missing x-api-key header" } }), {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      // Build forward headers — only include anthropic-beta if it has a real value
      const forwardHeaders = {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": anthropicVer,
      };
      if (anthropicBeta && anthropicBeta.trim() !== "") {
        forwardHeaders["anthropic-beta"] = anthropicBeta;
      }

      // Forward to Anthropic
      const anthropicResp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: forwardHeaders,
        body: body,
      });

      const responseText = await anthropicResp.text();

      return new Response(responseText, {
        status: anthropicResp.status,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: { message: "Worker error: " + err.message } }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
  },
};
