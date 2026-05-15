import React, { useEffect, useState } from 'react';
import LogViewer from '../components/LogViewer.jsx';

export default function Logs() {
  const [campaignId, setCampaignId] = useState('');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Logs</h1>
          <p className="text-neutral-400">View campaign logs by ID.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            placeholder="Campaign ID"
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-md px-3 py-2 outline-none"
          />
        </div>
      </div>

      <LogViewer campaignId={campaignId} />
    </div>
  );
}
