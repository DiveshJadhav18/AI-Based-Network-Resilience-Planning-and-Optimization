import React, { useState } from 'react';
import { 
  Calculator, Activity, Navigation, GitBranch, Play, 
  HelpCircle, RefreshCw, Send, CheckCircle2, AlertCircle, ArrowRight
} from 'lucide-react';
import { useNetwork } from '../context/NetworkContext';
import { 
  calculateSubnet, getRoutingTables, runPing, 
  runTraceroute, getSTPStatus, runPacketSimulation 
} from '../services/api';
import LearnConceptModal from '../components/LearnConceptModal';

const ProtocolSimulator = () => {
  const { topology } = useNetwork();
  const [activeSubTab, setActiveSubTab] = useState('ping');
  const [learningTopic, setLearningTopic] = useState(null);

  // 1. Subnet Calculator States
  const [calcIp, setCalcIp] = useState('192.168.10.15');
  const [calcCidr, setCalcCidr] = useState(24);
  const [devAIp, setDevAIp] = useState('192.168.10.20');
  const [devBIp, setDevBIp] = useState('192.168.10.55');
  const [calcGateway, setCalcGateway] = useState('192.168.10.1');
  const [subnetResult, setSubnetResult] = useState(null);
  const [calcLoading, setCalcLoading] = useState(false);

  // 2. Routing Tables States
  const [routingTables, setRoutingTables] = useState([]);
  const [rtLoading, setRtLoading] = useState(false);

  // 3. Ping States
  const [pingSource, setPingSource] = useState(topology.devices[0]?.id || '');
  const [pingTarget, setPingTarget] = useState(topology.devices[topology.devices.length - 1]?.id || '');
  const [pingResult, setPingResult] = useState(null);
  const [pingLoading, setPingLoading] = useState(false);

  // 4. Traceroute States
  const [traceSource, setTraceSource] = useState(topology.devices[0]?.id || '');
  const [traceTarget, setTraceTarget] = useState(topology.devices[topology.devices.length - 1]?.id || '');
  const [traceResult, setTraceResult] = useState(null);
  const [traceLoading, setTraceLoading] = useState(false);

  // 5. STP States
  const [stpResult, setStpResult] = useState(null);
  const [stpLoading, setStpLoading] = useState(false);

  // 6. Packet Walkthrough States
  const [pktSource, setPktSource] = useState(topology.devices[0]?.id || '');
  const [pktTarget, setPktTarget] = useState(topology.devices[topology.devices.length - 1]?.id || '');
  const [pktProtocol, setPktProtocol] = useState('ICMP');
  const [pktResult, setPktResult] = useState(null);
  const [pktLoading, setPktLoading] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Handlers
  const handleCalculateSubnet = async (e) => {
    e.preventDefault();
    setCalcLoading(true);
    try {
      const res = await calculateSubnet({
        ip: calcIp,
        cidr: parseInt(calcCidr, 10),
        device_a_ip: devAIp || null,
        device_b_ip: devBIp || null,
        gateway_ip: calcGateway || null
      });
      setSubnetResult(res);
    } catch (err) {
      console.error(err);
      alert('Subnet calculation error. Verify IPv4 address format.');
    } finally {
      setCalcLoading(false);
    }
  };

  const handleFetchRoutingTables = async () => {
    setRtLoading(true);
    try {
      const res = await getRoutingTables(topology);
      setRoutingTables(res);
    } catch (err) {
      console.error(err);
    } finally {
      setRtLoading(false);
    }
  };

  const handleRunPing = async () => {
    if (!pingSource || !pingTarget) return;
    setPingLoading(true);
    setPingResult(null);
    try {
      const res = await runPing({
        topology,
        source_id: pingSource,
        target_id: pingTarget,
        packet_count: 4
      });
      setPingResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setPingLoading(false);
    }
  };

  const handleRunTraceroute = async () => {
    if (!traceSource || !traceTarget) return;
    setTraceLoading(true);
    setTraceResult(null);
    try {
      const res = await runTraceroute({
        topology,
        source_id: traceSource,
        target_id: traceTarget
      });
      setTraceResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setTraceLoading(false);
    }
  };

  const handleRunSTP = async () => {
    setStpLoading(true);
    try {
      const res = await getSTPStatus(topology);
      setStpResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setStpLoading(false);
    }
  };

  const handleRunPacketSim = async () => {
    if (!pktSource || !pktTarget) return;
    setPktLoading(true);
    setPktResult(null);
    setCurrentStepIndex(0);
    try {
      const res = await runPacketSimulation({
        topology,
        source_id: pktSource,
        target_id: pktTarget,
        protocol: pktProtocol,
        dest_port: 80
      });
      setPktResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setPktLoading(false);
    }
  };

  const devMap = (topology.devices || []).reduce((acc, d) => {
    acc[d.id] = d;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 mb-1.5">
            <Activity className="w-3.5 h-3.5" />
            Interactive Protocol Laboratory
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Network Protocols & Packet Simulation
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Real-time execution of Subnetting, Routing Tables, ICMP Ping, Traceroute, STP Loop Prevention, and L2/L3 Packet Framing.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          {[
            { id: 'ping', label: 'Ping & ICMP', icon: Activity, learnKey: 'ping' },
            { id: 'traceroute', label: 'Traceroute', icon: Navigation, learnKey: 'traceroute' },
            { id: 'packets', label: 'Packet Flow (L2/L3)', icon: Play, learnKey: 'packetFlow' },
            { id: 'subnetting', label: 'Subnet & CIDR', icon: Calculator, learnKey: 'subnetting' },
            { id: 'routing', label: 'Routing Tables', icon: GitBranch, learnKey: 'routing' },
            { id: 'stp', label: 'Spanning Tree (STP)', icon: GitBranch, learnKey: 'stp' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                activeSubTab === tab.id 
                  ? 'bg-white text-blue-700 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ==================== SUB-TAB 1: PING ==================== */}
      {activeSubTab === 'ping' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs lg:col-span-1 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Configure ICMP Ping</h2>
              <button 
                onClick={() => setLearningTopic('ping')}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-semibold"
              >
                <HelpCircle className="w-3.5 h-3.5" /> Learn ICMP
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Source Device</label>
                <select
                  value={pingSource}
                  onChange={(e) => setPingSource(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  {topology.devices.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.ip || 'No IP'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Destination Device</label>
                <select
                  value={pingTarget}
                  onChange={(e) => setPingTarget(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  {topology.devices.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.ip || 'No IP'})</option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleRunPing}
                disabled={pingLoading || !pingSource || !pingTarget}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                {pingLoading ? 'Transmitting Probes...' : 'Transmit 4 ICMP Probes'}
              </button>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs lg:col-span-2">
            <h2 className="text-sm font-bold text-slate-900 mb-3">Ping Console Output</h2>
            {pingResult ? (
              <div className="space-y-3 text-xs">
                {/* Console Black Box */}
                <div className="bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-[11px] space-y-1.5 shadow-inner">
                  <div className="text-slate-400">
                    Pinging {pingResult.target_name} [{pingResult.target_ip}] from {pingResult.source_name} with 32 bytes of data:
                  </div>
                  {pingResult.probes.map(p => (
                    <div key={p.seq} className={p.success ? 'text-emerald-400' : 'text-rose-400'}>
                      {p.message}
                    </div>
                  ))}
                  <div className="pt-2 text-slate-400 border-t border-slate-800">
                    Ping statistics for {pingResult.target_ip}:
                    <br />
                    &nbsp;&nbsp;&nbsp;&nbsp;Packets: Sent = {pingResult.packets_sent}, Received = {pingResult.packets_received}, Lost = {pingResult.packets_sent - pingResult.packets_received} ({pingResult.packet_loss_percent}% loss)
                    {pingResult.reachable && (
                      <div>
                        Approximate round trip times in milli-seconds:
                        <br />
                        &nbsp;&nbsp;&nbsp;&nbsp;Minimum = {pingResult.min_rtt_ms}ms, Maximum = {pingResult.max_rtt_ms}ms, Average = {pingResult.avg_rtt_ms}ms
                      </div>
                    )}
                  </div>
                </div>

                {pingResult.path_taken.length > 0 && (
                  <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-blue-900 font-mono text-[11px]">
                    <span className="font-bold text-blue-950 font-sans">Physical Path Traversed: </span>
                    {pingResult.path_taken.join(' → ')}
                  </div>
                )}

                {pingResult.failure_reason && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800">
                    <span className="font-bold">Failure Analysis: </span> {pingResult.failure_reason}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-16 text-center text-xs text-slate-400">
                Select devices and click Transmit to execute live ICMP ping probes.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== SUB-TAB 2: TRACEROUTE ==================== */}
      {activeSubTab === 'traceroute' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs lg:col-span-1 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Configure Traceroute</h2>
              <button 
                onClick={() => setLearningTopic('traceroute')}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-semibold"
              >
                <HelpCircle className="w-3.5 h-3.5" /> Learn TTL
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Source Device</label>
                <select
                  value={traceSource}
                  onChange={(e) => setTraceSource(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  {topology.devices.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.ip || 'No IP'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Destination Device</label>
                <select
                  value={traceTarget}
                  onChange={(e) => setTraceTarget(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  {topology.devices.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.ip || 'No IP'})</option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleRunTraceroute}
                disabled={traceLoading || !traceSource || !traceTarget}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Navigation className="w-3.5 h-3.5" />
                {traceLoading ? 'Tracing Path...' : 'Trace Hop Route'}
              </button>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs lg:col-span-2">
            <h2 className="text-sm font-bold text-slate-900 mb-3">Hop-by-Hop Trace Output</h2>
            {traceResult ? (
              <div className="space-y-3 text-xs">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 font-semibold uppercase">
                      <tr>
                        <th className="py-2.5 px-3">TTL Hop</th>
                        <th className="py-2.5 px-3">Device Name</th>
                        <th className="py-2.5 px-3">IPv4 Address</th>
                        <th className="py-2.5 px-3">Round-Trip Time</th>
                        <th className="py-2.5 px-3">ICMP Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {traceResult.hops.map(h => (
                        <tr key={h.hop_number} className="hover:bg-slate-50/80">
                          <td className="py-2.5 px-3 font-bold text-slate-900">{h.hop_number}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">{h.device_name}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">{h.ip}</td>
                          <td className="py-2.5 px-3 font-mono font-semibold text-blue-600">{h.rtt_ms} ms</td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              h.status === 'Success' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {h.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700">
                  <span className="font-bold">Summary: </span>{traceResult.summary}
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-xs text-slate-400">
                Click Trace Hop Route to track packet hops and TTL expiration messages.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== SUB-TAB 3: PACKET WALKTHROUGH ==================== */}
      {activeSubTab === 'packets' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div>
                <label className="block text-slate-500 font-medium mb-1">Source Host</label>
                <select
                  value={pktSource}
                  onChange={(e) => setPktSource(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                >
                  {topology.devices.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.type})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-medium mb-1">Destination Host</label>
                <select
                  value={pktTarget}
                  onChange={(e) => setPktTarget(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                >
                  {topology.devices.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.type})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-medium mb-1">Transport / Protocol</label>
                <select
                  value={pktProtocol}
                  onChange={(e) => setPktProtocol(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="ICMP">ICMP Echo</option>
                  <option value="TCP">TCP (HTTP Port 80)</option>
                  <option value="UDP">UDP (DNS Port 53)</option>
                </select>
              </div>

              <button
                onClick={handleRunPacketSim}
                disabled={pktLoading || !pktSource || !pktTarget}
                className="mt-5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5" />
                {pktLoading ? 'Analyzing...' : 'Generate Packet Flow'}
              </button>
            </div>

            <button 
              onClick={() => setLearningTopic('packetFlow')}
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-semibold"
            >
              <HelpCircle className="w-3.5 h-3.5" /> Learn L2/L3 Encapsulation
            </button>
          </div>

          {pktResult && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Stepper Timeline (2 cols) */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">
                    Step-by-Step Framing & Forwarding Timeline ({pktResult.steps.length} Steps)
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentStepIndex(Math.max(0, currentStepIndex - 1))}
                      disabled={currentStepIndex === 0}
                      className="px-2.5 py-1 text-xs border border-slate-300 rounded font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentStepIndex(Math.min(pktResult.steps.length - 1, currentStepIndex + 1))}
                      disabled={currentStepIndex === pktResult.steps.length - 1}
                      className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 disabled:opacity-40"
                    >
                      Next Step
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {pktResult.steps.map((st, idx) => {
                    const isSelected = idx === currentStepIndex;
                    return (
                      <div 
                        key={st.step_number}
                        onClick={() => setCurrentStepIndex(idx)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer text-xs ${
                          isSelected 
                            ? 'bg-blue-50/80 border-blue-300 ring-2 ring-blue-500/20' 
                            : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/70'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-slate-800">
                            Step {st.step_number}: {st.current_device_name} ({st.device_type.toUpperCase()})
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                            {st.layer}
                          </span>
                        </div>
                        <div className="font-semibold text-blue-900 mb-1">{st.action}</div>
                        <p className="text-slate-600 leading-relaxed">{st.info}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* OSI Inspector Card (1 col) */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-slate-900">
                  OSI Header Inspector (Step {currentStepIndex + 1})
                </h3>

                {pktResult.steps[currentStepIndex] && (() => {
                  const s = pktResult.steps[currentStepIndex];
                  return (
                    <div className="space-y-3 text-xs">
                      {/* Layer 2 Frame Box */}
                      <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl space-y-1.5">
                        <span className="text-[10px] font-bold text-purple-700 uppercase">Layer 2 — Ethernet Frame Header</span>
                        <div className="flex justify-between text-slate-700">
                          <span>Source MAC:</span>
                          <span className="font-mono font-semibold text-slate-900">{s.src_mac}</span>
                        </div>
                        <div className="flex justify-between text-slate-700">
                          <span>Dest MAC (Next-Hop):</span>
                          <span className="font-mono font-semibold text-slate-900">{s.dst_mac}</span>
                        </div>
                      </div>

                      {/* Layer 3 IP Packet Box */}
                      <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1.5">
                        <span className="text-[10px] font-bold text-blue-700 uppercase">Layer 3 — IPv4 Packet Header</span>
                        <div className="flex justify-between text-slate-700">
                          <span>Source IP:</span>
                          <span className="font-mono font-semibold text-slate-900">{s.src_ip}</span>
                        </div>
                        <div className="flex justify-between text-slate-700">
                          <span>Dest IP:</span>
                          <span className="font-mono font-semibold text-slate-900">{s.dst_ip}</span>
                        </div>
                        <div className="flex justify-between text-slate-700">
                          <span>Protocol:</span>
                          <span className="font-bold text-slate-900">{s.protocol}</span>
                        </div>
                      </div>

                      {/* TCP Handshake breakdown if TCP */}
                      {pktResult.three_way_handshake && (
                        <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
                          <span className="text-[10px] font-bold text-emerald-800 uppercase">Transport Layer Connection State</span>
                          {pktResult.three_way_handshake.map((h, i) => (
                            <div key={i} className="text-[11px] pb-1 border-b border-emerald-100 last:border-0">
                              <span className="font-bold text-emerald-900">{h.step}: </span>
                              <span className="text-slate-700">{h.desc}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== SUB-TAB 4: SUBNETTING & CIDR ==================== */}
      {activeSubTab === 'subnetting' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs lg:col-span-1 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">CIDR Subnet Calculator</h2>
              <button 
                onClick={() => setLearningTopic('subnetting')}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-semibold"
              >
                <HelpCircle className="w-3.5 h-3.5" /> Learn Subnetting
              </button>
            </div>

            <form onSubmit={handleCalculateSubnet} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Network/Host IPv4</label>
                <input
                  type="text"
                  value={calcIp}
                  onChange={(e) => setCalcIp(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono"
                  placeholder="e.g. 192.168.10.0"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Prefix Length (/{calcCidr})</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="8"
                    max="30"
                    value={calcCidr}
                    onChange={(e) => setCalcCidr(e.target.value)}
                    className="flex-1"
                  />
                  <span className="font-mono font-bold text-slate-800 w-8 text-right">/{calcCidr}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-2">
                <span className="text-[11px] font-bold text-slate-700 block">Test Subnet Membership:</span>
                <input
                  type="text"
                  value={devAIp}
                  onChange={(e) => setDevAIp(e.target.value)}
                  className="w-full px-3 py-1 border border-slate-300 rounded font-mono text-[11px]"
                  placeholder="Host A IP (e.g. 192.168.10.15)"
                />
                <input
                  type="text"
                  value={devBIp}
                  onChange={(e) => setDevBIp(e.target.value)}
                  className="w-full px-3 py-1 border border-slate-300 rounded font-mono text-[11px]"
                  placeholder="Host B IP (e.g. 192.168.20.10)"
                />
                <input
                  type="text"
                  value={calcGateway}
                  onChange={(e) => setCalcGateway(e.target.value)}
                  className="w-full px-3 py-1 border border-slate-300 rounded font-mono text-[11px]"
                  placeholder="Gateway IP (e.g. 192.168.10.1)"
                />
              </div>

              <button
                type="submit"
                disabled={calcLoading}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50"
              >
                {calcLoading ? 'Calculating...' : 'Calculate Network Boundaries'}
              </button>
            </form>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs lg:col-span-2">
            <h2 className="text-sm font-bold text-slate-900 mb-3">Subnet Calculation Results</h2>
            {subnetResult ? (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Network Address</span>
                    <span className="text-sm font-mono font-bold text-slate-900">{subnetResult.network_address}</span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Subnet Mask</span>
                    <span className="text-sm font-mono font-bold text-slate-900">{subnetResult.netmask}</span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Broadcast Address</span>
                    <span className="text-sm font-mono font-bold text-slate-900">{subnetResult.broadcast_address}</span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Usable Hosts</span>
                    <span className="text-sm font-mono font-bold text-blue-600">{subnetResult.usable_hosts} hosts</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                  <div className="flex justify-between text-slate-700">
                    <span>Usable Host IP Range:</span>
                    <span className="font-mono font-bold text-slate-900">{subnetResult.first_usable_ip} → {subnetResult.last_usable_ip}</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>Address Class & Scope:</span>
                    <span className="font-semibold text-slate-900">{subnetResult.ip_class} ({subnetResult.is_private ? 'Private RFC 1918' : 'Public Routable'})</span>
                  </div>
                </div>

                {/* Subnet membership validation */}
                {subnetResult.same_subnet_test !== null && (
                  <div className={`p-3 rounded-lg border flex items-center justify-between ${
                    subnetResult.same_subnet_test ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}>
                    <div className="flex items-center gap-2">
                      {subnetResult.same_subnet_test ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-amber-600" />}
                      <span>
                        Host A ({devAIp}) and Host B ({devBIp}) <strong>{subnetResult.same_subnet_test ? 'BELONG to the same subnet' : 'DO NOT belong to the same subnet'}</strong>.
                      </span>
                    </div>
                  </div>
                )}

                <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-lg text-blue-900 leading-relaxed">
                  <span className="font-bold">Formula & Theory: </span>{subnetResult.explanation}
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-xs text-slate-400">
                Enter an IPv4 address and CIDR prefix to calculate host ranges.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== SUB-TAB 5: ROUTING TABLES ==================== */}
      {activeSubTab === 'routing' && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Router Next-Hop Routing Tables</h2>
              <p className="text-xs text-slate-500">Extracted live from topology routers via connected interfaces and Dijkstra routing.</p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setLearningTopic('routing')}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-semibold mr-2"
              >
                <HelpCircle className="w-3.5 h-3.5" /> Learn Routing
              </button>
              <button
                onClick={handleFetchRoutingTables}
                disabled={rtLoading}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${rtLoading ? 'animate-spin' : ''}`} />
                Recalculate Routing Tables
              </button>
            </div>
          </div>

          {routingTables.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Click <strong>Recalculate Routing Tables</strong> to inspect router next-hop tables.
            </div>
          ) : (
            <div className="space-y-6">
              {routingTables.map(rt => (
                <div key={rt.router_id} className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-xs">{rt.router_name} ({rt.router_id})</span>
                    <span className="text-[10px] text-slate-500 font-mono">{rt.routes.length} Active Routes</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-xs text-left">
                      <thead className="bg-slate-50/50 text-slate-600 font-semibold uppercase">
                        <tr>
                          <th className="py-2 px-3">Destination Subnet</th>
                          <th className="py-2 px-3">Subnet Mask</th>
                          <th className="py-2 px-3">Next Hop</th>
                          <th className="py-2 px-3">Outgoing Interface</th>
                          <th className="py-2 px-3">Metric Cost</th>
                          <th className="py-2 px-3">Route Type</th>
                          <th className="py-2 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {rt.routes.map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50/80">
                            <td className="py-2 px-3 font-mono font-bold text-slate-900">{r.destination_network}</td>
                            <td className="py-2 px-3 font-mono text-slate-600">{r.netmask}</td>
                            <td className="py-2 px-3 font-semibold text-slate-800">{r.next_hop}</td>
                            <td className="py-2 px-3 font-mono text-slate-500">{r.interface}</td>
                            <td className="py-2 px-3 font-mono font-bold text-blue-600">{r.metric}</td>
                            <td className="py-2 px-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                                {r.route_type}
                              </span>
                            </td>
                            <td className="py-2 px-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                r.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}>
                                {r.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== SUB-TAB 6: STP ==================== */}
      {activeSubTab === 'stp' && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Spanning Tree Protocol (STP 802.1D) Simulation</h2>
              <p className="text-xs text-slate-500">Root Bridge election and Loop-Prevention port blocking on redundant switch connections.</p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setLearningTopic('stp')}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-semibold mr-2"
              >
                <HelpCircle className="w-3.5 h-3.5" /> Learn STP
              </button>
              <button
                onClick={handleRunSTP}
                disabled={stpLoading}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${stpLoading ? 'animate-spin' : ''}`} />
                Elect Root Bridge & Recalculate Ports
              </button>
            </div>
          </div>

          {stpResult ? (
            <div className="space-y-4 text-xs">
              <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl text-indigo-950 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Elected Root Bridge: </span> {stpResult.root_bridge_name} ({stpResult.root_bridge_id})
                  <p className="text-indigo-900/90 mt-1">{stpResult.explanation}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {stpResult.switches.map(sw => (
                  <div key={sw.switch_id} className={`p-4 rounded-xl border shadow-xs ${
                    sw.is_root_bridge ? 'bg-amber-50/50 border-amber-300' : 'bg-white border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-slate-900">{sw.switch_name}</span>
                      {sw.is_root_bridge && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900">
                          ROOT BRIDGE
                        </span>
                      )}
                    </div>
                    <div className="space-y-1 text-slate-600 text-[11px] mb-3">
                      <div>Bridge Priority: <strong>{sw.bridge_priority}</strong></div>
                      <div>Switch MAC: <span className="font-mono">{sw.mac_address}</span></div>
                      <div>Path Cost to Root: <strong>{sw.root_path_cost}</strong></div>
                    </div>

                    <div className="border-t border-slate-100 pt-2 space-y-1.5">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Port Roles & States</span>
                      {sw.ports.length === 0 ? (
                        <div className="text-slate-400 text-[11px]">No active switch links.</div>
                      ) : (
                        sw.ports.map((p, idx) => (
                          <div key={idx} className="flex items-center justify-between text-[11px] py-1 border-b border-slate-50 last:border-0">
                            <span>To {p.connected_device_name}:</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              p.state === 'Forwarding' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {p.role} ({p.state})
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-slate-500">
              Click <strong>Elect Root Bridge & Recalculate Ports</strong> to run STP loop analysis.
            </div>
          )}
        </div>
      )}

      {/* Learn Concept Modal */}
      <LearnConceptModal
        topicKey={learningTopic}
        onClose={() => setLearningTopic(null)}
      />
    </div>
  );
};

export default ProtocolSimulator;
