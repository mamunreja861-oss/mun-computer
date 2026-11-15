import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  auth,
  signInWithGoogleFirebase,
  signOutFirebase,
  testFirestoreConnection
} from '../firebase';

interface FirebaseContextValue {
  firebaseUser: User | null;
  authReady: boolean;
  firestoreConnected: boolean;
  signInWithGoogle: () => Promise<User | null>;
  signOutGoogle: () => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextValue>({
  firebaseUser: null,
  authReady: false,
  firestoreConnected: false,
  signInWithGoogle: async () => null,
  signOutGoogle: async () => {}
});

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [firestoreConnected, setFirestoreConnected] = useState(false);

  useEffect(() => {
    let mounted = true;

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!mounted) return;
      setFirebaseUser(user);
      setAuthReady(true);

      if (user) {
        const ok = await testFirestoreConnection();
        if (mounted) setFirestoreConnected(ok);
      } else {
        setFirestoreConnected(false);
      }
    });

    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  const signInWithGoogle = async () => {
    const cred = await signInWithGoogleFirebase();
    return cred.user;
  };

  const signOutGoogle = async () => {
    await signOutFirebase();
  };

  return (
    <FirebaseContext.Provider
      value={{
        firebaseUser,
        authReady,
        firestoreConnected,
        signInWithGoogle,
        signOutGoogle
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
};

export function useFirebase() {
  return useContext(FirebaseContext);
}
