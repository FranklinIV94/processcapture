import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Tailwind CSS via CDN for dev (in production, use proper Tailwind build)
const tailwindScript = document.createElement('script');
tailwindScript.src = 'https://cdn.tailwindcss.com';
document.head.appendChild(tailwindScript);

const root = createRoot(document.getElementById('root')!);
root.render(<App />);