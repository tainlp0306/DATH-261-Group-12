import React from 'react';
import { createRoot } from 'react-dom/client';
import PracticePrototypePage from './pages/PracticePrototypePage';

import './pages/PracticePrototypePage.css';

createRoot(document.getElementById('root')).render(
  //<React.StrictMode>
    <PracticePrototypePage />
  //</React.StrictMode>
);