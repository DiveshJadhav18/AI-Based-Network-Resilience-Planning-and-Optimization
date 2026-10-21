import React from 'react';
import { 
  Server, Share2, AlertCircle, CheckCircle2, ShieldAlert, 
  ArrowRight, PlusCircle, RefreshCw, Layers, ShieldCheck
} from 'lucide-react';
import { useNetwork } from '../context/NetworkContext';

const Dashboard = ({ setActiveTab }) => {
  const { 
    topology, 
    criticalAnalysis, 
    validationIssues, 
    loadSample, 
    createNewNetwork, 
    loading 
  } = useNetwork();

  const deviceCount = topology.devices?.length || 0;
  const linkCount = topology.links?.length || 0;
  const criticalCount = criticalAnalysis?.critical_link_count || 0;
  const isFullyConnected = criticalAnalysis?.is_fully_connected ?? true;
  const componentCount = criticalAnalysis?.connected_components_count || (deviceCount > 0 ? 1 : 0);

  // Group devices by type
  const deviceTypeCounts = (topology.devices || []).reduce((acc, dev) => {
    acc[dev.type] = (acc[dev.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Hero / Introduction */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100 mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            Computer Networks Final Project
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            AI-Based Network Resilience Planning and Optimization
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Model topology graphs, detect single points of failure (bridges), simulate link outages,
            compute shortest Dijkstra paths, and recommend proactive backup links alongside ML-based risk scores.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={createNewNetwork}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors shadow-xs"
          >
            <PlusCircle className="w-4 h-4 text-slate-500" />
            Create New Network
          </button>
          <button
            onClick={loadSample}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            Load Sample Network
          </button>
          <button
            onClick={() => setActiveTab('editor')}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-xs"
          >
            Open Network Editor
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Devices */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Devices</span>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Server className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">{deviceCount}</span>
            <span className="text-xs text-slate-500">nodes in graph</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {deviceTypeCounts['router'] || 0} Routers, {deviceTypeCounts['switch'] || 0} Switches, {deviceTypeCounts['pc'] || 0} PCs, {deviceTypeCounts['server'] || 0} Servers
          </div>
        </div>

        {/* Network Links */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Links</span>
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Share2 className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">{linkCount}</span>
            <span className="text-xs text-slate-500">connections</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {topology.links?.filter(l => l.status === 'failed').length || 0} links currently failed
          </div>
        </div>

        {/* Critical Connections */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Critical Bridges</span>
            <span className={`p-2 rounded-lg ${criticalCount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
              <AlertCircle className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={`text-3xl font-bold ${criticalCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
              {criticalCount}
            </span>
            <span className="text-xs text-slate-500">single-point failures</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {criticalCount > 0 ? 'Failure partitions the network' : 'All links have redundant paths'}
          </div>
        </div>

        {/* Connectivity Status */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Graph Connectivity</span>
            <span className={`p-2 rounded-lg ${isFullyConnected && deviceCount > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
              {isFullyConnected && deviceCount > 0 ? <CheckCircle2 className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${isFullyConnected && deviceCount > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
              {deviceCount === 0 ? 'Empty' : isFullyConnected ? 'Fully Connected' : 'Partitioned'}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {componentCount} independent network segment(s)
          </div>
        </div>
      </div>

      {/* Main Content: Network Preview & Identified Weaknesses */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Compact Network Preview (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Current Topology Overview</h2>
              <p className="text-xs text-slate-500">Active layout: {topology.name}</p>
            </div>
            <button
              onClick={() => setActiveTab('editor')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              Configure in Editor <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Simple Structured Topology Table Preview */}
          {deviceCount === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <Layers className="w-8 h-8 mx-auto text-slate-400 mb-2" />
              <p className="text-sm">No devices in current network.</p>
              <button
                onClick={loadSample}
                className="mt-3 text-xs font-semibold text-blue-600 hover:underline"
              >
                Load Sample Enterprise Network
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Device Name</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">IP Address</th>
                    <th className="py-2.5 px-3">Connected Links</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {topology.devices.slice(0, 8).map((dev) => {
                    const devLinks = topology.links.filter(
                      l => l.source === dev.id || l.target === dev.id
                    );
                    return (
                      <tr key={dev.id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-3 font-semibold text-slate-800">{dev.name}</td>
                        <td className="py-2.5 px-3 capitalize">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium text-[11px]">
                            {dev.type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{dev.ip || '—'}</td>
                        <td className="py-2.5 px-3 text-slate-600">{devLinks.length} connection(s)</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {topology.devices.length > 8 && (
                <div className="text-center py-2 text-xs text-slate-500 border-t border-slate-100">
                  + {topology.devices.length - 8} more device(s)
                </div>
              )}
            </div>
          )}
        </div>

        {/* Identified Weaknesses & Configuration Warnings (1 col) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col">
          <h2 className="text-base font-bold text-slate-900 mb-1">Identified Weaknesses</h2>
          <p className="text-xs text-slate-500 mb-4">Real-time graph analysis findings</p>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[360px] pr-1">
            {/* Critical Bridges */}
            {criticalAnalysis?.critical_links && criticalAnalysis.critical_links.length > 0 ? (
              criticalAnalysis.critical_links.map((link) => (
                <div key={link.link_id} className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-amber-800">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Single Point of Failure</span>
                  </div>
                  <p className="text-slate-700 mt-1 leading-relaxed">
                    Link between <strong>{link.source_name}</strong> and <strong>{link.target_name}</strong> is a critical bridge.
                  </p>
                  <p className="text-slate-500 mt-1">
                    Affects {link.affected_device_count} device(s) if severed.
                  </p>
                </div>
              ))
            ) : null}

            {/* Topology validation warnings */}
            {validationIssues && validationIssues.length > 0 ? (
              validationIssues.map((issue, idx) => (
                <div 
                  key={idx} 
                  className={`p-3 rounded-lg border text-xs ${
                    issue.type === 'error' 
                      ? 'bg-red-50/70 border-red-200 text-red-800' 
                      : 'bg-amber-50/70 border-amber-200 text-amber-800'
                  }`}
                >
                  <div className="font-semibold">{issue.code}</div>
                  <p className="text-slate-700 mt-0.5">{issue.message}</p>
                </div>
              ))
            ) : null}

            {criticalCount === 0 && (!validationIssues || validationIssues.length === 0) && (
              <div className="p-6 text-center text-slate-500 border border-dashed border-slate-200 rounded-lg my-auto">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">No Critical Weaknesses</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Network has redundant pathways and no configuration conflicts detected.
                </p>
              </div>
            )}
          </div>

          <div className="pt-4 mt-auto border-t border-slate-100 flex justify-between items-center">
            <span className="text-xs text-slate-500">Run failure tests</span>
            <button
              onClick={() => setActiveTab('failure-analysis')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              Simulate Outage <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
