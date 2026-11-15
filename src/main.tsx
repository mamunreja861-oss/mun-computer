import {createRoot} from 'react-dom/client';
import './index.css';
import '../css/style.css';
import '../css/dashboard.css';
import '../css/components.css';
import '../css/responsive.css';
import App from './App.tsx';
import { FirebaseProvider } from './contexts/FirebaseContext';

if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      if (registration.active?.scriptURL?.includes('dev-sw')) {
        registration.unregister();
      }
    });
  });
}

// Tier 1 Google Maps Demo Key Quota Defense
(window as any).gm_authFailure = () => {
  window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
};

const origConsoleError = console.error;
console.error = (...args: any[]) => {
  origConsoleError.apply(console, args);
  if (
    args.some(
      (a) =>
        typeof a === 'string' &&
        (a.includes('OverQuotaMapError') || a.includes('QuotaExceededError'))
    )
  ) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
};

createRoot(document.getElementById('root')!).render(
  <FirebaseProvider>
    <App />
  </FirebaseProvider>
);
