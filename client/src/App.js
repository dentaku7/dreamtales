import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Chat from './Chat';

function App() {



  return (
    <Routes>
      <Route path="/" element={<Navigate to="/chat" replace />} />
      <Route path="/chat" element={<Chat mode="child" />} />
      <Route path="/parents" element={<Chat mode="parent" />} />
      <Route path="*" element={<Navigate to="/chat" replace />} />
    </Routes>
  );
}

export default App;
