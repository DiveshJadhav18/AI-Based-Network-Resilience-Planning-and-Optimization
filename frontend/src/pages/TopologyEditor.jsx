import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { 
  ReactFlow, 
  Controls, 
  Background, 
  applyNodeChanges, 
  applyEdgeChanges, 
  addEdge,
  MarkerType 
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { 
  Plus, Trash2, Save, Download, RefreshCw, AlertTriangle, 
  Route, CheckCircle2, Sliders, ShieldAlert, Layers
} from 'lucide-react';
import { useNetwork } from '../context/NetworkContext';
import CustomDeviceNode from '../components/CustomDeviceNode';
import { findPath } from '../services/api';

const nodeTypes = {
  customDevice: CustomDeviceNode,
};

const TopologyEditor = () => {
  const { 
    topology, 
    setTopology, 
    addDevice, 
    removeDevice, 
    updateDevice,
    addLink, 
    removeLink, 
    updateLink,
    saveCurrentTopology, 
    loadSample, 
    createNewNetwork, 
    savedList, 
    loadSavedTopology,
    validationIssues,
    criticalAnalysis
  } = useNetwork();

  // Selection states
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);

  // New device form modal / dropdown
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newDeviceType, setNewDeviceType] = useState('router');
  const [newDeviceIp, setNewDeviceIp] = useState('');

  // Path finding state in Editor
  const [pathSource, setPathSource] = useState('');
  const [pathTarget, setPathTarget] = useState('');
  const [pathResult, setPathResult] = useState(null);
  const [pathLoading, setPathLoading] = useState(false);

  // Save modal state
  const [saveName, setSaveName] = useState(topology.name || 'My Network');
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Convert topology.devices to React Flow nodes
  const criticalLinkIds = useMemo(() => {
    return new Set((criticalAnalysis?.critical_links || []).map(l => l.link_id));
  }, [criticalAnalysis]);

  const pathLinkIds = useMemo(() => {
    return new Set(pathResult?.path_link_ids || []);
  }, [pathResult]);

  const pathNodeIds = useMemo(() => {
    return new Set(pathResult?.path_nodes || []);
  }, [pathResult]);

  const nodes = useMemo(() => {
    return (topology.devices || []).map((dev, idx) => ({
      id: dev.id,
      type: 'customDevice',
      position: { x: dev.x ?? (150 + (idx % 4) * 200), y: dev.y ?? (100 + Math.floor(idx / 4) * 150) },
      data: {
        name: dev.name,
        type: dev.type,
        ip: dev.ip,
        isHighlighted: pathNodeIds.has(dev.id),
      },
    }));
  }, [topology.devices, pathNodeIds]);

  // Convert topology.links to React Flow edges
  const edges = useMemo(() => {
    return (topology.links || []).map((link) => {
      const isPath = pathLinkIds.has(link.id);
      const isCritical = criticalLinkIds.has(link.id);
      const isFailed = link.status === 'failed';

      let strokeColor = '#94a3b8'; // Default slate-400
      let strokeWidth = 2;
      let strokeDasharray = undefined;

      if (isFailed) {
        strokeColor = '#ef4444'; // Red
        strokeDasharray = '5 5';
      } else if (isPath) {
        strokeColor = '#2563eb'; // Blue
        strokeWidth = 3.5;
      } else if (isCritical) {
        strokeColor = '#f59e0b'; // Amber
        strokeWidth = 2.5;
      }

      return {
        id: link.id,
        source: link.source,
        target: link.target,
        animated: isPath,
        style: {
          stroke: strokeColor,
          strokeWidth: strokeWidth,
          strokeDasharray: strokeDasharray,
        },
        label: `${link.cost}w / ${link.latency}ms`,
        labelStyle: { fill: isFailed ? '#ef4444' : isPath ? '#1d4ed8' : '#64748b', fontSize: 10, fontWeight: 600 },
        labelBgStyle: { fill: '#ffffff', fillOpacity: 0.9 },
        labelBgPadding: [4, 2],
        labelBgBorderRadius: 4,
      };
    });
  }, [topology.links, pathLinkIds, criticalLinkIds]);

  // Update device position on drag stop
  const onNodeDragStop = useCallback((_, node) => {
    const existing = topology.devices.find(d => d.id === node.id);
    if (existing) {
      updateDevice({
        ...existing,
        x: node.position.x,
        y: node.position.y
      });
    }
  }, [topology.devices, updateDevice]);

  // Handle edge connection creation
  const onConnect = useCallback((connection) => {
    const { source, target } = connection;
    if (source === target) return;

    // Check if edge already exists
    const exists = topology.links.some(
      l => (l.source === source && l.target === target) || (l.source === target && l.target === source)
    );
    if (exists) {
      alert('A link already exists between these two devices.');
      return;
    }

    const newLink = {
      id: `link-${Date.now()}`,
      source,
      target,
      cost: 1.0,
      latency: 5.0,
      bandwidth: 100.0,
      status: 'active',
      utilization: 40.0,
      packet_loss: 0.2,
      failure_history: 0,
      age_months: 12
    };
    addLink(newLink);
  }, [topology.links, addLink]);

  const handleAddDeviceSubmit = (e) => {
    e.preventDefault();
    if (!newDeviceName.trim()) return;

    const newDev = {
      id: `dev-${Date.now()}`,
      name: newDeviceName.trim(),
      type: newDeviceType,
      ip: newDeviceIp.trim() || null,
      x: 250 + Math.random() * 100,
      y: 200 + Math.random() * 80,
    };
    addDevice(newDev);
    setNewDeviceName('');
    setNewDeviceIp('');
  };

  const handleFindPath = async () => {
    if (!pathSource || !pathTarget) return;
    setPathLoading(true);
    try {
      const res = await findPath(topology, pathSource, pathTarget);
      setPathResult(res);
    } catch (err) {
      console.error('Failed to calculate path:', err);
    } finally {
      setPathLoading(false);
    }
  };

  const clearPath = () => {
    setPathResult(null);
    setPathSource('');
    setPathTarget('');
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)]">
      {/* Left Canvas Area (70%) */}
      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col overflow-hidden relative">
        {/* Editor Toolbar */}
        <div className="p-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2 z-10">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
              Topology: {topology.name}
            </span>
            <span className="text-xs text-slate-500">
              ({topology.devices.length} devices, {topology.links.length} links)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSaveModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              Save
            </button>
            <button
              onClick={createNewNetwork}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 text-slate-500" />
              New
            </button>
            <button
              onClick={loadSample}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              Reset Sample
            </button>
          </div>
        </div>

        {/* React Flow Canvas */}
        <div className="flex-1 w-full h-full relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodeDragStop={onNodeDragStop}
            onConnect={onConnect}
            onNodeClick={(_, node) => {
              setSelectedNode(topology.devices.find(d => d.id === node.id) || null);
              setSelectedEdge(null);
            }}
            onEdgeClick={(_, edge) => {
              setSelectedEdge(topology.links.find(l => l.id === edge.id) || null);
              setSelectedNode(null);
            }}
            onPaneClick={() => {
              setSelectedNode(null);
              setSelectedEdge(null);
            }}
            fitView
          >
            <Background color="#cbd5e1" gap={20} size={1} />
            <Controls />
          </ReactFlow>

          {/* Quick Legend overlay */}
          <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-xs border border-slate-200 rounded-lg p-2.5 shadow-xs text-[11px] space-y-1.5 z-10">
            <div className="font-semibold text-slate-700">Legend:</div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-0.5 bg-slate-400 inline-block"></span>
              <span className="text-slate-600">Healthy Link</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-1 bg-amber-500 inline-block"></span>
              <span className="text-slate-600">Critical Bridge Link</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-1 bg-blue-600 inline-block"></span>
              <span className="text-slate-600">Calculated Shortest Path</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-0.5 border-b border-dashed border-red-500 inline-block"></span>
              <span className="text-slate-600">Failed / Down Link</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Properties & Controls Panel (30%) */}
      <div className="w-full lg:w-96 flex flex-col gap-4 overflow-y-auto">
        {/* Device Creator Card */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-blue-600" />
            Add Network Device
          </h3>
          <form onSubmit={handleAddDeviceSubmit} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-600 font-medium mb-1">Device Name</label>
              <input
                type="text"
                placeholder="e.g. Core-SW, Server-DB"
                value={newDeviceName}
                onChange={(e) => setNewDeviceName(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Device Type</label>
                <select
                  value={newDeviceType}
                  onChange={(e) => setNewDeviceType(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                >
                  <option value="router">Router</option>
                  <option value="switch">Switch</option>
                  <option value="pc">PC Workstation</option>
                  <option value="server">Server</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">IPv4 Address</label>
                <input
                  type="text"
                  placeholder="e.g. 192.168.1.1"
                  value={newDeviceIp}
                  onChange={(e) => setNewDeviceIp(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-xs transition-colors"
            >
              Add Device to Canvas
            </button>
          </form>
        </div>

        {/* Shortest Path Routing Tool */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Route className="w-4 h-4 text-indigo-600" />
            Dijkstra Path Routing
          </h3>
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Source</label>
                <select
                  value={pathSource}
                  onChange={(e) => setPathSource(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-xs"
                >
                  <option value="">Select source...</option>
                  {topology.devices.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Destination</label>
                <select
                  value={pathTarget}
                  onChange={(e) => setPathTarget(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-xs"
                >
                  <option value="">Select target...</option>
                  {topology.devices.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleFindPath}
                disabled={!pathSource || !pathTarget || pathLoading}
                className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50"
              >
                {pathLoading ? 'Calculating...' : 'Find Shortest Path'}
              </button>
              {pathResult && (
                <button
                  onClick={clearPath}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg font-medium"
                >
                  Clear
                </button>
              )}
            </div>

            {pathResult && (
              <div className={`p-3 rounded-lg border text-xs ${pathResult.exists ? 'bg-blue-50 border-blue-200 text-slate-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                {pathResult.exists ? (
                  <div className="space-y-1">
                    <div className="font-bold text-blue-900 flex items-center justify-between">
                      <span>Path Found</span>
                      <span className="text-[11px] text-blue-700">{pathResult.hop_count} hops</span>
                    </div>
                    <div className="text-[11px] text-slate-600 py-1 font-mono">
                      {pathResult.path_node_names.join(' → ')}
                    </div>
                    <div className="flex justify-between text-[11px] pt-1 border-t border-blue-200/60 text-slate-600">
                      <span>Total Cost: <strong>{pathResult.total_cost}</strong></span>
                      <span>Latency: <strong>{pathResult.total_latency} ms</strong></span>
                    </div>
                  </div>
                ) : (
                  <div className="font-medium">{pathResult.message}</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Selected Element Inspector */}
        {selectedNode && (
          <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-blue-900 uppercase">Device Inspector</h3>
              <button
                onClick={() => {
                  removeDevice(selectedNode.id);
                  setSelectedNode(null);
                }}
                className="text-red-600 hover:text-red-700 p-1 hover:bg-red-50 rounded"
                title="Delete device"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div>
                <label className="text-slate-500 block mb-0.5">Name</label>
                <input
                  type="text"
                  value={selectedNode.name}
                  onChange={(e) => {
                    const updated = { ...selectedNode, name: e.target.value };
                    setSelectedNode(updated);
                    updateDevice(updated);
                  }}
                  className="w-full px-2 py-1 border border-slate-300 rounded"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-500 block mb-0.5">Type</label>
                  <select
                    value={selectedNode.type}
                    onChange={(e) => {
                      const updated = { ...selectedNode, type: e.target.value };
                      setSelectedNode(updated);
                      updateDevice(updated);
                    }}
                    className="w-full px-2 py-1 border border-slate-300 rounded bg-white capitalize"
                  >
                    <option value="router">Router</option>
                    <option value="switch">Switch</option>
                    <option value="pc">PC</option>
                    <option value="server">Server</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-500 block mb-0.5">IP Address</label>
                  <input
                    type="text"
                    value={selectedNode.ip || ''}
                    onChange={(e) => {
                      const updated = { ...selectedNode, ip: e.target.value };
                      setSelectedNode(updated);
                      updateDevice(updated);
                    }}
                    className="w-full px-2 py-1 border border-slate-300 rounded font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                <div>
                  <label className="text-slate-500 block mb-0.5">Default Gateway</label>
                  <input
                    type="text"
                    placeholder="e.g. 192.168.10.1"
                    value={selectedNode.gateway || ''}
                    onChange={(e) => {
                      const updated = { ...selectedNode, gateway: e.target.value };
                      setSelectedNode(updated);
                      updateDevice(updated);
                    }}
                    className="w-full px-2 py-1 border border-slate-300 rounded font-mono text-[11px]"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block mb-0.5">VLAN ID (1-4094)</label>
                  <input
                    type="number"
                    min="1"
                    max="4094"
                    value={selectedNode.vlan_id ?? 1}
                    onChange={(e) => {
                      const updated = { ...selectedNode, vlan_id: parseInt(e.target.value, 10) || 1 };
                      setSelectedNode(updated);
                      updateDevice(updated);
                    }}
                    className="w-full px-2 py-1 border border-slate-300 rounded font-mono text-[11px]"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedEdge && (
          <div className="bg-white p-4 rounded-xl border border-indigo-200 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-indigo-900 uppercase">Link Inspector</h3>
              <button
                onClick={() => {
                  removeLink(selectedEdge.id);
                  setSelectedEdge(null);
                }}
                className="text-red-600 hover:text-red-700 p-1 hover:bg-red-50 rounded"
                title="Delete link"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-500 block mb-0.5">Routing Cost</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.1"
                    value={selectedEdge.cost}
                    onChange={(e) => {
                      const updated = { ...selectedEdge, cost: parseFloat(e.target.value) || 1.0 };
                      setSelectedEdge(updated);
                      updateLink(updated);
                    }}
                    className="w-full px-2 py-1 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block mb-0.5">Latency (ms)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.1"
                    value={selectedEdge.latency}
                    onChange={(e) => {
                      const updated = { ...selectedEdge, latency: parseFloat(e.target.value) || 1.0 };
                      setSelectedEdge(updated);
                      updateLink(updated);
                    }}
                    className="w-full px-2 py-1 border border-slate-300 rounded"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-500 block mb-0.5">Bandwidth (Mbps)</label>
                  <input
                    type="number"
                    step="10"
                    min="1"
                    value={selectedEdge.bandwidth}
                    onChange={(e) => {
                      const updated = { ...selectedEdge, bandwidth: parseFloat(e.target.value) || 100.0 };
                      setSelectedEdge(updated);
                      updateLink(updated);
                    }}
                    className="w-full px-2 py-1 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block mb-0.5">Status</label>
                  <select
                    value={selectedEdge.status}
                    onChange={(e) => {
                      const updated = { ...selectedEdge, status: e.target.value };
                      setSelectedEdge(updated);
                      updateLink(updated);
                    }}
                    className="w-full px-2 py-1 border border-slate-300 rounded bg-white"
                  >
                    <option value="active">Active</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Saved Topologies Quick Loader */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Download className="w-4 h-4 text-slate-500" />
            Saved Topologies
          </h3>
          {savedList.length === 0 ? (
            <p className="text-xs text-slate-400">No custom topologies saved yet.</p>
          ) : (
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {savedList.map(st => (
                <div key={st.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-xs">
                  <div>
                    <div className="font-semibold text-slate-800">{st.name}</div>
                    <div className="text-[10px] text-slate-500">{st.device_count} devs, {st.link_count} links</div>
                  </div>
                  <button
                    onClick={() => loadSavedTopology(st.id)}
                    className="px-2 py-1 bg-white border border-slate-200 rounded text-blue-600 hover:bg-blue-50 font-medium"
                  >
                    Load
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-2">Save Network Topology</h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter a descriptive name to store this topology configuration in JSON storage.
            </p>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mb-4 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="e.g. Campus Network v2"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await saveCurrentTopology(saveName);
                  setShowSaveModal(false);
                }}
                className="px-4 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-xs"
              >
                Save Topology
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TopologyEditor;
