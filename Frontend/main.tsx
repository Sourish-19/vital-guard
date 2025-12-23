import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
// import './index.css' // (Or whatever your CSS file is named, maybe './App.css')

// We use createRoot because this is a standard Vite app, not a Server-Side app
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)