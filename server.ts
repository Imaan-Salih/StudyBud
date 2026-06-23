import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin
try {
  if (process.env.FIREBASE_ADMIN_CREDENTIALS) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS);
    if (!getApps().length) {
      initializeApp({
        credential: cert(serviceAccount)
      });
      console.log("Firebase Admin initialized successfully.");
    }
  } else {
    console.warn("FIREBASE_ADMIN_CREDENTIALS environment variable not found. Admin features will be disabled.");
  }
} catch (error) {
  console.error("Failed to parse FIREBASE_ADMIN_CREDENTIALS:", error);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Add body parser for JSON requests
  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/reset-password", async (req, res) => {
    try {
      if (!getApps().length) {
        return res.status(500).json({ error: "Firebase Admin is not configured. Please add FIREBASE_ADMIN_CREDENTIALS to the environment." });
      }

      const { email, newPassword } = req.body;
      if (!email || !newPassword) {
        return res.status(400).json({ error: "Email and new password are required." });
      }

      // Find user by email
      let userRecord;
      try {
        userRecord = await getAuth().getUserByEmail(email);
      } catch (err: any) {
        if (err.code === 'auth/user-not-found') {
          return res.status(404).json({ error: "User not found." });
        }
        throw err;
      }

      // Update their password
      await getAuth().updateUser(userRecord.uid, {
        password: newPassword
      });

      return res.json({ success: true, message: "Password updated successfully." });

    } catch (error: any) {
      console.error("Error updating password:", error);
      return res.status(500).json({ error: error.message || "Failed to update password." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Support Express 4 logic since version is ^4.21.2
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
