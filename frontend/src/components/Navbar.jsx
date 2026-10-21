import React from 'react';
import { Network, LayoutDashboard, Share2, AlertTriangle, ShieldCheck, Cpu } from 'lucide-react';

const Navbar = ({ activeTab, setActiveTab }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'editor', label: 'Topology Editor', icon: Share2 },
    { id: 'failure-analysis', label: 'Failure Analysis & Resilience', icon: AlertTriangle },
    { id: 'ml-prediction', label: 'Link Risk Prediction (ML)', icon: Cpu },
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-100 flex items-center justify-center">
              <Network className="w-6 h-6" />
            </div>
            <div>
              <span className="text-lg font-bold text-slate-900 tracking-tight block">
                NetResilience Studio
              </span>
              <span className="text-xs text-slate-500 font-medium">
                AI-Based Network Resilience Planning & Optimization
              </span>
            </div>
          </div>

          <nav className="flex space-x-1 sm:space-x-2 items-center">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
