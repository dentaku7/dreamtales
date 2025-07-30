import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ChatWrapper from './ChatWrapper';

function App() {



  return (
    <Routes>
      <Route path="/" element={<Navigate to="/chat" replace />} />
      <Route path="/chat" element={<ChatWrapper />} />
      <Route path="/chat/:chatId" element={<ChatWrapper />} />
      <Route path="*" element={<Navigate to="/chat" replace />} />
    </Routes>
  );
}

export default App;
