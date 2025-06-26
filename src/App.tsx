import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import InstanceLogs from './components/InstanceLogs';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/instance/:instanceId" element={<InstanceLogs />} />
      </Routes>
    </Router>
  );
}

export default App;