import React, { useState, useEffect, useCallback } from 'react';
import {
  Zap,
  Send,
  Download,
  Wifi,
  WifiOff,
  Server,
  RefreshCw,
  Github,
  Monitor,
  Smartphone,
  ArrowLeftRight,
  Info,
  X,
  Copy,
  Check,
  QrCode,
  ExternalLink,
} from 'lucide-react';

// Components
import SendFile from './components/SendFile';
import ReceiveFile from './components/ReceiveFile';
import { ToastProvider, useToast } from './components/Toast';

// Utils
import { getApiUrl, getQueryParam, copyToClipboard } from './utils/helpers';

// Get API URL
const API_URL = getApiUrl();

// Mode constants
const Mode = {
  SEND: 'send',
  RECEIVE: 'receive',
};

// Main App Content
function AppContent() {
  const toast = useToast();

  // State
  const [mode, setMode] = useState(Mode.SEND);
  const [serverInfo, setServerInfo] = useState(null);
  const [serverConnected, setServerConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [copied, setCopied] = useState('');

  // Check for room param in URL (auto-switch to receive mode)
  useEffect(() => {
    const roomParam = getQueryParam('room');
    if (roomParam) {
      setMode(Mode.RECEIVE);
    }
  }, []);

  // Fetch server info
  const fetchServerInfo = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/server-info`);
      if (!response.ok) throw new Error('Server not available');

      const data = await response.json();
      setServerInfo(data);
      setServerConnected(true);
    } catch (error) {
      console.error('Server connection failed:', error);
      setServerInfo(null);
      setServerConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchServerInfo();
    const interval = setInterval(fetchServerInfo, 30000);
    return () => clearInterval(interval);
  }, [fetchServerInfo]);

  // Handle copy
  const handleCopy = async (text, type) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(type);
      setTimeout(() => setCopied(''), 2000);
      toast.success('Copied to clipboard!');
    }
  };

  // Handle transfer complete
  const handleTransferComplete = (data) => {
    toast.success('Transfer Complete!', {
      title: 'Success',
      message: `${data.filename || 'File'} transferred successfully`,
    });
  };

  // Handle error
  const handleError = (error) => {
    toast.error(error || 'An error occurred');
  };

  // Share URL
  const shareUrl = serverInfo ? `http://${serverInfo.ip}:5173` : '';
  const qrCodeUrl = shareUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(shareUrl)}`
    : '';

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gray-900/80 backdrop-blur-lg border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  DataDrop
                </h1>
                <p className="text-xs text-gray-500 hidden sm:block">
                  Direct file sharing over WiFi
                </p>
              </div>
            </div>

            {/* Right Side */}
            <div className="flex items-center gap-3">
              {/* Server Status */}
              <div
                className={`
                  flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium
                  ${serverConnected
                    ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                    : 'bg-red-500/10 text-red-400 border border-red-500/30'
                  }
                `}
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : serverConnected ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                    </span>
                    <Wifi className="h-4 w-4" />
                    <span className="hidden sm:inline">Connected</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-4 w-4" />
                    <span className="hidden sm:inline">Offline</span>
                  </>
                )}
              </div>

              {/* Info Button */}
              <button
                onClick={() => setShowInfo(!showInfo)}
                className={`p-2 rounded-lg transition-colors ${
                  showInfo ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-gray-800 text-gray-400'
                }`}
                title="Connection Info"
              >
                <Info className="h-5 w-5" />
              </button>

              {/* Refresh Button */}
              <button
                onClick={fetchServerInfo}
                disabled={loading}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400"
                title="Refresh"
              >
                <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Server Info Panel */}
      {showInfo && serverInfo && (
        <div className="bg-gray-900 border-b border-gray-800 animate-slideDown">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              {/* Connection Details */}
              <div className="flex flex-wrap gap-4">
                {/* IP Address */}
                <div className="flex items-center gap-3 px-4 py-2 bg-gray-800/50 rounded-lg">
                  <Server className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Server IP</p>
                    <p className="font-mono text-sm text-white">{serverInfo.ip}</p>
                  </div>
                  <button
                    onClick={() => handleCopy(serverInfo.ip, 'ip')}
                    className="p-1 hover:bg-gray-700 rounded transition-colors"
                  >
                    {copied === 'ip' ? (
                      <Check className="h-4 w-4 text-green-400" />
                    ) : (
                      <Copy className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>

                {/* Share URL */}
                <div className="flex items-center gap-3 px-4 py-2 bg-gray-800/50 rounded-lg">
                  <ExternalLink className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Share URL</p>
                    <p className="font-mono text-sm text-blue-400">{shareUrl}</p>
                  </div>
                  <button
                    onClick={() => handleCopy(shareUrl, 'url')}
                    className="p-1 hover:bg-gray-700 rounded transition-colors"
                  >
                    {copied === 'url' ? (
                      <Check className="h-4 w-4 text-green-400" />
                    ) : (
                      <Copy className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              {/* QR Code */}
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg">
                  <img src={qrCodeUrl} alt="QR Code" className="w-16 h-16" />
                </div>
                <div className="text-sm">
                  <p className="text-gray-400">Scan to connect</p>
                  <p className="text-gray-500 text-xs">from another device</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Mode Switcher */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex p-1.5 bg-gray-900 rounded-2xl border border-gray-800">
            <button
              onClick={() => setMode(Mode.SEND)}
              className={`
                flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-200
                ${mode === Mode.SEND
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-600/25'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }
              `}
            >
              <Send className="h-5 w-5" />
              <span>Send</span>
              <Monitor className="h-4 w-4 opacity-50" />
            </button>

            <button
              onClick={() => setMode(Mode.RECEIVE)}
              className={`
                flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-200
                ${mode === Mode.RECEIVE
                  ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg shadow-green-600/25'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }
              `}
            >
              <Download className="h-5 w-5" />
              <span>Receive</span>
              <Smartphone className="h-4 w-4 opacity-50" />
            </button>
          </div>
        </div>

        {/* Connection Required Warning */}
        {!serverConnected && !loading && (
          <div className="max-w-lg mx-auto mb-8">
            <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-2xl text-center">
              <WifiOff className="h-12 w-12 text-red-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-red-400 mb-2">
                Server Not Connected
              </h3>
              <button
                onClick={fetchServerInfo}
                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Transfer Components */}
        {serverConnected && (
          <div className="max-w-2xl mx-auto">
            {mode === Mode.SEND ? (
              <SendFile
                serverUrl={API_URL}
                onTransferComplete={handleTransferComplete}
                onError={handleError}
              />
            ) : (
              <ReceiveFile
                serverUrl={API_URL}
                onTransferComplete={handleTransferComplete}
                onError={handleError}
              />
            )}
          </div>
        )}

        {/* How It Works */}
        <div className="max-w-2xl mx-auto mt-12">
          <div className="p-6 bg-gray-900/50 border border-gray-800 rounded-2xl">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5 text-blue-400" />
              How It Works
            </h3>

            <div className="grid sm:grid-cols-2 gap-4">
              {/* Sender Steps */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-blue-400 flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  Sender (This Device)
                </h4>
                <ol className="space-y-2 text-sm text-gray-400">
                  <li className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-xs flex items-center justify-center">
                      1
                    </span>
                    <span>Select a file to send</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-xs flex items-center justify-center">
                      2
                    </span>
                    <span>Create room & share code</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-xs flex items-center justify-center">
                      3
                    </span>
                    <span>Wait for receiver & send</span>
                  </li>
                </ol>
              </div>

              {/* Receiver Steps */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-green-400 flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Receiver (Other Device)
                </h4>
                <ol className="space-y-2 text-sm text-gray-400">
                  <li className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500/20 text-green-400 text-xs flex items-center justify-center">
                      1
                    </span>
                    <span>Open share URL on device</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500/20 text-green-400 text-xs flex items-center justify-center">
                      2
                    </span>
                    <span>Enter room code</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500/20 text-green-400 text-xs flex items-center justify-center">
                      3
                    </span>
                    <span>File downloads automatically</span>
                  </li>
                </ol>
              </div>
            </div>

            {/* Features */}
            <div className="mt-6 pt-6 border-t border-gray-800">
              <div className="flex flex-wrap gap-3 justify-center">
                <span className="px-3 py-1 bg-gray-800 text-gray-400 text-xs rounded-full">
                  ⚡ Direct P2P
                </span>
                <span className="px-3 py-1 bg-gray-800 text-gray-400 text-xs rounded-full">
                  📦 Any File Size
                </span>
                <span className="px-3 py-1 bg-gray-800 text-gray-400 text-xs rounded-full">
                  🔒 No Cloud Storage
                </span>
                <span className="px-3 py-1 bg-gray-800 text-gray-400 text-xs rounded-full">
                  📊 Real-time Speed
                </span>
                <span className="px-3 py-1 bg-gray-800 text-gray-400 text-xs rounded-full">
                  📱 Cross Platform
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <Zap className="h-4 w-4" />
              <span>DataDrop</span>
              <span className="text-gray-700">•</span>
              <span>Local Network File Sharing</span>
            </div>

            <div className="flex items-center gap-4">
              {serverInfo && (
                <span className="text-xs text-gray-600">
                  Server: {serverInfo.ip}:8000
                </span>
              )}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// App with Provider
export default function App() {
  return (
    <ToastProvider position="bottom-right" maxToasts={5}>
      <AppContent />
    </ToastProvider>
  );
}