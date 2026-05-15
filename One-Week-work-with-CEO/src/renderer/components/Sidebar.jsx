import React from 'react';
import { NavLink } from 'react-router-dom';

import { LayoutDashboard, Github, Settings, Bot, Sparkles } from 'lucide-react';


const navItemClass = ({ isActive }) =>
  `group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 relative ${
    isActive
      ? 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-white shadow-lg shadow-blue-500/10'
      : 'text-neutral-400 hover:text-white hover:bg-white/5 hover:translate-x-1'
  }`;

export default function Sidebar() {
  return (
    <aside className="w-72 h-full border-r border-white/10 bg-gradient-to-b from-neutral-950/80 to-neutral-950/60 backdrop-blur-xl p-6 flex flex-col">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-base font-bold tracking-tight bg-gradient-to-r from-white to-neutral-300 bg-clip-text text-transparent">
              AI Automation
            </div>
          </div>
        </div>
        <div className="text-xs text-neutral-500 ml-10">
          Automate repositories at scale
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1">
        <div className="text-[10px] uppercase tracking-wider text-neutral-600 font-semibold px-3 mb-3 flex items-center gap-2">
          <Sparkles className="w-3 h-3" />
          Main Menu
        </div>
        
        <NavLink to="/github-repo-generator" className={navItemClass}>
          {({ isActive }) => (
            <>
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-blue-500 to-purple-500 rounded-r-full" />
              )}
              <Github className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span className="font-medium">Repo Generator</span>
            </>
          )}
        </NavLink>

        <NavLink to="/dashboard" className={navItemClass}>
          {({ isActive }) => (
            <>
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-blue-500 to-purple-500 rounded-r-full" />
              )}
              <LayoutDashboard className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span className="font-medium">Dashboard</span>
            </>
          )}
        </NavLink>


        {/* <NavLink to="/stars-campaign" className={navItemClass}>
          {({ isActive }) => (
            <>
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-yellow-500 to-orange-500 rounded-r-full" />
              )}
              <Star className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span className="font-medium">Stars Campaign</span>
            </>
          )}
        </NavLink> */}

        {/* <NavLink to="/indexer-checker" className={navItemClass}>
          {({ isActive }) => (
            <>
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-green-500 to-emerald-500 rounded-r-full" />
              )}
              <Search className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span className="font-medium">Indexer Checker</span>
            </>
          )}
        </NavLink> */}


        {/* <NavLink to="/repo-views" className={navItemClass}>
          {({ isActive }) => (
            <>
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-blue-500 to-cyan-500 rounded-r-full" />
              )}
              <Eye className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span className="font-medium">Repo Views</span>
            </>
          )}
        </NavLink> */}




        <div className="my-4 border-t border-white/5" />

        <div className="text-[10px] uppercase tracking-wider text-neutral-600 font-semibold px-3 mb-3">
          System
        </div>

        <NavLink to="/settings" className={navItemClass}>
          {({ isActive }) => (
            <>
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-blue-500 to-purple-500 rounded-r-full" />
              )}
              <Settings className="w-4 h-4 group-hover:scale-110 group-hover:rotate-90 transition-all duration-300" />
              <span className="font-medium">Settings</span>
            </>
          )}
        </NavLink>
      </nav>

      {/* Footer */}
      <div className="mt-auto pt-4 border-t border-white/5">
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5">
          <div className="text-[10px] text-neutral-500">Version</div>
          <div className="text-xs font-mono text-neutral-400">v0.1.0</div>
        </div>
      </div>
    </aside>
  );
}