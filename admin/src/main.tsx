import React from 'react';
import {createRoot} from 'react-dom/client';
import '@fontsource-variable/instrument-sans';
import '@fontsource-variable/bricolage-grotesque';
import './style.css';
import {App} from './App';
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
