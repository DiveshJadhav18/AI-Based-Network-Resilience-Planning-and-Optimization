import React, { useState, useEffect } from 'react';
import { 
  Cpu, AlertTriangle, ShieldCheck, BarChart2, Info, RefreshCw, Activity, Layers
} from 'lucide-react';
import { useNetwork } from '../context/NetworkContext';
import { predictLinkRisks, getMLMetrics } from '../services/api';

const LinkRiskPrediction = () => {
  const { topology, loadSample } = useNetwork();

  const [predictions, setPredictions] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [selectedPrediction, setSelectedPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMetrics();
  }, []);

  useEffect(() => {
    if (topology.links && topology.links.length > 0) {
      fetchPredictions();
    } else {
      setPredictions([]);
      setSelectedPrediction(null);
    }
  }, [topology]);

  const fetchMetrics = async () => {
    try {
      const data = await getMLMetrics();
      setMetrics(data);
    } catch (err) {
      console.error('Failed to fetch ML metrics:', err);
    }
  };

  const fetchPredictions = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await predictLinkRisks(topology);
      setPredictions(data);
      if (data.length > 0) {
        setSelectedPrediction(data[0]);
      }
    } catch (err) {
      console.error('Failed to run ML prediction:', err);
      setError('Could not fetch ML predictions. Ensure the backend server is active.');
    } finally {
      setLoading(false);
    }
  };

  const getRiskBadge = (level) => {
    switch (level) {
      case 'High':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">High Risk</span>;
      case 'Medium':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">Medium Risk</span>;
      case 'Low':
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">Low Risk</span>;
    }
  };

  if (!topology.devices || topology.devices.length === 0) {
    return (
      <div className="bg-white rounded-xl p-12 border border-slate-200 shadow-xs text-center max-w-lg mx-auto">
        <Layers className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-800">No Network Loaded</h2>
        <p className="text-xs text-slate-500 mt-1 mb-5">
          Please create a network topology or load the predefined sample network to estimate link failure risk.
        </p>
        <button
          onClick={loadSample}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-xs"
        >
          Load Predefined Sample Network
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Cpu className="w-5 h-5 text-indigo-600" />
            Machine Learning Link Failure Risk Prediction
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Supervised Random Forest classifier evaluating telemetry factors (utilization, latency, packet loss, historical failures, hardware age).
          </p>
        </div>

        <button
          onClick={fetchPredictions}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          Re-evaluate Model
        </button>
      </div>

      {/* Model Performance Cards */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Accuracy</span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block">{(metrics.accuracy * 100).toFixed(1)}%</span>
            <span className="text-[10px] text-slate-400">Test set validation</span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Precision</span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block">{(metrics.precision * 100).toFixed(1)}%</span>
            <span className="text-[10px] text-slate-400">Failure positive precision</span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Recall</span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block">{(metrics.recall * 100).toFixed(1)}%</span>
            <span className="text-[10px] text-slate-400">Failure detection recall</span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">F1-Score</span>
            <span className="text-2xl font-bold text-indigo-600 mt-1 block">{(metrics.f1_score * 100).toFixed(1)}%</span>
            <span className="text-[10px] text-slate-400">Harmonic mean balance</span>
          </div>
        </div>
      )}

      {/* Educational Model Disclaimer */}
      <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Academic Demonstration Context: </span>
          Estimates are generated by a Random Forest Classifier trained on reproducible synthetic network telemetry metrics.
          This demonstrates how network intelligence and health scores can complement classical graph resilience algorithms.
        </div>
      </div>

      {/* Predictions Table & Detail View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table View (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-3">Network Links Risk Assessment</h2>

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500">Calculating risk probabilities...</div>
          ) : predictions.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">No links in current topology.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Connection Link</th>
                    <th className="py-2.5 px-3">Utilization</th>
                    <th className="py-2.5 px-3">Packet Loss</th>
                    <th className="py-2.5 px-3">Risk Level</th>
                    <th className="py-2.5 px-3">Probability</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {predictions.map((p) => {
                    const isSelected = selectedPrediction?.link_id === p.link_id;
                    return (
                      <tr 
                        key={p.link_id} 
                        className={`hover:bg-slate-50/80 cursor-pointer ${isSelected ? 'bg-blue-50/60' : ''}`}
                        onClick={() => setSelectedPrediction(p)}
                      >
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {p.source_name} ↔ {p.target_name}
                        </td>
                        <td className="py-2.5 px-3 font-mono">{p.utilization}%</td>
                        <td className="py-2.5 px-3 font-mono">{p.packet_loss}%</td>
                        <td className="py-2.5 px-3">{getRiskBadge(p.risk_level)}</td>
                        <td className="py-2.5 px-3 font-semibold font-mono text-slate-800">
                          {(p.failure_probability * 100).toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => setSelectedPrediction(p)}
                            className="text-blue-600 hover:text-blue-700 font-semibold text-[11px]"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Selected Link Inspector (1 Col) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-3">Link Telemetry Breakdown</h2>

          {selectedPrediction ? (
            <div className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-[11px] text-slate-500 uppercase font-semibold">Target Connection</div>
                <div className="text-sm font-bold text-slate-900 mt-0.5">
                  {selectedPrediction.source_name} ↔ {selectedPrediction.target_name}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span>Risk Classification:</span>
                  {getRiskBadge(selectedPrediction.risk_level)}
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600">Calculated Failure Risk:</span>
                  <span className="font-bold text-slate-900">
                    {(selectedPrediction.failure_probability * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full ${
                      selectedPrediction.risk_level === 'High'
                        ? 'bg-red-500'
                        : selectedPrediction.risk_level === 'Medium'
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, selectedPrediction.failure_probability * 100)}%` }}
                  ></div>
                </div>
              </div>

              {/* Telemetry features list */}
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
                  <span>Bandwidth Utilization:</span>
                  <span className="font-mono font-semibold text-slate-900">{selectedPrediction.utilization}%</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
                  <span>Latency:</span>
                  <span className="font-mono font-semibold text-slate-900">{selectedPrediction.latency} ms</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
                  <span>Packet Drop Loss:</span>
                  <span className="font-mono font-semibold text-slate-900">{selectedPrediction.packet_loss}%</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
                  <span>Past Failure Count:</span>
                  <span className="font-mono font-semibold text-slate-900">{selectedPrediction.failure_history} times</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
                  <span>Hardware Cable Age:</span>
                  <span className="font-mono font-semibold text-slate-900">{selectedPrediction.age_months} months</span>
                </div>
              </div>

              {/* Explanation note */}
              <div className="p-3 bg-slate-50 rounded-lg text-slate-700 leading-relaxed border border-slate-200">
                <span className="font-bold text-slate-900 block mb-0.5">Model Rationale:</span>
                {selectedPrediction.explanation}
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-slate-400">
              Select a link from the table to inspect details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LinkRiskPrediction;
