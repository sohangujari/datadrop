import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Upload,
  File,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  X,
  Send,
  Loader2,
  Check,
  Zap,
  Clock,
  Users,
  Copy,
  ArrowUpCircle,
  AlertCircle,
  RefreshCw,
  Wifi,
  HardDrive,
} from 'lucide-react';

// ============================================================================
// Constants
// ============================================================================

const CHUNK_SIZE = 1024 * 1024; // 1MB chunks for optimal speed

const TransferStatus = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  WAITING_RECEIVER: 'waiting_receiver',
  READY: 'ready',
  TRANSFERRING: 'transferring',
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

const formatSpeed = (bytesPerSecond) => {
  return formatSize(bytesPerSecond) + '/s';
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
// SendFile Component
// ============================================================================

export default function SendFile({ serverUrl, onTransferComplete, onError }) {
  // ─────────────────────────────────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────────────────────────────────
  
  const [selectedFile, setSelectedFile] = useState(null);
  const [roomId, setRoomId] = useState('');
  const [status, setStatus] = useState(TransferStatus.IDLE);
  const [statusMessage, setStatusMessage] = useState('');
  const [receiverConnected, setReceiverConnected] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  
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
  const fileInputRef = useRef(null);
  const transferCancelledRef = useRef(false);
  
  // ─────────────────────────────────────────────────────────────────────────
  // WebSocket Message Handler
  // ─────────────────────────────────────────────────────────────────────────
  
  const handleWebSocketMessage = useCallback((data) => {
    switch (data.type) {
      case 'connected':
        if (data.receiver_connected) {
          setReceiverConnected(true);
          setStatus(TransferStatus.READY);
          setStatusMessage('Receiver connected! Ready to send.');
        } else {
          setStatus(TransferStatus.WAITING_RECEIVER);
          setStatusMessage('Waiting for receiver to join...');
        }
        break;
        
      case 'peer_joined':
        if (data.peer === 'receiver') {
          setReceiverConnected(true);
          setStatus(TransferStatus.READY);
          setStatusMessage('Receiver connected! Ready to send.');
        }
        break;
        
      case 'peer_left':
        if (data.peer === 'receiver') {
          setReceiverConnected(false);
          setStatus(TransferStatus.WAITING_RECEIVER);
          setStatusMessage('Receiver disconnected. Waiting for new receiver...');
        }
        break;
        
      case 'transfer_started':
        setStatus(TransferStatus.TRANSFERRING);
        setStatusMessage('Transfer in progress...');
        break;
        
      case 'progress':
        setProgress({
          percentage: data.progress || 0,
          transferred: data.transferred || 0,
          total: data.total_size || 0,
          speed: data.speed || 0,
          speedFormatted: data.speed_formatted || '0 B/s',
          transferredFormatted: data.transferred_formatted || formatSize(data.transferred || 0),
          totalFormatted: data.total_formatted || formatSize(data.total_size || 0),
          eta: data.eta || 'Calculating...',
          elapsed: data.elapsed || '0s',
        });
        break;
        
      case 'complete':
        setStatus(TransferStatus.COMPLETED);
        setStatusMessage(`Transfer complete! Average speed: ${data.average_speed}`);
        setProgress((prev) => ({ ...prev, percentage: 100 }));
        onTransferComplete?.(data);
        break;
        
      case 'cancelled':
        setStatus(TransferStatus.CANCELLED);
        setStatusMessage('Transfer was cancelled.');
        break;
        
      case 'error':
        setStatus(TransferStatus.ERROR);
        setStatusMessage(data.message || 'An error occurred.');
        onError?.(data.message);
        break;
        
      default:
        break;
    }
  }, [onTransferComplete, onError]);
  
  // ─────────────────────────────────────────────────────────────────────────
  // WebSocket Connection
  // ─────────────────────────────────────────────────────────────────────────
  
  const connectWebSocket = useCallback((room) => {
    const wsUrl = serverUrl.replace('http', 'ws');
    const ws = new WebSocket(`${wsUrl}/ws/${room}/sender`);
    
    ws.onopen = () => {
      console.log('✅ WebSocket connected as sender');
      setStatus(TransferStatus.WAITING_RECEIVER);
      setStatusMessage('Connected! Waiting for receiver...');
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      } catch (error) {
        console.error('Error parsing message:', error);
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
  }, [serverUrl, handleWebSocketMessage]);
  
  // ─────────────────────────────────────────────────────────────────────────
  // Create Room
  // ─────────────────────────────────────────────────────────────────────────
  
  const createRoom = async () => {
    setStatus(TransferStatus.CONNECTING);
    setStatusMessage('Creating room...');
    
    try {
      const response = await fetch(`${serverUrl}/create-room`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to create room');
      }
      
      const data = await response.json();
      
      if (data.room_id) {
        setRoomId(data.room_id);
        connectWebSocket(data.room_id);
      }
    } catch (error) {
      console.error('Error creating room:', error);
      setStatus(TransferStatus.ERROR);
      setStatusMessage('Failed to create room. Is the server running?');
      onError?.('Failed to create room');
    }
  };
  
  // ─────────────────────────────────────────────────────────────────────────
  // File Selection
  // ─────────────────────────────────────────────────────────────────────────
  
  const handleFileSelect = (file) => {
    if (file) {
      setSelectedFile(file);
      setStatus(TransferStatus.IDLE);
      setStatusMessage('');
      setProgress({
        percentage: 0,
        transferred: 0,
        total: file.size,
        speed: 0,
        speedFormatted: '0 B/s',
        transferredFormatted: '0 B',
        totalFormatted: formatSize(file.size),
        eta: 'Calculating...',
        elapsed: '0s',
      });
    }
  };
  
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, []);
  
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);
  
  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);
  
  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };
  
  const clearFile = () => {
    setSelectedFile(null);
    setRoomId('');
    setStatus(TransferStatus.IDLE);
    setStatusMessage('');
    setReceiverConnected(false);
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
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };
  
  // ─────────────────────────────────────────────────────────────────────────
  // File Transfer
  // ─────────────────────────────────────────────────────────────────────────
  
  const startTransfer = async () => {
    if (!selectedFile || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }
    
    transferCancelledRef.current = false;
    setStatus(TransferStatus.TRANSFERRING);
    setStatusMessage('Starting transfer...');
    
    // Send file info first
    wsRef.current.send(JSON.stringify({
      type: 'file_info',
      name: selectedFile.name,
      size: selectedFile.size,
    }));
    
    // Read and send file in chunks
    const reader = new FileReader();
    let offset = 0;
    let chunkIndex = 0;
    
    const readNextChunk = () => {
      if (transferCancelledRef.current) {
        return;
      }
      
      const slice = selectedFile.slice(offset, offset + CHUNK_SIZE);
      reader.readAsArrayBuffer(slice);
    };
    
    reader.onload = (e) => {
      if (transferCancelledRef.current) {
        return;
      }
      
      const chunk = e.target?.result;
      
      if (chunk && wsRef.current?.readyState === WebSocket.OPEN) {
        // Send as binary for maximum speed
        wsRef.current.send(chunk);
        
        offset += chunk.byteLength;
        chunkIndex++;
        
        if (offset < selectedFile.size) {
          // Continue with next chunk
          requestAnimationFrame(readNextChunk);
        } else {
          // Transfer complete
          wsRef.current.send(JSON.stringify({ type: 'complete' }));
        }
      }
    };
    
    reader.onerror = (error) => {
      console.error('Error reading file:', error);
      setStatus(TransferStatus.ERROR);
      setStatusMessage('Error reading file.');
      onError?.('Error reading file');
    };
    
    // Start reading
    readNextChunk();
  };
  
  const cancelTransfer = () => {
    transferCancelledRef.current = true;
    
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'cancel' }));
    }
    
    setStatus(TransferStatus.CANCELLED);
    setStatusMessage('Transfer cancelled.');
  };
  
  // ─────────────────────────────────────────────────────────────────────────
  // Copy Room ID
  // ─────────────────────────────────────────────────────────────────────────
  
  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
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
  // Get File Icon Component
  // ─────────────────────────────────────────────────────────────────────────
  
  const FileIcon = selectedFile ? getFileIcon(selectedFile.name) : File;
  
  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  
  return (
    <div className="w-full">
      <div className="bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl overflow-hidden">
        
        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* Header */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        
        <div className="px-6 py-5 border-b border-gray-800 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-blue-600/10">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <ArrowUpCircle className="h-7 w-7 text-blue-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Send File</h2>
              <p className="text-sm text-gray-400 mt-0.5">
                Select a file and share with receiver
              </p>
            </div>
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          
          {/* ─────────────────────────────────────────────────────────────────── */}
          {/* Drop Zone - File Selection */}
          {/* ─────────────────────────────────────────────────────────────────── */}
          
          {!selectedFile ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`
                relative border-2 border-dashed rounded-2xl p-12 
                text-center cursor-pointer transition-all duration-300 ease-out
                ${isDragging
                  ? 'border-blue-500 bg-blue-500/10 scale-[1.02] shadow-lg shadow-blue-500/20'
                  : 'border-gray-700 hover:border-blue-500/50 hover:bg-gray-800/50'
                }
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileInputChange}
                className="hidden"
              />
              
              <div className="flex flex-col items-center gap-4">
                <div
                  className={`
                    p-5 rounded-2xl transition-all duration-300
                    ${isDragging
                      ? 'bg-blue-500/20 scale-110'
                      : 'bg-gray-800'
                    }
                  `}
                >
                  <Upload
                    className={`
                      h-10 w-10 transition-all duration-300
                      ${isDragging ? 'text-blue-400 animate-bounce' : 'text-gray-400'}
                    `}
                  />
                </div>
                
                {isDragging ? (
                  <div>
                    <p className="text-xl font-semibold text-blue-400">
                      Drop file here
                    </p>
                    <p className="text-sm text-blue-400/70 mt-1">
                      Release to select this file
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xl font-semibold text-gray-300">
                      Drag & drop a file here
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      or click to browse files
                    </p>
                  </div>
                )}
                
                <div className="flex items-center gap-2 text-xs text-gray-600 mt-2">
                  <HardDrive className="h-4 w-4" />
                  <span>Any file type • Any size • Direct P2P transfer</span>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* ─────────────────────────────────────────────────────────────────── */}
              {/* Selected File Display */}
              {/* ─────────────────────────────────────────────────────────────────── */}
              
              <div className="bg-gray-800/60 backdrop-blur rounded-xl p-5 border border-gray-700/50">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl shrink-0">
                    <FileIcon className="h-8 w-8 text-blue-400" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-lg truncate">
                      {selectedFile.name}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-sm text-gray-400">
                        {formatSize(selectedFile.size)}
                      </span>
                      <span className="text-gray-600">•</span>
                      <span className="text-sm text-gray-500">
                        {selectedFile.type || 'Unknown type'}
                      </span>
                    </div>
                  </div>
                  
                  {status === TransferStatus.IDLE && (
                    <button
                      onClick={clearFile}
                      className="p-2.5 hover:bg-gray-700 rounded-xl transition-colors group"
                      title="Remove file"
                    >
                      <X className="h-5 w-5 text-gray-400 group-hover:text-white" />
                    </button>
                  )}
                </div>
              </div>
              
              {/* ─────────────────────────────────────────────────────────────────── */}
              {/* Create Room Button */}
              {/* ─────────────────────────────────────────────────────────────────── */}
              
              {!roomId && status === TransferStatus.IDLE && (
                <button
                  onClick={createRoom}
                  className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-blue-700 
                           hover:from-blue-500 hover:to-blue-600 text-white font-semibold 
                           rounded-xl transition-all duration-200 flex items-center 
                           justify-center gap-3 shadow-lg shadow-blue-600/20
                           hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Users className="h-5 w-5" />
                  Create Room & Get Code
                </button>
              )}
              
              {/* Connecting State */}
              {status === TransferStatus.CONNECTING && (
                <div className="flex items-center justify-center gap-3 py-4 text-blue-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Creating room...</span>
                </div>
              )}
              
              {/* ─────────────────────────────────────────────────────────────────── */}
              {/* Room Code Display */}
              {/* ─────────────────────────────────────────────────────────────────── */}
              
              {roomId && (
                <div className="bg-gray-800/60 backdrop-blur rounded-xl p-5 border border-gray-700/50">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-400">Room Code</span>
                    <button
                      onClick={copyRoomId}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm 
                               bg-gray-700/50 hover:bg-gray-700 rounded-lg 
                               transition-colors text-gray-300 hover:text-white"
                    >
                      {copied ? (
                        <>
                          <Check className="h-4 w-4 text-green-400" />
                          <span className="text-green-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <span className="text-4xl font-mono font-bold tracking-[0.3em] text-white">
                        {roomId}
                      </span>
                    </div>
                    
                    {receiverConnected ? (
                      <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 
                                    text-green-400 rounded-full text-sm font-medium">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                        </span>
                        Receiver Connected
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 
                                    text-yellow-400 rounded-full text-sm font-medium">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Waiting...
                      </div>
                    )}
                  </div>
                  
                  <p className="text-sm text-gray-500 mt-3">
                    Share this code with the receiver to start transfer
                  </p>
                </div>
              )}
              
              {/* ─────────────────────────────────────────────────────────────────── */}
              {/* Transfer Progress */}
              {/* ─────────────────────────────────────────────────────────────────── */}
              
              {(status === TransferStatus.TRANSFERRING || status === TransferStatus.COMPLETED) && (
                <div className="space-y-5">
                  
                  {/* Progress Bar */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-400">Progress</span>
                      <span className="text-lg font-bold text-white">
                        {progress.percentage.toFixed(1)}%
                      </span>
                    </div>
                    
                    <div className="relative h-5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`
                          absolute inset-y-0 left-0 transition-all duration-300 ease-out rounded-full
                          ${status === TransferStatus.COMPLETED
                            ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                            : 'bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 bg-[length:200%_100%] animate-[shimmer_2s_linear_infinite]'
                          }
                        `}
                        style={{ width: `${progress.percentage}%` }}
                      />
                      
                      {/* Progress shine effect */}
                      {status === TransferStatus.TRANSFERRING && (
                        <div 
                          className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_1.5s_ease-in-out_infinite]"
                          style={{ transform: `translateX(${progress.percentage * 3}px)` }}
                        />
                      )}
                    </div>
                  </div>
                  
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    
                    {/* Transferred */}
                    <div className="bg-gray-800/50 rounded-xl p-4 text-center border border-gray-700/30">
                      <div className="flex items-center justify-center gap-2 text-xs text-gray-500 mb-2">
                        <HardDrive className="h-4 w-4" />
                        <span>Transferred</span>
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
                      <div className="text-xs text-gray-500 mt-1">
                        current
                      </div>
                    </div>
                    
                    {/* ETA */}
                    <div className="bg-gray-800/50 rounded-xl p-4 text-center border border-gray-700/30">
                      <div className="flex items-center justify-center gap-2 text-xs text-gray-500 mb-2">
                        <Clock className="h-4 w-4 text-blue-400" />
                        <span>Remaining</span>
                      </div>
                      <div className="text-lg font-bold text-blue-400">
                        {status === TransferStatus.COMPLETED ? 'Done!' : progress.eta}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        estimated
                      </div>
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
                      <div className="text-xs text-gray-500 mt-1">
                        time
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* ─────────────────────────────────────────────────────────────────── */}
              {/* Status Message */}
              {/* ─────────────────────────────────────────────────────────────────── */}
              
              {statusMessage && (
                <div
                  className={`
                    flex items-center justify-center gap-3 p-4 rounded-xl text-sm font-medium
                    ${status === TransferStatus.COMPLETED 
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                      : ''}
                    ${status === TransferStatus.ERROR 
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                      : ''}
                    ${status === TransferStatus.CANCELLED 
                      ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' 
                      : ''}
                    ${status === TransferStatus.WAITING_RECEIVER 
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                      : ''}
                    ${status === TransferStatus.READY 
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                      : ''}
                    ${status === TransferStatus.TRANSFERRING 
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                      : ''}
                  `}
                >
                  {status === TransferStatus.COMPLETED && <Check className="h-5 w-5" />}
                  {status === TransferStatus.ERROR && <AlertCircle className="h-5 w-5" />}
                  {status === TransferStatus.WAITING_RECEIVER && <Loader2 className="h-5 w-5 animate-spin" />}
                  {status === TransferStatus.TRANSFERRING && <Loader2 className="h-5 w-5 animate-spin" />}
                  {statusMessage}
                </div>
              )}
              
              {/* ─────────────────────────────────────────────────────────────────── */}
              {/* Action Buttons */}
              {/* ─────────────────────────────────────────────────────────────────── */}
              
              <div className="flex gap-4">
                
                {/* Start Transfer Button */}
                {status === TransferStatus.READY && (
                  <button
                    onClick={startTransfer}
                    className="flex-1 py-4 px-6 bg-gradient-to-r from-green-600 to-emerald-600 
                             hover:from-green-500 hover:to-emerald-500 text-white font-semibold 
                             rounded-xl transition-all duration-200 flex items-center 
                             justify-center gap-3 shadow-lg shadow-green-600/20
                             hover:shadow-green-500/30 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Send className="h-5 w-5" />
                    Start Transfer
                  </button>
                )}
                
                {/* Cancel Button */}
                {status === TransferStatus.TRANSFERRING && (
                  <button
                    onClick={cancelTransfer}
                    className="flex-1 py-4 px-6 bg-gradient-to-r from-red-600 to-rose-600 
                             hover:from-red-500 hover:to-rose-500 text-white font-semibold 
                             rounded-xl transition-all duration-200 flex items-center 
                             justify-center gap-3 shadow-lg shadow-red-600/20
                             hover:shadow-red-500/30 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <X className="h-5 w-5" />
                    Cancel Transfer
                  </button>
                )}
                
                {/* Reset Button */}
                {(status === TransferStatus.COMPLETED ||
                  status === TransferStatus.ERROR ||
                  status === TransferStatus.CANCELLED) && (
                  <button
                    onClick={clearFile}
                    className="flex-1 py-4 px-6 bg-gradient-to-r from-gray-700 to-gray-800 
                             hover:from-gray-600 hover:to-gray-700 text-white font-semibold 
                             rounded-xl transition-all duration-200 flex items-center 
                             justify-center gap-3 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <RefreshCw className="h-5 w-5" />
                    Send Another File
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