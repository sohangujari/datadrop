import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Download,
  File,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  Loader2,
  Check,
  Zap,
  Clock,
  Users,
  ArrowDownCircle,
  AlertCircle,
  RefreshCw,
  Wifi,
  HardDrive,
  Link,
  CheckCircle2,
  XCircle,
  Save,
} from 'lucide-react';

// ============================================================================
// Constants
// ============================================================================

const TransferStatus = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  WAITING_SENDER: 'waiting_sender',
  READY: 'ready',
  RECEIVING: 'receiving',
  COMPLETED: 'completed',
  ERROR: 'error',
  CANCELLED: 'cancelled',
};

// ============================================================================
// Utility Functions
// ============================================================================

const formatSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getFileIcon = (filename) => {
  const ext = filename?.split('.').pop()?.toLowerCase() || '';

  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'];
  const videoExts = ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm'];
  const audioExts = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'];
  const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'];
  const docExts = ['pdf', 'doc', 'docx', 'txt', 'rtf', 'xls', 'xlsx', 'ppt'];

  if (imageExts.includes(ext)) return FileImage;
  if (videoExts.includes(ext)) return FileVideo;
  if (audioExts.includes(ext)) return FileAudio;
  if (archiveExts.includes(ext)) return FileArchive;
  if (docExts.includes(ext)) return FileText;

  return File;
};

// ============================================================================
// ReceiveFile Component
// ============================================================================

export default function ReceiveFile({ serverUrl, onTransferComplete, onError }) {
  // ─────────────────────────────────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────────────────────────────────

  const [roomId, setRoomId] = useState('');
  const [inputRoomId, setInputRoomId] = useState('');
  const [status, setStatus] = useState(TransferStatus.IDLE);
  const [statusMessage, setStatusMessage] = useState('');
  const [senderConnected, setSenderConnected] = useState(false);

  // File info
  const [fileInfo, setFileInfo] = useState({
    name: '',
    size: 0,
    sizeFormatted: '0 B',
  });

  // Transfer progress
  const [progress, setProgress] = useState({
    percentage: 0,
    transferred: 0,
    total: 0,
    speed: 0,
    speedFormatted: '0 B/s',
    transferredFormatted: '0 B',
    totalFormatted: '0 B',
    eta: 'Calculating...',
    elapsed: '0s',
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Refs
  // ─────────────────────────────────────────────────────────────────────────

  const wsRef = useRef(null);
  const chunksRef = useRef([]);
  const receivedSizeRef = useRef(0);
  const fileInfoRef = useRef({ name: '', size: 0 });

  // ─────────────────────────────────────────────────────────────────────────
  // Save File
  // ─────────────────────────────────────────────────────────────────────────

  const saveFile = useCallback(() => {
    if (chunksRef.current.length === 0) return;

    try {
      // Create blob from chunks
      const blob = new Blob(chunksRef.current);
      const url = URL.createObjectURL(blob);

      // Create download link
      const a = document.createElement('a');
      a.href = url;
      a.download = fileInfoRef.current.name || 'downloaded_file';
      document.body.appendChild(a);
      a.click();

      // Cleanup
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (error) {
      console.error('Error saving file:', error);
      onError?.('Failed to save file');
    }
  }, [onError]);

  // ─────────────────────────────────────────────────────────────────────────
  // WebSocket Message Handler
  // ─────────────────────────────────────────────────────────────────────────

  const handleWebSocketMessage = useCallback(
    (data) => {
      switch (data.type) {
        case 'connected':
          if (data.sender_connected) {
            setSenderConnected(true);
            setStatus(TransferStatus.READY);
            setStatusMessage('Sender connected! Waiting for file...');
          } else {
            setStatus(TransferStatus.WAITING_SENDER);
            setStatusMessage('Waiting for sender to connect...');
          }
          break;

        case 'peer_joined':
          if (data.peer === 'sender') {
            setSenderConnected(true);
            setStatus(TransferStatus.READY);
            setStatusMessage('Sender connected! Waiting for file...');
          }
          break;

        case 'peer_left':
          if (data.peer === 'sender') {
            setSenderConnected(false);
            if (status === TransferStatus.RECEIVING) {
              setStatus(TransferStatus.ERROR);
              setStatusMessage('Sender disconnected during transfer.');
            } else {
              setStatus(TransferStatus.WAITING_SENDER);
              setStatusMessage('Sender disconnected. Waiting...');
            }
          }
          break;

        case 'file_info':
          // File transfer starting
          const info = {
            name: data.name || 'unknown',
            size: data.size || 0,
            sizeFormatted: data.size_formatted || formatSize(data.size || 0),
          };
          setFileInfo(info);
          fileInfoRef.current = info;

          // Reset chunks
          chunksRef.current = [];
          receivedSizeRef.current = 0;

          setStatus(TransferStatus.RECEIVING);
          setStatusMessage(`Receiving: ${info.name}`);
          break;

        case 'chunk':
          // Handle base64 encoded chunk (if sent as JSON)
          if (data.data) {
            try {
              const binaryString = atob(data.data);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              chunksRef.current.push(bytes.buffer);
              receivedSizeRef.current += bytes.length;
            } catch (error) {
              console.error('Error decoding chunk:', error);
            }
          }
          break;

        case 'progress':
          setProgress({
            percentage: data.progress || 0,
            transferred: data.transferred || 0,
            total: data.total_size || 0,
            speed: data.speed || 0,
            speedFormatted: data.speed_formatted || '0 B/s',
            transferredFormatted:
              data.transferred_formatted || formatSize(data.transferred || 0),
            totalFormatted:
              data.total_formatted || formatSize(data.total_size || 0),
            eta: data.eta || 'Calculating...',
            elapsed: data.elapsed || '0s',
          });
          break;

        case 'complete':
          setStatus(TransferStatus.COMPLETED);
          setStatusMessage(
            `Transfer complete! Average speed: ${data.average_speed}`
          );
          setProgress((prev) => ({ ...prev, percentage: 100 }));

          // Auto-save file
          setTimeout(() => {
            saveFile();
          }, 500);

          onTransferComplete?.(data);
          break;

        case 'cancelled':
          setStatus(TransferStatus.CANCELLED);
          setStatusMessage('Transfer was cancelled by sender.');
          break;

        case 'error':
          setStatus(TransferStatus.ERROR);
          setStatusMessage(data.message || 'An error occurred.');
          onError?.(data.message);
          break;

        default:
          break;
      }
    },
    [status, saveFile, onTransferComplete, onError]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Handle Binary Data
  // ─────────────────────────────────────────────────────────────────────────

  const handleBinaryData = useCallback((data) => {
    chunksRef.current.push(data);
    receivedSizeRef.current += data.byteLength;
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // WebSocket Connection
  // ─────────────────────────────────────────────────────────────────────────

  const connectWebSocket = useCallback(
    (room) => {
      const wsUrl = serverUrl.replace('http', 'ws');
      const ws = new WebSocket(`${wsUrl}/ws/${room}/receiver`);

      // Set binary type for receiving chunks
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        console.log('✅ WebSocket connected as receiver');
        setRoomId(room);
        setStatus(TransferStatus.WAITING_SENDER);
        setStatusMessage('Connected! Waiting for sender...');
      };

      ws.onmessage = (event) => {
        // Check if binary data
        if (event.data instanceof ArrayBuffer) {
          handleBinaryData(event.data);
        } else {
          // JSON message
          try {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
          } catch (error) {
            console.error('Error parsing message:', error);
          }
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setStatus(TransferStatus.ERROR);
        setStatusMessage('Connection error. Please try again.');
      };

      ws.onclose = () => {
        console.log('WebSocket closed');
      };

      wsRef.current = ws;
    },
    [serverUrl, handleWebSocketMessage, handleBinaryData]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Join Room
  // ─────────────────────────────────────────────────────────────────────────

  const joinRoom = () => {
    const room = inputRoomId.trim().toUpperCase();

    if (!room) {
      setStatusMessage('Please enter a room code');
      return;
    }

    if (room.length < 4) {
      setStatusMessage('Invalid room code');
      return;
    }

    setStatus(TransferStatus.CONNECTING);
    setStatusMessage('Connecting to room...');
    connectWebSocket(room);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Disconnect
  // ─────────────────────────────────────────────────────────────────────────

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setRoomId('');
    setInputRoomId('');
    setStatus(TransferStatus.IDLE);
    setStatusMessage('');
    setSenderConnected(false);
    setFileInfo({ name: '', size: 0, sizeFormatted: '0 B' });
    setProgress({
      percentage: 0,
      transferred: 0,
      total: 0,
      speed: 0,
      speedFormatted: '0 B/s',
      transferredFormatted: '0 B',
      totalFormatted: '0 B',
      eta: 'Calculating...',
      elapsed: '0s',
    });
    chunksRef.current = [];
    receivedSizeRef.current = 0;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Handle Enter Key
  // ─────────────────────────────────────────────────────────────────────────

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && status === TransferStatus.IDLE) {
      joinRoom();
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Cleanup
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Check URL for room parameter
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');

    if (roomParam && status === TransferStatus.IDLE) {
      setInputRoomId(roomParam.toUpperCase());
    }
  }, [status]);

  // ─────────────────────────────────────────────────────────────────────────
  // Get File Icon Component
  // ─────────────────────────────────────────────────────────────────────────

  const FileIcon = fileInfo.name ? getFileIcon(fileInfo.name) : File;

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="w-full">
      <div className="bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl overflow-hidden">
        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* Header */}
        {/* ─────────────────────────────────────────────────────────────────── */}

        <div className="px-6 py-5 border-b border-gray-800 bg-gradient-to-r from-green-600/10 via-emerald-600/10 to-green-600/10">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-500/20 rounded-xl">
              <ArrowDownCircle className="h-7 w-7 text-green-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Receive File</h2>
              <p className="text-sm text-gray-400 mt-0.5">
                Enter room code to receive files
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* ─────────────────────────────────────────────────────────────────── */}
          {/* Room Code Input */}
          {/* ─────────────────────────────────────────────────────────────────── */}

          {!roomId && status !== TransferStatus.CONNECTING && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-400">
                  Enter Room Code
                </label>
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Link className="h-5 w-5 text-gray-500" />
                    </div>
                    <input
                      type="text"
                      value={inputRoomId}
                      onChange={(e) =>
                        setInputRoomId(e.target.value.toUpperCase())
                      }
                      onKeyDown={handleKeyDown}
                      placeholder="ABC123"
                      maxLength={10}
                      className="w-full pl-12 pr-4 py-4 bg-gray-800/50 border border-gray-700 
                               rounded-xl text-white text-xl font-mono tracking-wider
                               placeholder:text-gray-600 placeholder:tracking-wider
                               focus:outline-none focus:ring-2 focus:ring-green-500/50 
                               focus:border-green-500/50 transition-all"
                    />
                  </div>
                  <button
                    onClick={joinRoom}
                    disabled={!inputRoomId.trim()}
                    className="px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 
                             hover:from-green-500 hover:to-emerald-500 
                             disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed
                             text-white font-semibold rounded-xl transition-all duration-200 
                             flex items-center gap-2 shadow-lg shadow-green-600/20
                             hover:shadow-green-500/30 hover:scale-[1.02] active:scale-[0.98]
                             disabled:shadow-none disabled:hover:scale-100"
                  >
                    <Users className="h-5 w-5" />
                    Join
                  </button>
                </div>
              </div>

              <p className="text-sm text-gray-500 text-center">
                Get the room code from the sender to start receiving files
              </p>
            </div>
          )}

          {/* Connecting State */}
          {status === TransferStatus.CONNECTING && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <div className="p-4 bg-green-500/20 rounded-2xl">
                <Loader2 className="h-10 w-10 text-green-400 animate-spin" />
              </div>
              <p className="text-lg text-gray-300">Connecting to room...</p>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────────── */}
          {/* Connected State - Room Info */}
          {/* ─────────────────────────────────────────────────────────────────── */}

          {roomId && (
            <>
              {/* Room Connection Status */}
              <div className="bg-gray-800/60 backdrop-blur rounded-xl p-5 border border-gray-700/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-green-500/20 rounded-xl">
                      <Link className="h-6 w-6 text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Connected to Room</p>
                      <p className="text-2xl font-mono font-bold tracking-wider text-white">
                        {roomId}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {senderConnected ? (
                      <div
                        className="flex items-center gap-2 px-4 py-2 bg-green-500/20 
                                    text-green-400 rounded-full text-sm font-medium"
                      >
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                        </span>
                        Sender Online
                      </div>
                    ) : (
                      <div
                        className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 
                                    text-yellow-400 rounded-full text-sm font-medium"
                      >
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Waiting for Sender
                      </div>
                    )}

                    {status !== TransferStatus.RECEIVING && (
                      <button
                        onClick={disconnect}
                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                        title="Disconnect"
                      >
                        <XCircle className="h-5 w-5 text-gray-400 hover:text-red-400" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* ─────────────────────────────────────────────────────────────────── */}
              {/* File Info - When receiving */}
              {/* ─────────────────────────────────────────────────────────────────── */}

              {fileInfo.name && (
                <div className="bg-gray-800/60 backdrop-blur rounded-xl p-5 border border-gray-700/50">
                  <div className="flex items-center gap-4">
                    <div className="p-4 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl shrink-0">
                      <FileIcon className="h-8 w-8 text-green-400" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white text-lg truncate">
                        {fileInfo.name}
                      </p>
                      <p className="text-sm text-gray-400 mt-1">
                        {fileInfo.sizeFormatted}
                      </p>
                    </div>

                    {status === TransferStatus.COMPLETED && (
                      <div className="p-3 bg-green-500/20 rounded-xl">
                        <CheckCircle2 className="h-6 w-6 text-green-400" />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────────────── */}
              {/* Transfer Progress */}
              {/* ─────────────────────────────────────────────────────────────────── */}

              {(status === TransferStatus.RECEIVING ||
                status === TransferStatus.COMPLETED) && (
                <div className="space-y-5">
                  {/* Progress Bar */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-400">
                        {status === TransferStatus.RECEIVING
                          ? 'Receiving...'
                          : 'Completed'}
                      </span>
                      <span className="text-lg font-bold text-white">
                        {progress.percentage.toFixed(1)}%
                      </span>
                    </div>

                    <div className="relative h-5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`
                          absolute inset-y-0 left-0 transition-all duration-300 ease-out rounded-full
                          ${
                            status === TransferStatus.COMPLETED
                              ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                              : 'bg-gradient-to-r from-green-500 via-emerald-500 to-green-500 bg-[length:200%_100%] animate-[shimmer_2s_linear_infinite]'
                          }
                        `}
                        style={{ width: `${progress.percentage}%` }}
                      />

                      {/* Progress shine effect */}
                      {status === TransferStatus.RECEIVING && (
                        <div
                          className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_1.5s_ease-in-out_infinite]"
                          style={{
                            transform: `translateX(${progress.percentage * 3}px)`,
                          }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Received */}
                    <div className="bg-gray-800/50 rounded-xl p-4 text-center border border-gray-700/30">
                      <div className="flex items-center justify-center gap-2 text-xs text-gray-500 mb-2">
                        <HardDrive className="h-4 w-4" />
                        <span>Received</span>
                      </div>
                      <div className="text-lg font-bold text-white">
                        {progress.transferredFormatted}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        of {progress.totalFormatted}
                      </div>
                    </div>

                    {/* Speed */}
                    <div className="bg-gray-800/50 rounded-xl p-4 text-center border border-gray-700/30">
                      <div className="flex items-center justify-center gap-2 text-xs text-gray-500 mb-2">
                        <Zap className="h-4 w-4 text-yellow-500" />
                        <span>Speed</span>
                      </div>
                      <div className="text-lg font-bold text-yellow-400">
                        {progress.speedFormatted}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">current</div>
                    </div>

                    {/* ETA */}
                    <div className="bg-gray-800/50 rounded-xl p-4 text-center border border-gray-700/30">
                      <div className="flex items-center justify-center gap-2 text-xs text-gray-500 mb-2">
                        <Clock className="h-4 w-4 text-green-400" />
                        <span>Remaining</span>
                      </div>
                      <div className="text-lg font-bold text-green-400">
                        {status === TransferStatus.COMPLETED
                          ? 'Done!'
                          : progress.eta}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">estimated</div>
                    </div>

                    {/* Elapsed */}
                    <div className="bg-gray-800/50 rounded-xl p-4 text-center border border-gray-700/30">
                      <div className="flex items-center justify-center gap-2 text-xs text-gray-500 mb-2">
                        <Wifi className="h-4 w-4 text-purple-400" />
                        <span>Elapsed</span>
                      </div>
                      <div className="text-lg font-bold text-purple-400">
                        {progress.elapsed}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">time</div>
                    </div>
                  </div>
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────────────── */}
              {/* Waiting for file message */}
              {/* ─────────────────────────────────────────────────────────────────── */}

              {(status === TransferStatus.WAITING_SENDER ||
                status === TransferStatus.READY) &&
                !fileInfo.name && (
                  <div className="flex flex-col items-center justify-center py-12 gap-4">
                    <div className="p-5 bg-gray-800 rounded-2xl">
                      <Download className="h-12 w-12 text-gray-500" />
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-medium text-gray-300">
                        {senderConnected
                          ? 'Ready to receive'
                          : 'Waiting for sender'}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        {senderConnected
                          ? 'File will appear here once sender starts transfer'
                          : 'Ask sender to connect using the room code'}
                      </p>
                    </div>
                    {senderConnected && (
                      <div className="flex items-center gap-2 text-green-400 text-sm">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Sender connected and ready</span>
                      </div>
                    )}
                  </div>
                )}

              {/* ─────────────────────────────────────────────────────────────────── */}
              {/* Status Message */}
              {/* ─────────────────────────────────────────────────────────────────── */}

              {statusMessage && (
                <div
                  className={`
                    flex items-center justify-center gap-3 p-4 rounded-xl text-sm font-medium
                    ${
                      status === TransferStatus.COMPLETED
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : ''
                    }
                    ${
                      status === TransferStatus.ERROR
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : ''
                    }
                    ${
                      status === TransferStatus.CANCELLED
                        ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                        : ''
                    }
                    ${
                      status === TransferStatus.WAITING_SENDER
                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        : ''
                    }
                    ${
                      status === TransferStatus.READY
                        ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                        : ''
                    }
                    ${
                      status === TransferStatus.RECEIVING
                        ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                        : ''
                    }
                  `}
                >
                  {status === TransferStatus.COMPLETED && (
                    <Check className="h-5 w-5" />
                  )}
                  {status === TransferStatus.ERROR && (
                    <AlertCircle className="h-5 w-5" />
                  )}
                  {status === TransferStatus.WAITING_SENDER && (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  )}
                  {status === TransferStatus.RECEIVING && (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  )}
                  {statusMessage}
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────────────── */}
              {/* Action Buttons */}
              {/* ─────────────────────────────────────────────────────────────────── */}

              <div className="flex gap-4">
                {/* Save/Download Again Button */}
                {status === TransferStatus.COMPLETED && (
                  <button
                    onClick={saveFile}
                    className="flex-1 py-4 px-6 bg-gradient-to-r from-green-600 to-emerald-600 
                             hover:from-green-500 hover:to-emerald-500 text-white font-semibold 
                             rounded-xl transition-all duration-200 flex items-center 
                             justify-center gap-3 shadow-lg shadow-green-600/20
                             hover:shadow-green-500/30 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Save className="h-5 w-5" />
                    Download Again
                  </button>
                )}

                {/* Reset Button */}
                {(status === TransferStatus.COMPLETED ||
                  status === TransferStatus.ERROR ||
                  status === TransferStatus.CANCELLED) && (
                  <button
                    onClick={disconnect}
                    className="flex-1 py-4 px-6 bg-gradient-to-r from-gray-700 to-gray-800 
                             hover:from-gray-600 hover:to-gray-700 text-white font-semibold 
                             rounded-xl transition-all duration-200 flex items-center 
                             justify-center gap-3 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <RefreshCw className="h-5 w-5" />
                    Receive Another
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}