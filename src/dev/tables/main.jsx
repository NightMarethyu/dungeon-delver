import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../index.css'
import './tables.css'
import TablesEditor from './TablesEditor.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <TablesEditor />
  </StrictMode>,
)
