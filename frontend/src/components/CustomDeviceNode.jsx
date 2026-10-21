import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Router, Server, Monitor, HardDrive, Cpu } from 'lucide-react';

const getDeviceIcon = (type) => {
  switch (type?.toLowerCase()) {
    case 'router':
      return { icon: Router, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' };
    case 'switch':
      return { icon: Cpu, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
    case 'server':
      return { icon: Server, color: 'text-purple-600 bg-purple-50 border-purple-200' };
    case 'pc':
    default:
      return { icon: Monitor, color: 'text-blue-600 bg-blue-50 border-blue-200' };
  }
};

const CustomDeviceNode = ({ data, selected }) => {
  const { name, type, ip, isHighlighted, isFailed, isAffected } = data;
  const { icon: Icon, color } = getDeviceIcon(type);

  let borderStyle = 'border-slate-200 hover:border-slate-300';
  if (selected) borderStyle = 'ring-2 ring-blue-500 border-blue-500 shadow-md';
  if (isHighlighted) borderStyle = 'ring-2 ring-amber-500 border-amber-500 bg-amber-50/50 shadow-md';
  if (isFailed) borderStyle = 'ring-2 ring-red-500 border-red-500 bg-red-50 shadow-md';
  if (isAffected) borderStyle = 'ring-2 ring-orange-500 border-orange-500 bg-orange-50 shadow-md';

  return (
    <div className={`px-4 py-3 bg-white rounded-xl shadow-xs border ${borderStyle} transition-all duration-150 min-w-[130px]`}>
      <Handle type="target" position={Position.Top} className="!w-2.5 !h-2.5 !bg-slate-400 !border-2 !border-white" />
      <Handle type="target" position={Position.Left} className="!w-2.5 !h-2.5 !bg-slate-400 !border-2 !border-white" />
      
      <div className="flex items-center space-x-2.5">
        <div className={`p-2 rounded-lg border ${color} shrink-0`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="overflow-hidden">
          <div className="text-xs font-semibold text-slate-800 truncate" title={name}>
            {name}
          </div>
          <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
            {type}
          </div>
          {ip && (
            <div className="text-[10px] font-mono text-slate-600 truncate mt-0.5" title={ip}>
              {ip}
            </div>
          )}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white" />
      <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white" />
    </div>
  );
};

export default React.memo(CustomDeviceNode);
