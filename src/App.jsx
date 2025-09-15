import { useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div className="header">
        <h1>Parkicle Web Control</h1>
        <p>A React-based control interface for managing Parkicle systems</p>
      </div>
      
      <div className="main-content">
        <div className="control-panel">
          <h2>Control Panel</h2>
          <div className="counter-section">
            <p>Click count: {count}</p>
            <button onClick={() => setCount((count) => count + 1)}>
              Click me
            </button>
            <button onClick={() => setCount(0)} className="reset-btn">
              Reset
            </button>
          </div>
        </div>
        
        <div className="status-panel">
          <h2>System Status</h2>
          <div className="status-item">
            <span className="status-label">Connection:</span>
            <span className="status-value connected">Connected</span>
          </div>
          <div className="status-item">
            <span className="status-label">Mode:</span>
            <span className="status-value">Active</span>
          </div>
          <div className="status-item">
            <span className="status-label">Last Update:</span>
            <span className="status-value">{new Date().toLocaleTimeString()}</span>
          </div>
        </div>
      </div>
      
      <footer className="footer">
        <p>&copy; 2023 Parkicle Web Control - Built with React</p>
      </footer>
    </>
  )
}

export default App