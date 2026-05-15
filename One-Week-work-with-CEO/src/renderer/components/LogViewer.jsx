import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, CheckCircle, XCircle, AlertTriangle, Terminal, Download } from 'lucide-react';

const levelConfig = {
  info: {
    icon: Info,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20'
  },
  success: {
    icon: CheckCircle,
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/20'
  },
  error: {
    icon: XCircle,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20'
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20'
  }
};

function LogEntry({ log, index }) {
  const config = levelConfig[log.level] || levelConfig.info;
  const Icon = config.icon;
  const time = new Date(log.timestamp).toLocaleTimeString();

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.02 }}
      className={`flex gap-3 p-3 rounded-lg ${config.bg} border ${config.border}`}
    >
      <div className="flex-shrink-0 mt-0.5">
        <Icon className={`w-4 h-4 ${config.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white break-words">{log.message}</p>
        <p className="text-xs text-neutral-500 mt-1">{time}</p>
      </div>
    </motion.div>
  );
}

export default function LogViewer({ campaignId }) {
  const [logs, setLogs] = useState([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const logsEndRef = useRef(null);
  const containerRef = useRef(null);

  const scrollToBottom = () => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  useEffect(() => {
    if (!campaignId) {
      setLogs([]);
      return;
    }

    const loadLogs = async () => {
      if (window.api && window.api.getCampaignLogs) {
        const campaignLogs = await window.api.getCampaignLogs(campaignId);
        setLogs(campaignLogs || []);
      }
    };

    loadLogs();

    // Listen for new logs
    if (window.api && window.api.onLog) {
      const unsub = window.api.onLog((evt) => {
        if (evt.campaignId === campaignId) {
          setLogs(prev => [...prev, evt]);
        }
      });
      return () => unsub?.();
    }
  }, [campaignId]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  };

  const downloadLogs = () => {
    const logText = logs.map(log => {
      const time = new Date(log.timestamp).toISOString();
      return `[${time}] [${log.level.toUpperCase()}] ${log.message}`;
    }).join('\n');

    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `campaign-${campaignId}-logs.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!campaignId) {
    return (
      <div className="h-96 bg-neutral-900 border border-neutral-800 rounded-2xl flex items-center justify-center">
        <div className="text-center">
          <Terminal className="w-12 h-12 text-neutral-700 mx-auto mb-3" />
          <p className="text-neutral-500">Select a campaign to view logs</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-neutral-800/50 border-b border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-neutral-300">
            Campaign Logs
          </span>
          <span className="text-xs text-neutral-500">
            ({logs.length} entries)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              autoScroll
                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
            }`}
          >
            Auto-scroll: {autoScroll ? 'ON' : 'OFF'}
          </button>
          {logs.length > 0 && (
            <button
              onClick={downloadLogs}
              className="px-3 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white text-xs font-medium flex items-center gap-1 transition-colors"
            >
              <Download className="w-3 h-3" />
              Export
            </button>
          )}
        </div>
      </div>

      {/* Logs Container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-96 overflow-y-auto p-4 space-y-2 bg-neutral-950/30"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#404040 transparent'
        }}
      >
        {logs.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-neutral-600">No logs yet. Start the campaign to see activity.</p>
          </div>
        ) : (
          <AnimatePresence>
            {logs.map((log, index) => (
              <LogEntry key={index} log={log} index={index} />
            ))}
          </AnimatePresence>
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}