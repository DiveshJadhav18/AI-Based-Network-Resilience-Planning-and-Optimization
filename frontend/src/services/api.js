import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const checkHealth = async () => {
  const res = await api.get('/api/health');
  return res.data;
};

export const getSampleTopology = async () => {
  const res = await api.get('/api/topology/sample');
  return res.data;
};

export const validateTopology = async (topology) => {
  const res = await api.post('/api/topology/validate', topology);
  return res.data;
};

export const saveTopology = async (topology) => {
  const res = await api.post('/api/topology/save', topology);
  return res.data;
};

export const listTopologies = async () => {
  const res = await api.get('/api/topology/list');
  return res.data;
};

export const loadTopologyById = async (id) => {
  const res = await api.get(`/api/topology/${id}`);
  return res.data;
};

export const analyzeCriticalLinks = async (topology) => {
  const res = await api.post('/api/analysis/critical-links', topology);
  return res.data;
};

export const findPath = async (topology, sourceId, targetId) => {
  const res = await api.post('/api/analysis/path', {
    topology,
    source_id: sourceId,
    target_id: targetId,
  });
  return res.data;
};

export const simulateFailure = async (topology, failedLinkId, sourceId = null, targetId = null) => {
  const res = await api.post('/api/analysis/failure', {
    topology,
    failed_link_id: failedLinkId,
    source_id: sourceId,
    target_id: targetId,
  });
  return res.data;
};

export const getBackupRecommendation = async (topology, failedLinkId = null) => {
  const url = failedLinkId 
    ? `/api/recommendations/backup-link?failed_link_id=${failedLinkId}`
    : '/api/recommendations/backup-link';
  const res = await api.post(url, topology);
  return res.data;
};

export const compareTopologies = async (beforeTopology, afterTopology) => {
  const res = await api.post('/api/recommendations/compare', {
    before: beforeTopology,
    after: afterTopology,
  });
  return res.data;
};

export const predictLinkRisks = async (topology) => {
  const res = await api.post('/api/ml/predict', topology);
  return res.data;
};

export const getMLMetrics = async () => {
  const res = await api.get('/api/ml/metrics');
  return res.data;
};

export default api;
