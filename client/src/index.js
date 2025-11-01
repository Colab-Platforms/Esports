import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { store } from './store/store';
import App from './App';
import './index.css';

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1a1a1a',
              color: '#ffffff',
              border: '1px solid #374151',
              borderRadius: '0.75rem',
              fontSize: '14px',
              fontWeight: '500'
            },
            success: {
              iconTheme: {
                primary: '#00ff88',
                secondary: '#1a1a1a'
              },
              style: {
                border: '1px solid #00ff88'
              }
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#1a1a1a'
              },
              style: {
                border: '1px solid #ef4444'
              }
            },
            loading: {
              iconTheme: {
                primary: '#3b82f6',
                secondary: '#1a1a1a'
              },
              style: {
                border: '1px solid #3b82f6'
              }
            }
          }}
        />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);