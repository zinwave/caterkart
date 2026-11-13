import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import App from './App';
import './index.css';
// Installs the axios interceptor that attaches the CaterBox bearer token to
// our own API calls. Imported here, at the entry point, so it is wired before
// any page can fire a request — a lazily-loaded page that happens to import it
// first is not something to depend on.
import './caterkart/services/authToken';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/*
      HelmetProvider replaces react-helmet, which mutated a module-level
      singleton and used lifecycle methods React 18 warns about in StrictMode —
      where every component mounts twice, so the head could end up with
      duplicated or stale tags.
    */}
    <HelmetProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>
);
