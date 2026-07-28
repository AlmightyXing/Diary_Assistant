import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import Widget from './Widget'
import './index.css'

const isWidget = window.location.hash === '#/widget';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {isWidget ? <Widget /> : <App />}
  </React.StrictMode>
)
