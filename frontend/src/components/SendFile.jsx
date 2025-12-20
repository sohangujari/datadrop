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
  Plus,
  Trash2,
  CheckCircle2,
  List,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// Constants
const CHUNK_SIZE = 1024 * 1024; // 1MB chunks

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

const FileStatus = {
  PENDING: 'pending',
  SENDING: 'sending',
  COMPLETED: 'completed',
  ERROR: 'error',
};

// Utility Functions
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

export default function SendFile({ serverUrl, onTransferComplete, onError }) {
  // File Queue State
  const [files, setFiles] = useState([]); // Array of { id, file, status, progress }
  const [currentFileIndex, setCurrentFileIndex] = useState(-1);

  // Connection State
  const [roomId, setRoomId] = useState('');
  const [status, setStatus] = useState(TransferStatus.IDLE);
  const [statusMessage, setStatusMessage] = useState('');
  const [receiverConnected, setReceiverConnected] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showFileList, setShowFileList] = useState(true);

  // Current File Progress
  const [currentProgress, setCurrentProgress] = useState({
    percentage: 0,
    transferred: 0,
    total: 0,
    speed: 0,
    speedFormatted: '0 B/s',
    eta: 'Calculating...',
    elapsed: '0s',
  });

  // Overall Progress
  const [overallProgress, setOverallProgress] = useState({
    completedFiles: 0,
    totalFiles: 0,
    completedBytes: 0,
    totalBytes: 0,
    percentage: 0,
  });

  // Refs
  const wsRef = useRef(null);
  const fileInputRef = useRef(null);
  const transferCancelledRef = useRef(false);
  const filesQueueRef = useRef([]);

  // Calculate total size
  const totalSize = files.reduce((acc, f) => acc + f.file.size, 0);
  const completedSize = files
    .filter((f) => f.status === FileStatus.COMPLETED)
    .reduce((acc, f) => acc + f.file.size, 0);

  // Generate unique ID
  const generateId = () => Date.now() + Math.random().toString(36).substr(2, 9);

  // Handle WebSocket Messages
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
          setStatusMessage('Receiver disconnected. Waiting...');
        }
        break;

      case 'progress':
        setCurrentProgress({
          percentage: data.progress || 0,
          transferred: data.transferred || 0,
          total: data.total_size || 0,
          speed: data.speed || 0,
          speedFormatted: data.speed_formatted || '0 B/s',
          eta: data.eta || 'Calculating...',
          elapsed: data.elapsed || '0s',
        });
        break;

      case 'complete':
        // Mark current file as completed
        setFiles((prev) =>
          prev.map((f, i) =>
            i === currentFileIndex ? { ...f, status: FileStatus.COMPLETED, progress: 100 } : f
          )
        );
        break;

      case 'error':
        setStatus(TransferStatus.ERROR);
        setStatusMessage(data.message || 'An error occurred.');
        onError?.(data.message);
        break;

      default:
        break;
    }
  }, [currentFileIndex, onError]);

  // Connect WebSocket
  const connectWebSocket = useCallback((room) => {
    const wsUrl = serverUrl.replace('https', 'wss').replace('http', 'ws');
    const ws = new WebSocket(`${wsUrl}/ws/${room}/sender`);

    ws.onopen = () => {
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

    ws.onerror = () => {
      setStatus(TransferStatus.ERROR);
      setStatusMessage('Connection error. Please try again.');
    };

    ws.onclose = () => {
      console.log('WebSocket closed');
    };

    wsRef.current = ws;
  }, [serverUrl, handleWebSocketMessage]);

  // Create Room
  const createRoom = async () => {
    setStatus(TransferStatus.CONNECTING);
    setStatusMessage('Creating room...');

    try {
      const response = await fetch(`${serverUrl}/create-room`, { method: 'POST' });
      if (!response.ok) throw new Error('Failed to create room');

      const data = await response.json();
      if (data.room_id) {
        setRoomId(data.room_id);
        connectWebSocket(data.room_id);
      }
    } catch (error) {
      setStatus(TransferStatus.ERROR);
      setStatusMessage('Failed to create room.');
      onError?.('Failed to create room');
    }
  };

  // Add Files
  const addFiles = (newFiles) => {
    const fileArray = Array.from(newFiles);
    const newFileItems = fileArray.map((file) => ({
      id: generateId(),
      file,
      status: FileStatus.PENDING,
      progress: 0,
    }));

    setFiles((prev) => [...prev, ...newFileItems]);
  };

  // Remove File
  const removeFile = (id) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // Clear All Files
  const clearAllFiles = () => {
    setFiles([]);
    setCurrentFileIndex(-1);
  };

  // Handle Drop
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = e.dataTransfer?.files;
    if (droppedFiles?.length > 0) {
      addFiles(droppedFiles);
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
    const selectedFiles = e.target.files;
    if (selectedFiles?.length > 0) {
      addFiles(selectedFiles);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Send Single File
  const sendSingleFile = (file, index) => {
    return new Promise((resolve, reject) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      setCurrentFileIndex(index);
      setFiles((prev) =>
        prev.map((f, i) => (i === index ? { ...f, status: FileStatus.SENDING } : f))
      );

      // Send file info
      wsRef.current.send(JSON.stringify({
        type: 'file_info',
        name: file.name,
        size: file.size,
      }));

      // Read and send chunks
      const reader = new FileReader();
      let offset = 0;

      const readNextChunk = () => {
        if (transferCancelledRef.current) {
          reject(new Error('Cancelled'));
          return;
        }

        const slice = file.slice(offset, offset + CHUNK_SIZE);
        reader.readAsArrayBuffer(slice);
      };

      reader.onload = (e) => {
        if (transferCancelledRef.current) {
          reject(new Error('Cancelled'));
          return;
        }

        const chunk = e.target?.result;

        if (chunk && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(chunk);
          offset += chunk.byteLength;

          // Update file progress
          const progress = (offset / file.size) * 100;
          setFiles((prev) =>
            prev.map((f, i) => (i === index ? { ...f, progress } : f))
          );

          if (offset < file.size) {
            requestAnimationFrame(readNextChunk);
          } else {
            // File complete
            wsRef.current.send(JSON.stringify({ type: 'complete' }));

            // Wait a bit for server acknowledgment
            setTimeout(() => {
              resolve();
            }, 100);
          }
        }
      };

      reader.onerror = () => {
        reject(new Error('Error reading file'));
      };

      readNextChunk();
    });
  };

  // Send All Files
  const startTransfer = async () => {
    if (files.length === 0 || !receiverConnected) return;

    transferCancelledRef.current = false;
    setStatus(TransferStatus.TRANSFERRING);
    setStatusMessage('Starting transfer...');

    setOverallProgress({
      completedFiles: 0,
      totalFiles: files.length,
      completedBytes: 0,
      totalBytes: totalSize,
      percentage: 0,
    });

    let completedCount = 0;
    let completedBytes = 0;

    for (let i = 0; i < files.length; i++) {
      if (transferCancelledRef.current) break;

      const fileItem = files[i];
      setStatusMessage(`Sending ${i + 1}/${files.length}: ${fileItem.file.name}`);

      try {
        await sendSingleFile(fileItem.file, i);
        completedCount++;
        completedBytes += fileItem.file.size;

        setOverallProgress({
          completedFiles: completedCount,
          totalFiles: files.length,
          completedBytes,
          totalBytes: totalSize,
          percentage: (completedBytes / totalSize) * 100,
        });
      } catch (error) {
        if (error.message === 'Cancelled') break;

        setFiles((prev) =>
          prev.map((f, idx) => (idx === i ? { ...f, status: FileStatus.ERROR } : f))
        );
        console.error(`Error sending file ${fileItem.file.name}:`, error);
      }
    }

    if (!transferCancelledRef.current) {
      setStatus(TransferStatus.COMPLETED);
      setStatusMessage(`All ${completedCount} file(s) sent successfully!`);
      onTransferComplete?.({ filesCount: completedCount, totalSize: completedBytes });
    }
  };

  // Cancel Transfer
  const cancelTransfer = () => {
    transferCancelledRef.current = true;

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'cancel' }));
    }

    setStatus(TransferStatus.CANCELLED);
    setStatusMessage('Transfer cancelled.');
  };

  // Reset Everything
  const resetAll = () => {
    clearAllFiles();
    setRoomId('');
    setStatus(TransferStatus.IDLE);
    setStatusMessage('');
    setReceiverConnected(false);
    setCurrentProgress({
      percentage: 0,
      transferred: 0,
      total: 0,
      speed: 0,
      speedFormatted: '0 B/s',
      eta: 'Calculating...',
      elapsed: '0s',
    });
    setOverallProgress({
      completedFiles: 0,
      totalFiles: 0,
      completedBytes: 0,
      totalBytes: 0,
      percentage: 0,
    });

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  // Copy Room ID
  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Get current file being sent
  const currentFile = currentFileIndex >= 0 ? files[currentFileIndex] : null;

  return (
    <div className="w-full">
      <div className="bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-800 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-blue-600/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/20 rounded-xl">
                <ArrowUpCircle className="h-7 w-7 text-blue-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Send Files</h2>
                <p className="text-sm text-gray-400 mt-0.5">
                  Select multiple files to send
                </p>
              </div>
            </div>

            {files.length > 0 && (
              <div className="text-right">
                <p className="text-lg font-bold text-white">{files.length} file(s)</p>
                <p className="text-sm text-gray-400">{formatSize(totalSize)}</p>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Drop Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`
              relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer 
              transition-all duration-300 ease-out
              ${isDragging
                ? 'border-blue-500 bg-blue-500/10 scale-[1.02] shadow-lg shadow-blue-500/20'
                : 'border-gray-700 hover:border-blue-500/50 hover:bg-gray-800/50'
              }
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileInputChange}
              className="hidden"
            />

            <div className="flex flex-col items-center gap-3">
              <div className={`p-4 rounded-2xl transition-all ${isDragging ? 'bg-blue-500/20 scale-110' : 'bg-gray-800'}`}>
                <Upload className={`h-8 w-8 ${isDragging ? 'text-blue-400 animate-bounce' : 'text-gray-400'}`} />
              </div>

              {isDragging ? (
                <p className="text-lg font-semibold text-blue-400">Drop files here</p>
              ) : (
                <>
                  <p className="text-lg font-semibold text-gray-300">Drag & drop files here</p>
                  <p className="text-sm text-gray-500">or click to browse • Multiple files supported</p>
                </>
              )}
            </div>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-3">
              {/* File List Header */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setShowFileList(!showFileList)}
                  className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                >
                  <List className="h-4 w-4" />
                  <span className="font-medium">Files ({files.length})</span>
                  {showFileList ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {status === TransferStatus.IDLE || status === TransferStatus.READY ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      Add More
                    </button>
                    <button
                      onClick={clearAllFiles}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                      Clear All
                    </button>
                  </div>
                ) : null}
              </div>

              {/* File Items */}
              {showFileList && (
                <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                  {files.map((item, index) => {
                    const FileIcon = getFileIcon(item.file.name);
                    const isCurrentFile = index === currentFileIndex;
                    const isSending = item.status === FileStatus.SENDING;
                    const isCompleted = item.status === FileStatus.COMPLETED;
                    const isError = item.status === FileStatus.ERROR;

                    return (
                      <div
                        key={item.id}
                        className={`
                          relative flex items-center gap-3 p-3 rounded-xl transition-all
                          ${isCurrentFile && isSending ? 'bg-blue-500/10 border border-blue-500/30' : ''}
                          ${isCompleted ? 'bg-green-500/10 border border-green-500/30' : ''}
                          ${isError ? 'bg-red-500/10 border border-red-500/30' : ''}
                          ${!isCurrentFile && !isCompleted && !isError ? 'bg-gray-800/50' : ''}
                        `}
                      >
                        {/* File Icon */}
                        <div className={`p-2 rounded-lg shrink-0 ${isCompleted ? 'bg-green-500/20' : 'bg-gray-700'}`}>
                          {isCompleted ? (
                            <CheckCircle2 className="h-5 w-5 text-green-400" />
                          ) : isSending ? (
                            <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
                          ) : (
                            <FileIcon className="h-5 w-5 text-gray-400" />
                          )}
                        </div>

                        {/* File Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{item.file.name}</p>
                          <p className="text-xs text-gray-500">{formatSize(item.file.size)}</p>

                          {/* Individual Progress Bar */}
                          {isSending && (
                            <div className="mt-2 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 transition-all duration-300"
                                style={{ width: `${item.progress}%` }}
                              />
                            </div>
                          )}
                        </div>

                        {/* Status / Remove Button */}
                        {status === TransferStatus.IDLE || status === TransferStatus.READY ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFile(item.id);
                            }}
                            className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors shrink-0"
                          >
                            <X className="h-4 w-4 text-gray-400 hover:text-white" />
                          </button>
                        ) : (
                          <span className="text-xs text-gray-500 shrink-0">
                            {isCompleted && '✓ Sent'}
                            {isSending && `${item.progress.toFixed(0)}%`}
                            {isError && '✗ Error'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Create Room Button */}
          {files.length > 0 && !roomId && status === TransferStatus.IDLE && (
            <button
              onClick={createRoom}
              className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-blue-700 
                       hover:from-blue-500 hover:to-blue-600 text-white font-semibold 
                       rounded-xl transition-all flex items-center justify-center gap-3"
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

          {/* Room Code Display */}
          {roomId && (
            <div className="bg-gray-800/60 backdrop-blur rounded-xl p-5 border border-gray-700/50">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-400">Room Code</span>
                <button
                  onClick={copyRoomId}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 text-green-400" />
                      <span className="text-green-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-400">Copy</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-4xl font-mono font-bold tracking-[0.3em] text-white">
                  {roomId}
                </span>

                {receiverConnected ? (
                  <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 rounded-full text-sm font-medium">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                    </span>
                    Receiver Connected
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 text-yellow-400 rounded-full text-sm font-medium">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Waiting...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Overall Progress */}
          {status === TransferStatus.TRANSFERRING && (
            <div className="space-y-4">
              {/* Overall Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-400">
                    Overall Progress ({overallProgress.completedFiles}/{overallProgress.totalFiles} files)
                  </span>
                  <span className="text-lg font-bold text-white">
                    {overallProgress.percentage.toFixed(1)}%
                  </span>
                </div>

                <div className="relative h-4 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300 rounded-full"
                    style={{ width: `${overallProgress.percentage}%` }}
                  />
                </div>

                <p className="text-sm text-gray-400 text-center">
                  {formatSize(overallProgress.completedBytes)} / {formatSize(overallProgress.totalBytes)}
                </p>
              </div>

              {/* Current File Progress */}
              {currentFile && (
                <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700/50">
                  <p className="text-sm text-gray-400 mb-2">Current File</p>
                  <p className="font-medium text-white truncate mb-3">{currentFile.file.name}</p>

                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-xs text-gray-500">Speed</p>
                      <p className="text-sm font-semibold text-yellow-400">{currentProgress.speedFormatted}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Progress</p>
                      <p className="text-sm font-semibold text-blue-400">{currentProgress.percentage.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">ETA</p>
                      <p className="text-sm font-semibold text-green-400">{currentProgress.eta}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Completed State */}
          {status === TransferStatus.COMPLETED && (
            <div className="p-6 bg-green-500/10 border border-green-500/30 rounded-xl text-center">
              <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-3" />
              <p className="text-lg font-semibold text-green-400">{statusMessage}</p>
              <p className="text-sm text-gray-400 mt-2">
                Total: {formatSize(overallProgress.completedBytes)}
              </p>
            </div>
          )}

          {/* Status Message */}
          {statusMessage && status !== TransferStatus.COMPLETED && (
            <div
              className={`
                flex items-center justify-center gap-3 p-4 rounded-xl text-sm font-medium
                ${status === TransferStatus.ERROR ? 'bg-red-500/20 text-red-400 border border-red-500/30' : ''}
                ${status === TransferStatus.CANCELLED ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : ''}
                ${status === TransferStatus.WAITING_RECEIVER ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : ''}
                ${status === TransferStatus.READY ? 'bg-green-500/10 text-green-400 border border-green-500/20' : ''}
                ${status === TransferStatus.TRANSFERRING ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : ''}
              `}
            >
              {status === TransferStatus.ERROR && <AlertCircle className="h-5 w-5" />}
              {status === TransferStatus.WAITING_RECEIVER && <Loader2 className="h-5 w-5 animate-spin" />}
              {status === TransferStatus.TRANSFERRING && <Loader2 className="h-5 w-5 animate-spin" />}
              {statusMessage}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4">
            {/* Start Transfer */}
            {status === TransferStatus.READY && files.length > 0 && (
              <button
                onClick={startTransfer}
                className="flex-1 py-4 px-6 bg-gradient-to-r from-green-600 to-emerald-600 
                         hover:from-green-500 hover:to-emerald-500 text-white font-semibold 
                         rounded-xl transition-all flex items-center justify-center gap-3"
              >
                <Send className="h-5 w-5" />
                Send {files.length} File{files.length > 1 ? 's' : ''}
              </button>
            )}

            {/* Cancel */}
            {status === TransferStatus.TRANSFERRING && (
              <button
                onClick={cancelTransfer}
                className="flex-1 py-4 px-6 bg-gradient-to-r from-red-600 to-rose-600 
                         hover:from-red-500 hover:to-rose-500 text-white font-semibold 
                         rounded-xl transition-all flex items-center justify-center gap-3"
              >
                <X className="h-5 w-5" />
                Cancel
              </button>
            )}

            {/* Reset */}
            {(status === TransferStatus.COMPLETED ||
              status === TransferStatus.ERROR ||
              status === TransferStatus.CANCELLED) && (
              <button
                onClick={resetAll}
                className="flex-1 py-4 px-6 bg-gradient-to-r from-gray-700 to-gray-800 
                         hover:from-gray-600 hover:to-gray-700 text-white font-semibold 
                         rounded-xl transition-all flex items-center justify-center gap-3"
              >
                <RefreshCw className="h-5 w-5" />
                Send More Files
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}