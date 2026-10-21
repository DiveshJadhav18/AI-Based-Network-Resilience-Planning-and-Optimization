import React, { useState } from 'react';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import TopologyEditor from './pages/TopologyEditor';
import ProtocolSimulator from './pages/ProtocolSimulator';
import FailureAnalysis from './pages/FailureAnalysis';
import LinkRiskPrediction from './pages/LinkRiskPrediction';
import { NetworkProvider, useNetwork } from './context/NetworkContext';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

const MainContent = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { statusMessage, setStatusMessage } = useNetwork();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Global Status Banner (if set) */}
      {statusMessage && (
        <div className="bg-blue-50 border-b border-blue-200 text-blue-800 text-xs py-2 px-4 flex items-center justify-between">
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
            <span className="font-medium">{statusMessage}</span>
            <button
              onClick={() => setStatusMessage('')}
              className="text-blue-600 hover:text-blue-900 font-bold ml-4"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'dashboard' && <Dashboard setActiveTab={setActiveTab} />}
        {activeTab === 'editor' && <TopologyEditor />}
        {activeTab === 'protocols' && <ProtocolSimulator />}
        {activeTab === 'failure-analysis' && <FailureAnalysis />}
        {activeTab === 'ml-prediction' && <LinkRiskPrediction />}
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        AI-Based Network Resilience Planning and Optimization &bull; Computer Networks Final Project
      </footer>
    </div>
  );
};

function App() {
  return (
    <NetworkProvider>
      <MainContent />
    </NetworkProvider>
  );
}

export default App;
