import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  getSampleTopology, 
  validateTopology, 
  analyzeCriticalLinks, 
  saveTopology as apiSaveTopology, 
  listTopologies as apiListTopologies,
  loadTopologyById as apiLoadTopologyById
} from '../services/api';

const NetworkContext = createContext(null);

export const NetworkProvider = ({ children }) => {
  const [topology, setTopology] = useState({
    id: 'default-topology',
    name: 'Default Network',
    devices: [],
    links: []
  });

  const [validationIssues, setValidationIssues] = useState([]);
  const [criticalAnalysis, setCriticalAnalysis] = useState(null);
  const [savedList, setSavedList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Initial load: fetch sample topology if empty
  useEffect(() => {
    loadSample();
    refreshSavedList();
  }, []);

  // Whenever topology changes, run validation and critical links detection
  useEffect(() => {
    if (topology.devices.length > 0) {
      validateCurrentTopology(topology);
      analyzeCurrentTopology(topology);
    } else {
      setValidationIssues([]);
      setCriticalAnalysis(null);
    }
  }, [topology]);

  const refreshSavedList = async () => {
    try {
      const list = await apiListTopologies();
      setSavedList(list);
    } catch (err) {
      console.error('Failed to list saved topologies:', err);
    }
  };

  const loadSample = async () => {
    setLoading(true);
    try {
      const sample = await getSampleTopology();
      setTopology(sample);
      setStatusMessage('Loaded sample company network.');
    } catch (err) {
      console.error('Failed to load sample topology:', err);
      setStatusMessage('Failed to load sample topology. Ensure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const createNewNetwork = () => {
    setTopology({
      id: `topology-${Date.now()}`,
      name: 'Custom Network Topology',
      devices: [],
      links: []
    });
    setCriticalAnalysis(null);
    setValidationIssues([]);
    setStatusMessage('Started a new clean network canvas.');
  };

  const validateCurrentTopology = async (top) => {
    try {
      const res = await validateTopology(top);
      setValidationIssues(res.issues || []);
    } catch (err) {
      console.error('Validation error:', err);
    }
  };

  const analyzeCurrentTopology = async (top) => {
    try {
      const res = await analyzeCriticalLinks(top);
      setCriticalAnalysis(res);
    } catch (err) {
      console.error('Critical link analysis error:', err);
    }
  };

  const addDevice = (device) => {
    setTopology(prev => ({
      ...prev,
      devices: [...prev.devices, device]
    }));
  };

  const updateDevice = (updatedDevice) => {
    setTopology(prev => ({
      ...prev,
      devices: prev.devices.map(d => d.id === updatedDevice.id ? updatedDevice : d)
    }));
  };

  const removeDevice = (deviceId) => {
    setTopology(prev => ({
      ...prev,
      devices: prev.devices.filter(d => d.id !== deviceId),
      links: prev.links.filter(l => l.source !== deviceId && l.target !== deviceId)
    }));
  };

  const addLink = (link) => {
    setTopology(prev => ({
      ...prev,
      links: [...prev.links, link]
    }));
  };

  const updateLink = (updatedLink) => {
    setTopology(prev => ({
      ...prev,
      links: prev.links.map(l => l.id === updatedLink.id ? updatedLink : l)
    }));
  };

  const removeLink = (linkId) => {
    setTopology(prev => ({
      ...prev,
      links: prev.links.filter(l => l.id !== linkId)
    }));
  };

  const saveCurrentTopology = async (name) => {
    setLoading(true);
    try {
      const toSave = {
        ...topology,
        name: name || topology.name,
      };
      await apiSaveTopology(toSave);
      setTopology(toSave);
      await refreshSavedList();
      setStatusMessage(`Saved topology "${toSave.name}" successfully.`);
      return true;
    } catch (err) {
      console.error('Failed to save topology:', err);
      setStatusMessage('Error saving topology.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const loadSavedTopology = async (id) => {
    setLoading(true);
    try {
      const loaded = await apiLoadTopologyById(id);
      setTopology(loaded);
      setStatusMessage(`Loaded topology "${loaded.name}".`);
      return true;
    } catch (err) {
      console.error('Failed to load topology:', err);
      setStatusMessage('Error loading topology.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const resetTopology = () => {
    loadSample();
  };

  return (
    <NetworkContext.Provider
      value={{
        topology,
        setTopology,
        validationIssues,
        criticalAnalysis,
        savedList,
        loading,
        statusMessage,
        setStatusMessage,
        loadSample,
        createNewNetwork,
        addDevice,
        updateDevice,
        removeDevice,
        addLink,
        updateLink,
        removeLink,
        saveCurrentTopology,
        loadSavedTopology,
        resetTopology,
        refreshAnalysis: () => analyzeCurrentTopology(topology),
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = () => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
};
