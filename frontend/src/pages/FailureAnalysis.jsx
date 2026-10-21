import React, { useState } from 'react';
import { 
  AlertTriangle, ShieldAlert, CheckCircle2, RotateCcw, 
  ArrowRight, Plus, Activity, Cpu, ArrowUpRight, Check, X
} from 'lucide-react';
import { useNetwork } from '../context/NetworkContext';
import { simulateFailure, getBackupRecommendation, compareTopologies } from '../services/api';

const FailureAnalysis = () => {
  const { 
    topology, 
    setTopology, 
    updateLink, 
    addLink, 
    refreshAnalysis 
  } = useNetwork();

  // Simulation controls
  const [selectedLinkId, setSelectedLinkId] = useState('');
  const [simSourceId, setSimSourceId] = useState('');
  const [simTargetId, setSimTargetId] = useState('');
  const [simResult, setSimResult] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Recommendations and comparison
  const [recommendation, setRecommendation] = useState(null);
  const [recLoading, setRecLoading] = useState(false);
  const [comparison, setComparison] = useState(null);
  const [appliedLink, setAppliedLink] = useState(null);

  const handleSimulate = async () => {
    if (!selectedLinkId) return;
    setIsSimulating(true);
    setRecommendation(null);
    setComparison(null);
    setAppliedLink(null);

    try {
      // Temporarily mark the link as failed in the active topology
      const targetLink = topology.links.find(l => l.id === selectedLinkId);
      if (targetLink) {
        updateLink({ ...targetLink, status: 'failed' });
      }

      const res = await simulateFailure(
        topology,
        selectedLinkId,
        simSourceId || null,
        simTargetId || null
      );
      setSimResult(res);

      // Fetch backup recommendation for this scenario
      fetchRecommendation(selectedLinkId);
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  const fetchRecommendation = async (failedLinkId) => {
    setRecLoading(true);
    try {
      const res = await getBackupRecommendation(topology, failedLinkId);
      setRecommendation(res);
    } catch (err) {
      console.error('Recommendation error:', err);
    } finally {
      setRecLoading(false);
    }
  };

  const handleApplyRecommendation = async () => {
    if (!recommendation?.recommended_link) return;
    const rec = recommendation.recommended_link;

    // Snapshot before
    const beforeTop = JSON.parse(JSON.stringify(topology));

    // Construct new backup link
    const newBackupLink = {
      id: `backup-${rec.source_id}-${rec.target_id}-${Date.now().toString().slice(-4)}`,
      source: rec.source_id,
      target: rec.target_id,
      cost: rec.cost,
      latency: rec.latency,
      bandwidth: rec.bandwidth,
      status: 'active',
      utilization: 30.0,
      packet_loss: 0.1,
      failure_history: 0,
      age_months: 1,
    };

    // Apply to topology
    addLink(newBackupLink);
    setAppliedLink(newBackupLink);

    // Build after topology for exact calculation
    const afterTop = {
      ...topology,
      links: [...topology.links, newBackupLink],
    };

    try {
      const compRes = await compareTopologies(beforeTop, afterTop);
      setComparison(compRes);
      refreshAnalysis();
    } catch (err) {
      console.error('Comparison calculation failed:', err);
    }
  };

  const handleResetSimulation = () => {
    // Restore all links to active status
    setTopology(prev => ({
      ...prev,
      links: prev.links.map(l => ({ ...l, status: 'active' })),
    }));
    setSelectedLinkId('');
    setSimSourceId('');
    setSimTargetId('');
    setSimResult(null);
    setRecommendation(null);
    setComparison(null);
    setAppliedLink(null);
    refreshAnalysis();
  };

  const devMap = (topology.devices || []).reduce((acc, d) => {
    acc[d.id] = d.name;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Failure Simulation & Resilience Optimization
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Simulate link outages on the active network, detect affected partitions,
            determine if alternate routes exist, and automatically generate optimal backup recommendations.
          </p>
        </div>

        <button
          onClick={handleResetSimulation}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors shadow-xs"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset Simulation & Restore Links
        </button>
      </div>

      {/* Control Row: Link Selection & Endpoint Verification */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-3">
          Configure Failure Test
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Select Link to Fail *
            </label>
            <select
              value={selectedLinkId}
              onChange={(e) => setSelectedLinkId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Choose a connection...</option>
              {topology.links.map((link) => (
                <option key={link.id} value={link.id}>
                  {devMap[link.source] || link.source} ↔ {devMap[link.target] || link.target} ({link.cost}w, {link.latency}ms) {link.status === 'failed' ? '[DOWN]' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Test Source Device (Optional)
            </label>
            <select
              value={simSourceId}
              onChange={(e) => setSimSourceId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Link Endpoint Default</option>
              {topology.devices.map((d) => (
                <option key={d.id} value={d.id}>{d.name} ({d.type})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Test Destination Device (Optional)
            </label>
            <select
              value={simTargetId}
              onChange={(e) => setSimTargetId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Link Endpoint Default</option>
              {topology.devices.map((d) => (
                <option key={d.id} value={d.id}>{d.name} ({d.type})</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={handleSimulate}
            disabled={!selectedLinkId || isSimulating}
            className="px-5 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-xs transition-colors disabled:opacity-50 inline-flex items-center gap-2"
          >
            <Activity className="w-3.5 h-3.5" />
            {isSimulating ? 'Simulating Failure...' : 'Simulate Failure'}
          </button>
        </div>
      </div>

      {/* Simulation Results & Alternate Path */}
      {simResult && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Outage Impact Overview */}
          <div className={`p-5 rounded-xl border shadow-xs ${simResult.is_critical ? 'bg-red-50/50 border-red-200' : 'bg-emerald-50/50 border-emerald-200'}`}>
            <div className="flex items-center gap-2 mb-3">
              {simResult.is_critical ? (
                <ShieldAlert className="w-5 h-5 text-red-600" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              )}
              <h3 className={`text-sm font-bold ${simResult.is_critical ? 'text-red-900' : 'text-emerald-900'}`}>
                {simResult.is_critical ? 'Critical Link Failure Detected' : 'Redundant Link Failure - Network Intact'}
              </h3>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed mb-4">
              {simResult.summary_message}
            </p>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-600">Failed Link:</span>
                <span className="font-semibold text-slate-900">
                  {devMap[simResult.failed_link_source]} ↔ {devMap[simResult.failed_link_target]}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-600">Network Connected:</span>
                <span className={`font-semibold ${simResult.is_fully_connected ? 'text-emerald-700' : 'text-red-700'}`}>
                  {simResult.is_fully_connected ? 'Yes (1 Component)' : `No (${simResult.connected_components_count} Partitions)`}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-600">Isolated Devices:</span>
                <span className="font-semibold text-slate-900">
                  {simResult.affected_device_names.length > 0 ? simResult.affected_device_names.join(', ') : 'None'}
                </span>
              </div>
              {simResult.server_reachability_loss.length > 0 && (
                <div className="p-2.5 bg-red-100/70 border border-red-300 rounded text-red-800 font-medium">
                  Workstation lost route to core server: {simResult.server_reachability_loss.join(', ')}
                </div>
              )}
            </div>
          </div>

          {/* Alternate Route Analysis */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                <ArrowRight className="w-4 h-4 text-blue-600" />
                Alternate Route Status
              </h3>
              
              {simResult.alternate_path_exists && simResult.alternate_path ? (
                <div className="space-y-3 text-xs mt-3">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900">
                    <div className="font-semibold mb-1">Rerouting Successful</div>
                    <div className="font-mono text-xs text-blue-800">
                      {simResult.alternate_path.path_node_names.join(' → ')}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-slate-600">
                    <div className="p-2 bg-slate-50 rounded border border-slate-200">
                      <span className="block text-[10px] uppercase font-bold text-slate-400">Total Cost</span>
                      <span className="text-sm font-bold text-slate-900">{simResult.alternate_path.total_cost}</span>
                    </div>
                    <div className="p-2 bg-slate-50 rounded border border-slate-200">
                      <span className="block text-[10px] uppercase font-bold text-slate-400">Total Latency</span>
                      <span className="text-sm font-bold text-slate-900">{simResult.alternate_path.total_latency} ms</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 mt-3">
                  <div className="font-bold mb-1">No Alternate Path Found</div>
                  <p>
                    Because this link was a bridge with no parallel redundancy, all traffic between these segments has ceased.
                    Apply the recommended preventive backup link below to restore failover routing.
                  </p>
                </div>
              )}
            </div>

            <div className="text-[11px] text-slate-400 mt-4 border-t border-slate-100 pt-2">
              Calculated using graph-based path traversal without failed edges.
            </div>
          </div>
        </div>
      )}

      {/* Preventive Backup Link Recommendation */}
      {recommendation && recommendation.recommendation_available && (
        <div className="bg-white p-5 rounded-xl border border-indigo-200 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
            <div>
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider block">
                Algorithmic Resilience Recommendation
              </span>
              <h3 className="text-base font-bold text-slate-900">
                Recommended Backup Connection
              </h3>
            </div>
            
            {!appliedLink && (
              <button
                onClick={handleApplyRecommendation}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg shadow-xs inline-flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Apply Recommendation to Topology
              </button>
            )}
            {appliedLink && (
              <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-lg flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                Recommendation Applied
              </div>
            )}
          </div>

          <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-lg text-xs space-y-2">
            <div className="font-semibold text-indigo-900">
              Proposed Link: {recommendation.recommended_link.source_name} ↔ {recommendation.recommended_link.target_name}
            </div>
            <p className="text-slate-700 leading-relaxed">
              {recommendation.recommended_link.rationale}
            </p>
            <div className="text-slate-500 text-[11px]">
              Improvement Priority Score: <strong>{recommendation.recommended_link.improvement_score}</strong> (evaluated across {recommendation.all_candidates_tested} candidate pairs)
            </div>
          </div>
        </div>
      )}

      {/* Before & After Quantitative Comparison Table */}
      {comparison && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-1.5">
            <ArrowUpRight className="w-4 h-4 text-emerald-600" />
            Before vs After Quantitative Connectivity Comparison
          </h3>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase">
                <tr>
                  <th className="py-2.5 px-4 text-left">Network Metric</th>
                  <th className="py-2.5 px-4 text-center">Before Backup Link</th>
                  <th className="py-2.5 px-4 text-center">After Backup Link</th>
                  <th className="py-2.5 px-4 text-center">Impact Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-2.5 px-4 font-semibold text-slate-800">Reachable Devices in Main Partition</td>
                  <td className="py-2.5 px-4 text-center text-slate-600">{comparison.before.reachable_devices}</td>
                  <td className="py-2.5 px-4 text-center font-bold text-emerald-600">{comparison.after.reachable_devices}</td>
                  <td className="py-2.5 px-4 text-center text-xs text-slate-600">
                    {comparison.after.reachable_devices >= comparison.before.reachable_devices ? 'Maintained / Restored' : 'Unchanged'}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-semibold text-slate-800">Critical Bridge Links Count</td>
                  <td className="py-2.5 px-4 text-center text-slate-600">{comparison.before.critical_links_count}</td>
                  <td className="py-2.5 px-4 text-center font-bold text-emerald-600">{comparison.after.critical_links_count}</td>
                  <td className="py-2.5 px-4 text-center text-xs text-slate-600">
                    {comparison.after.critical_links_count < comparison.before.critical_links_count ? 'Reduced Bridge Count (Higher Redundancy)' : 'Stabilized'}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-semibold text-slate-800">Network Disconnected Partitions</td>
                  <td className="py-2.5 px-4 text-center text-slate-600">{comparison.before.connected_components}</td>
                  <td className="py-2.5 px-4 text-center font-bold text-emerald-600">{comparison.after.connected_components}</td>
                  <td className="py-2.5 px-4 text-center text-xs text-slate-600">
                    {comparison.after.connected_components < comparison.before.connected_components ? 'Isolated Segments Re-connected' : 'Optimal'}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-semibold text-slate-800">Core Server Reachability</td>
                  <td className="py-2.5 px-4 text-center text-slate-600">
                    {comparison.before.server_reachable ? 'Reachable' : 'Severed'}
                  </td>
                  <td className="py-2.5 px-4 text-center font-bold text-emerald-600">
                    {comparison.after.server_reachable ? 'Reachable' : 'Severed'}
                  </td>
                  <td className="py-2.5 px-4 text-center text-xs text-slate-600">
                    {comparison.after.server_reachable ? 'Operational' : 'Restricted'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-3 p-3 bg-slate-50 rounded-lg text-xs text-slate-600">
            <span className="font-semibold text-slate-800">Summary Findings: </span>
            {comparison.improvement_notes.join(' ')}
          </div>
        </div>
      )}
    </div>
  );
};

export default FailureAnalysis;
