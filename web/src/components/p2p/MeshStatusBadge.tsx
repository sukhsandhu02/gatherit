import React from 'react';
import { useMesh } from '../../lib/p2p/MeshContext';
import { Radio } from 'lucide-react';

export const MeshStatusBadge: React.FC = () => {
  const { connectedCount, setIsMeshModalOpen } = useMesh();

  return (
    <button
      onClick={() => setIsMeshModalOpen(true)}
      className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700/60 shadow-xs transition cursor-pointer backdrop-blur-xs"
      title="Open Offline Mesh & P2P Controls"
    >
      <Radio className={`w-3.5 h-3.5 ${connectedCount > 0 ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}`} />
      <span>{connectedCount > 0 ? `${connectedCount} P2P Peer${connectedCount === 1 ? '' : 's'}` : 'Offline P2P'}</span>
    </button>
  );
};
