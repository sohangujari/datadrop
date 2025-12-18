import React, { useState, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  Server,
  Users,
  Copy,
  Check,
  Globe,
  Link,
  Monitor,
  Smartphone,
  RefreshCw,
  Circle,
  ExternalLink,
  QrCode,
} from 'lucide-react';

export default function PeerConnection({
  serverUrl,
  roomId = '',
  role = '', // 'sender' | 'receiver' | ''
  peerConnected = false,
  isConnected = false,
  onRefresh,
}) {
  const [serverInfo, setServerInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState('');
  const [showQR, setShowQR] = useState(false);

  // Fetch server info
  useEffect(() => {
    const fetchServerInfo = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${serverUrl}/server-info`);
        if (!response.ok) throw new Error('Failed to connect');
        const data = await response.json();
        setServerInfo(data);
        setError(null);
      } catch (err) {
        setError('Cannot connect to server');
        setServerInfo(null);
      } finally {
        setLoading(false);
      }
    };

    fetchServerInfo();
    const interval = setInterval(fetchServerInfo, 30000); // Refresh every 30s

    return () => clearInterval(interval);
  }, [serverUrl]);

  // Copy to clipboard
  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(''), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Generate share URL
  const shareUrl = serverInfo
    ? `http://${serverInfo.ip}:5173${roomId ? `?room=${roomId}` : ''}`
    : '';

  // QR Code URL (using external service)
  const qrCodeUrl = shareUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shareUrl)}`
    : '';

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-800 bg-gradient-to-r from-indigo-600/10 to-purple-600/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-lg">
              <Server className="h-5 w-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Connection</h3>
              <p className="text-sm text-gray-400">P2P Transfer Status</p>
            </div>
          </div>

          <button
            onClick={onRefresh}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Connection Status */}
        <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-xl">
          <div className="flex items-center gap-3">
            {loading ? (
              <div className="p-2 bg-gray-700 rounded-lg">
                <RefreshCw className="h-5 w-5 text-gray-400 animate-spin" />
              </div>
            ) : serverInfo ? (
              <div className="p-2 bg-green-500/20 rounded-lg">
                <Wifi className="h-5 w-5 text-green-400" />
              </div>
            ) : (
              <div className="p-2 bg-red-500/20 rounded-lg">
                <WifiOff className="h-5 w-5 text-red-400" />
              </div>
            )}

            <div>
              <p className="font-medium text-white">Server Status</p>
              <p className={`text-sm ${serverInfo ? 'text-green-400' : 'text-red-400'}`}>
                {loading ? 'Connecting...' : serverInfo ? 'Connected' : error || 'Disconnected'}
              </p>
            </div>
          </div>

          {serverInfo && (
            <div className="flex items-center gap-1">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
              </span>
            </div>
          )}
        </div>

        {/* Server Info */}
        {serverInfo && (
          <>
            {/* IP Address */}
            <div className="p-4 bg-gray-800/50 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Globe className="h-4 w-4" />
                  <span>Server IP</span>
                </div>
                <button
                  onClick={() => copyToClipboard(serverInfo.ip, 'ip')}
                  className="flex items-center gap-1.5 px-2 py-1 text-xs bg-gray-700 
                           hover:bg-gray-600 rounded-lg transition-colors"
                >
                  {copied === 'ip' ? (
                    <>
                      <Check className="h-3 w-3 text-green-400" />
                      <span className="text-green-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 text-gray-400" />
                      <span className="text-gray-400">Copy</span>
                    </>
                  )}
                </button>
              </div>
              <p className="font-mono text-lg text-white">{serverInfo.ip}</p>
            </div>

            {/* Share URL */}
            <div className="p-4 bg-gray-800/50 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Link className="h-4 w-4" />
                  <span>Share URL</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowQR(!showQR)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      showQR ? 'bg-indigo-500/20 text-indigo-400' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    }`}
                    title="Show QR Code"
                  >
                    <QrCode className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => copyToClipboard(shareUrl, 'url')}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs bg-gray-700 
                             hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    {copied === 'url' ? (
                      <>
                        <Check className="h-3 w-3 text-green-400" />
                        <span className="text-green-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 text-gray-400" />
                        <span className="text-gray-400">Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <p className="font-mono text-sm text-indigo-400 break-all">{shareUrl}</p>

              {/* QR Code */}
              {showQR && (
                <div className="flex justify-center pt-3">
                  <div className="p-3 bg-white rounded-xl">
                    <img
                      src={qrCodeUrl}
                      alt="QR Code"
                      className="w-40 h-40"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  </div>
                </div>
              )}

              <p className="text-xs text-gray-500">
                Open this URL on another device to connect
              </p>
            </div>
          </>
        )}

        {/* Room Info */}
        {roomId && (
          <div className="p-4 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 
                        border border-indigo-500/20 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Users className="h-4 w-4" />
                <span>Room Code</span>
              </div>
              <button
                onClick={() => copyToClipboard(roomId, 'room')}
                className="flex items-center gap-1.5 px-2 py-1 text-xs bg-gray-700/50 
                         hover:bg-gray-700 rounded-lg transition-colors"
              >
                {copied === 'room' ? (
                  <>
                    <Check className="h-3 w-3 text-green-400" />
                    <span className="text-green-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 text-gray-400" />
                    <span className="text-gray-400">Copy</span>
                  </>
                )}
              </button>
            </div>

            <p className="font-mono text-3xl font-bold tracking-widest text-white text-center">
              {roomId}
            </p>
          </div>
        )}

        {/* Peer Status */}
        {role && (
          <div className="grid grid-cols-2 gap-3">
            {/* This Device */}
            <div className="p-4 bg-gray-800/50 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Monitor className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-400">This Device</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                <span className="font-medium text-white capitalize">{role}</span>
              </div>
            </div>

            {/* Peer Device */}
            <div className="p-4 bg-gray-800/50 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Smartphone className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-400">Peer</span>
              </div>
              <div className="flex items-center gap-2">
                {peerConnected ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                    </span>
                    <span className="font-medium text-green-400">Connected</span>
                  </>
                ) : (
                  <>
                    <Circle className="h-2 w-2 text-yellow-500 fill-yellow-500" />
                    <span className="font-medium text-yellow-400">Waiting...</span>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Connection Guide */}
        {!roomId && serverInfo && (
          <div className="p-4 bg-gray-800/30 rounded-xl border border-gray-700/50">
            <h4 className="font-medium text-white mb-3 flex items-center gap-2">
              <ExternalLink className="h-4 w-4 text-indigo-400" />
              How to Connect
            </h4>
            <ol className="space-y-2 text-sm text-gray-400">
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-500/20 
                               text-indigo-400 text-xs flex items-center justify-center">
                  1
                </span>
                <span>Open the Share URL on another device</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-500/20 
                               text-indigo-400 text-xs flex items-center justify-center">
                  2
                </span>
                <span>Sender creates a room and shares the code</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-500/20 
                               text-indigo-400 text-xs flex items-center justify-center">
                  3
                </span>
                <span>Receiver joins using the room code</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-500/20 
                               text-indigo-400 text-xs flex items-center justify-center">
                  4
                </span>
                <span>Start transferring files instantly!</span>
              </li>
            </ol>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            <div className="flex items-center gap-3">
              <WifiOff className="h-5 w-5 text-red-400 shrink-0" />
              <div>
                <p className="font-medium text-red-400">Connection Failed</p>
                <p className="text-sm text-gray-400 mt-1">
                  Make sure the backend server is running on port 8000
                </p>
              </div>
            </div>
            <button
              onClick={onRefresh}
              className="mt-3 w-full py-2 bg-red-500/20 hover:bg-red-500/30 
                       text-red-400 rounded-lg transition-colors text-sm font-medium"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}