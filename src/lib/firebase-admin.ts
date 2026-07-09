import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import fallbackConfig from '../../firebase-applet-config.json';

if (!getApps().length) {
  initializeApp({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || fallbackConfig.projectId,
  });
}

export const adminAuth = getAuth();
