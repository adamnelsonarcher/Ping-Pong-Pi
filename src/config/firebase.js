import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onAuthStateChanged } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * Resolves once Firebase has finished restoring any persisted session.
 *
 * `auth.currentUser` is null for the first moments after a page load even when
 * the user is signed in, because the SDK restores the session asynchronously.
 * Anything that needs a token must await this first, or the very first request
 * after a reload goes out unauthenticated and gets a 401.
 */
export const authReady = new Promise((resolve) => {
  const unsubscribe = onAuthStateChanged(
    auth,
    (user) => {
      unsubscribe();
      resolve(user);
    },
    (error) => {
      console.error('Firebase auth failed to initialise:', error);
      unsubscribe();
      resolve(null);
    }
  );
});
