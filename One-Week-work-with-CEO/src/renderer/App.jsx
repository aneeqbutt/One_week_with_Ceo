import React from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import Sidebar from './components/Sidebar.jsx';

export default function App() {
  return (
    <div className="h-screen w-screen overflow-hidden flex bg-neutral-950 text-neutral-100">
      <Sidebar />
      <main className="flex-1 h-full overflow-hidden">
        <div className="h-full w-full overflow-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
