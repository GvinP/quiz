import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initTelegram } from './telegram/webapp.ts';
import { App } from './App.tsx';
import './styles.css';

initTelegram();

const container = document.getElementById('root');
if (!container) throw new Error('Не найден #root');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
