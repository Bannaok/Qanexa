import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register PWA Service Worker for offline support and immediate auto-update
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('New app version available, reloading...');
  },
  onOfflineReady() {
    console.log('App ready to work offline.');
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
