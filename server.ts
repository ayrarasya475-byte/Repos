import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Simple in-memory rate limiter to prevent DDoS / Brute force
  const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
  
  app.use((req, res, next) => {
    // 1. Block access to sensitive files
    const lowerUrl = req.url.toLowerCase();
    if (
      lowerUrl.includes(".env") || 
      lowerUrl.includes(".git") || 
      lowerUrl.includes(".github") || 
      lowerUrl.includes("package-lock.json") ||
      lowerUrl.includes("bun.lock") ||
      lowerUrl.includes("tsconfig.json")
    ) {
      return res.status(403).json({ error: "Access Denied: Sensitive workspace resources are protected." });
    }

    // 2. Block scanning tools (Nmap, sqlmap, nikto, dirbuster, gobuster, acunetix)
    const userAgent = (req.headers["user-agent"] || "").toLowerCase();
    const scanners = ["nmap", "sqlmap", "nikto", "dirbuster", "gobuster", "acunetix", "w3af", "masscan"];
    if (scanners.some(scanner => userAgent.includes(scanner))) {
      return res.status(403).json({ error: "Access Denied: Automated security scanners are blocked." });
    }

    // 3. Simple Anti-SQL Injection validation on query parameters
    const sqlInjectionPattern = /union\s+select|select\s+.*\s+from|insert\s+into|delete\s+from|drop\s+table|update\s+.*\s+set|or\s+['"]?\d+['"]?\s*=\s*['"]?\d+['"]?/i;
    for (const key in req.query) {
      const val = req.query[key];
      if (typeof val === "string" && sqlInjectionPattern.test(val)) {
        return res.status(400).json({ error: "Security Exception: Malicious input pattern detected (Anti-SQLi)." });
      }
    }

    // 4. IP-Based Rate Limiting (Anti-DDoS Protection)
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const record = rateLimitMap.get(ip);

    if (!record || now > record.resetTime) {
      rateLimitMap.set(ip, { count: 1, resetTime: now + 60000 }); // 1 minute window
    } else {
      record.count++;
      if (record.count > 100) { // Limit 100 requests per minute
        return res.status(429).json({ error: "Too many requests. Anti-DDoS protection active. Please slow down." });
      }
    }

    // 5. Anti-XSS security headers
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");

    next();
  });

  // API parser helper
  app.use("/api/proxy-vercel-deployments", express.json({ limit: "100mb" }));
  app.use("/api/proxy-vercel-projects", express.json());

  // Lazy-initialized Gemini AI client SDK
  let ai: any = null;
  function getAI() {
    if (!ai) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable is not defined on the server.");
      }
      ai = new GoogleGenAI({ apiKey });
    }
    return ai;
  }

  // Secure full-stack Gemini assistant endpoint
  app.post('/api/gemini/chat', express.json({ limit: '50mb' }), async (req, res) => {
    const { messages, systemPrompt, temperature } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).send("Error: 'messages' array is required in the request body.");
    }

    try {
      const googleAi = getAI();
      
      // Map message history cleanly:
      // Translate 'assistant' to 'model' for Gemini SDK, filter out system roles.
      // Crucial: Merge consecutive turns with the same role and remove empty turns
      // to comply with Gemini's strict alternating turn-taking constraint.
      const contents: any[] = [];
      for (const m of messages) {
        if (!m || m.role === 'system') continue;
        
        const role = m.role === 'user' ? 'user' : 'model';
        const text = (m.content || "").trim();
        if (!text) continue; // Skip empty messages to prevent API crash

        if (contents.length > 0 && contents[contents.length - 1].role === role) {
          // Merge consecutive same-role turns
          contents[contents.length - 1].parts[0].text += "\n\n" + text;
        } else {
          contents.push({
            role: role,
            parts: [{ text: text }]
          });
        }
      }

      // Ensure the history is not empty and starts with user
      if (contents.length === 0) {
        contents.push({
          role: 'user',
          parts: [{ text: 'Hello' }]
        });
      } else if (contents[0].role !== 'user') {
        // If it somehow starts with model, insert a welcoming user message at the front
        contents.unshift({
          role: 'user',
          parts: [{ text: 'Hello' }]
        });
      }

      // Use the recommended standard high-performance model
      const modelName = "gemini-3.6-flash";

      const result = await googleAi.models.generateContent({
        model: modelName,
        contents: contents,
        config: {
          systemInstruction: systemPrompt || "You are an expert full-stack developer in RepostNow Code Studio. Write elegant, production-ready code with detailed comments.",
          temperature: typeof temperature === 'number' ? temperature : 0.7,
        }
      });

      const responseText = result.text || "";
      res.setHeader('Content-Type', 'text/plain');
      res.send(responseText);
    } catch (error: any) {
      console.error("Gemini API Error in /api/gemini/chat:", error);
      res.status(500).send(`AI Error: ${error.message || "Failed to generate AI response"}`);
    }
  });

  // GitHub Proxy to fetch repo ZIP archives securely bypassing CORS with strict anti-caching
  app.get('/api/proxy-github-zip', async (req, res) => {
    const { owner, repo, ref, token } = req.query;
    if (!owner || !repo || !ref || !token) {
      return res.status(400).json({ error: 'Missing required parameters: owner, repo, ref, token' });
    }

    // Set strict anti-caching headers immediately
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    try {
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/zipball/${ref}`, {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'RepostNow-App',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      if (!response.ok) {
        return res.status(response.status).json({ error: `GitHub API returned status ${response.status}` });
      }
      res.setHeader('Content-Type', 'application/zip');
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET: Vercel Deployments list for history tracking
  app.get('/api/proxy-vercel-deployments-list', async (req, res) => {
    const token = req.headers['x-vercel-token'];
    const { projectId, limit, teamId } = req.query;
    if (!token) {
      return res.status(400).json({ error: 'Missing x-vercel-token header' });
    }
    try {
      let url = 'https://api.vercel.com/v6/deployments';
      const params = new URLSearchParams();
      if (projectId) params.append('projectId', projectId as string);
      if (limit) params.append('limit', limit as string);
      if (teamId) params.append('teamId', teamId as string);
      
      const queryString = params.toString();
      if (queryString) url += `?${queryString}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vercel File Upload Proxy with Magic Byte MIME-type validation
  app.post('/api/proxy-vercel-file', express.raw({ limit: '100mb', type: '*/*' }), async (req, res) => {
    const token = req.headers['x-vercel-token'];
    const digest = req.headers['x-now-digest'];
    const size = req.headers['x-now-size'];
    const fileName = req.query.file as string || "";
    
    if (!token || !digest || !size) {
      return res.status(400).json({ error: 'Missing required headers: x-vercel-token, x-now-digest, x-now-size' });
    }

    // Auto-ignore environment files (.env*) and sensitive system dotfiles to avoid 403 Forbidden from Vercel
    const cleanLower = fileName.toLowerCase().replace(/\\/g, '/');
    const baseName = cleanLower.split('/').pop() || cleanLower;
    if (
      baseName.startsWith('.env') ||
      baseName.endsWith('.env') ||
      cleanLower.includes('node_modules/') ||
      cleanLower.includes('.git/') ||
      cleanLower.includes('.github/') ||
      baseName === '.ds_store' ||
      baseName === '.gitignore' ||
      baseName === '.npmrc'
    ) {
      return res.status(200).json({ id: digest, message: 'Safely ignored sensitive or environment file' });
    }

    // MIME type content verification
    const bodyBuffer = req.body as Buffer;
    if (bodyBuffer && bodyBuffer.length > 0) {
      const contentSample = bodyBuffer.slice(0, 100).toString("utf-8");
      
      // Prevent PHP/ASP/Shell scripts posing as other files (XSS / Remote Code Execution safety)
      if (
        contentSample.includes("<?php") ||
        contentSample.includes("<?=") ||
        contentSample.includes("eval(") ||
        contentSample.includes("shell_exec") ||
        contentSample.includes("exec(") ||
        contentSample.includes("system(")
      ) {
        return res.status(400).json({ error: `Security Exception: File contents contain unallowed scripting tags (PHP/ASP/Shell commands detected).` });
      }

      // Check image headers (PNG / JPEG) vs content
      if (fileName.endsWith(".png")) {
        // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
        if (bodyBuffer.length >= 4 && (bodyBuffer[0] !== 0x89 || bodyBuffer[1] !== 0x50 || bodyBuffer[2] !== 0x4e || bodyBuffer[3] !== 0x47)) {
          return res.status(400).json({ error: `Security Exception: PNG file "${fileName}" fails internal format signature validation.` });
        }
      } else if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg")) {
        // JPEG magic bytes: FF D8
        if (bodyBuffer.length >= 2 && (bodyBuffer[0] !== 0xff || bodyBuffer[1] !== 0xd8)) {
          return res.status(400).json({ error: `Security Exception: JPEG file "${fileName}" fails internal format signature validation.` });
        }
      }
    }
    
    try {
      const queryParams = new URLSearchParams(req.query as any).toString();
      const url = `https://api.vercel.com/v2/files${queryParams ? `?${queryParams}` : ''}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/octet-stream',
          'x-now-digest': digest as string,
          'x-now-size': size as string,
        },
        body: req.body,
      });
      
      const responseText = await response.text();
      res.status(response.status).send(responseText);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vercel Deployment Creation Proxy to bypass CORS on deployment initialization
  app.post('/api/proxy-vercel-deployments', async (req, res) => {
    const token = req.headers['x-vercel-token'];
    if (!token) {
      return res.status(400).json({ error: 'Missing x-vercel-token header' });
    }
    try {
      const queryParams = new URLSearchParams(req.query as any).toString();
      const url = `https://api.vercel.com/v13/deployments${queryParams ? `?${queryParams}` : ''}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(req.body),
      });
      
      const responseData = await response.json();
      res.status(response.status).json(responseData);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vercel Deployment Polling Proxy to safely monitor progress states
  app.get('/api/proxy-vercel-poll/:id', async (req, res) => {
    const token = req.headers['x-vercel-token'];
    const { id } = req.params;
    if (!token) {
      return res.status(400).json({ error: 'Missing x-vercel-token header' });
    }
    try {
      const queryParams = new URLSearchParams(req.query as any).toString();
      const url = `https://api.vercel.com/v13/deployments/${id}${queryParams ? `?${queryParams}` : ''}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      const responseData = await response.json();
      res.status(response.status).json(responseData);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET: Vercel Projects List
  app.get('/api/proxy-vercel-projects', async (req, res) => {
    const token = req.headers['x-vercel-token'];
    if (!token) {
      return res.status(400).json({ error: 'Missing x-vercel-token header' });
    }
    try {
      const queryParams = new URLSearchParams(req.query as any).toString();
      const url = `https://api.vercel.com/v9/projects${queryParams ? `?${queryParams}` : ''}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE: Vercel Project
  app.delete('/api/proxy-vercel-projects/:id', async (req, res) => {
    const token = req.headers['x-vercel-token'];
    const { id } = req.params;
    if (!token) {
      return res.status(400).json({ error: 'Missing x-vercel-token header' });
    }
    try {
      const queryParams = new URLSearchParams(req.query as any).toString();
      const url = `https://api.vercel.com/v9/projects/${id}${queryParams ? `?${queryParams}` : ''}`;
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });
      if (response.status === 204) {
        return res.status(204).send();
      }
      const text = await response.text();
      let data;
      try {
        data = text ? JSON.parse(text) : { success: true };
      } catch {
        data = { success: true };
      }
      res.status(response.status).json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET: Vercel Project Domains
  app.get('/api/proxy-vercel-projects/:idOrName/domains', async (req, res) => {
    const token = req.headers['x-vercel-token'];
    const { idOrName } = req.params;
    if (!token) {
      return res.status(400).json({ error: 'Missing x-vercel-token header' });
    }
    try {
      const queryParams = new URLSearchParams(req.query as any).toString();
      const url = `https://api.vercel.com/v9/projects/${idOrName}/domains${queryParams ? `?${queryParams}` : ''}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST: Add Vercel Project Domain
  app.post('/api/proxy-vercel-projects/:idOrName/domains', express.json(), async (req, res) => {
    const token = req.headers['x-vercel-token'];
    const { idOrName } = req.params;
    if (!token) {
      return res.status(400).json({ error: 'Missing x-vercel-token header' });
    }
    try {
      const queryParams = new URLSearchParams(req.query as any).toString();
      const url = `https://api.vercel.com/v9/projects/${idOrName}/domains${queryParams ? `?${queryParams}` : ''}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(req.body),
      });
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE: Delete Vercel Project Domain
  app.delete('/api/proxy-vercel-projects/:idOrName/domains/:domain', async (req, res) => {
    const token = req.headers['x-vercel-token'];
    const { idOrName, domain } = req.params;
    if (!token) {
      return res.status(400).json({ error: 'Missing x-vercel-token header' });
    }
    try {
      const queryParams = new URLSearchParams(req.query as any).toString();
      const url = `https://api.vercel.com/v9/projects/${idOrName}/domains/${domain}${queryParams ? `?${queryParams}` : ''}`;
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });
      if (response.status === 204) {
        return res.status(204).send();
      }
      const text = await response.text();
      let data;
      try {
        data = text ? JSON.parse(text) : { success: true };
      } catch {
        data = { success: true };
      }
      res.status(response.status).json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET: Vercel limits / User account context
  app.get('/api/proxy-vercel-user', async (req, res) => {
    const token = req.headers['x-vercel-token'];
    if (!token) {
      return res.status(400).json({ error: 'Missing x-vercel-token header' });
    }
    try {
      const response = await fetch('https://api.vercel.com/v2/user', {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite development middleware or static production handler
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
