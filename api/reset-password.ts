import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!getApps().length) {
      if (process.env.FIREBASE_ADMIN_CREDENTIALS) {
        let serviceAccount;
        try {
          serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS);
          if (serviceAccount.private_key) {
             serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
          }
        } catch (e) {
          try {
            const decoded = Buffer.from(process.env.FIREBASE_ADMIN_CREDENTIALS, 'base64').toString('utf8');
            serviceAccount = JSON.parse(decoded);
          } catch (e2) {
            return res.status(500).json({ error: "Invalid FIREBASE_ADMIN_CREDENTIALS format. Must be valid JSON or a base64 encoded JSON string." });
          }
        }
        try {
           initializeApp({ credential: cert(serviceAccount) });
        } catch (e: any) {
           return res.status(500).json({ error: `Firebase Admin initialization failed: ${e.message}` });
        }
      } else {
        return res.status(500).json({ error: "Firebase Admin is not configured. Please add FIREBASE_ADMIN_CREDENTIALS to the environment." });
      }
    }

    const { email, newPassword } = req.body;
    if (!email || !newPassword) {
      return res.status(400).json({ error: "Email and new password are required." });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ error: "The password must be a string with at least 6 characters." });
    }

    let userRecord;
    try {
      userRecord = await getAuth().getUserByEmail(email);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        return res.status(404).json({ error: "User not found." });
      }
      throw err;
    }

    await getAuth().updateUser(userRecord.uid, { password: newPassword });

    return res.json({ success: true, message: "Password updated successfully." });

  } catch (error: any) {
    console.error("Error updating password:", error);
    return res.status(500).json({ error: error.message || "Failed to update password." });
  }
}
