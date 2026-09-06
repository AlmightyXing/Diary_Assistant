import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import Widget from './Widget'
import CalendarWidget from './CalendarWidget'
import './index.css'

const hash = window.location.hash;
const isWidget = hash === '#/widget' || hash === '#widget';
const isCalendarWidget = hash === '#/calendar-widget' || hash === '#calendar-widget';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {isCalendarWidget ? <CalendarWidget /> : (isWidget ? <Widget /> : <App />)}
  </React.StrictMode>
)
