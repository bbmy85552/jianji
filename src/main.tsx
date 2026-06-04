import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { DialogHost } from './components/DialogHost';
import { installI18nDomTranslator } from './lib/i18n';
import './index.css';

installI18nDomTranslator();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
    <DialogHost />
  </StrictMode>,
);
