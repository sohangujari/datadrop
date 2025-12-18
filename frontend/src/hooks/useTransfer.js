import { useState, useRef, useCallback, useEffect } from 'react';

// Constants
const CHUNK_SIZE = 1024 * 1024; // 1MB chunks

// Transfer Status
export const TransferStatus = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  WAITING_PEER: 'waiting_peer',
  READY: 'ready',
  TRANSFERRING: 'transferring',
  COMPLETED: 'completed',
  ERROR: 'error',
  CANCELLED: 'cancelled',
};

// Connection Status
export const ConnectionStatus = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
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

const formatSpeed = (bytesPerSecond) => {
  return formatSize(bytesPerSecond) + '/s';
};

const formatTime = (seconds) => {
  if (!seconds || seconds === Infinity || isNaN(seconds)) return 'calculating...';
  seconds = Math.round(seconds);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
};

// Main Hook
export default function useTransfer(serverUrl) {
  // Connection State
  const [connectionStatus, setConnectionStatus] = useState(ConnectionStatus.DISCONNECTED);
  const [serverInfo, setServerInfo] = useState(null);

  // Room State
  const [roomId, setRoomId] = useState('');
  const [role, setRole] = useState(''); // 'sender' | 'receiver'
  const [peerConnected, setPeerConnected] = useState(false);

  // Transfer State
  const [transferStatus, setTransferStatus] = useState(TransferStatus.IDLE);
  const [statusMessage, setStatusMessage] = useState('');

  // File Info
  const [fileInfo, setFileInfo] = useState({
    name: '',
    size: 0,
    type: '',
  });

  // Progress State
  const [progress, setProgress] = useState({
    percentage: 0,
    transferred: 0,
    total: 0,
    speed: 0,
    speedFormatted: '0 B/s',
    transferredFormatted: '0 B',
    totalFormatted: '0 B',
    eta: 'calculating...',
    elapsed: '0s',
    averageSpeed: 0,
    averageSpeedFormatted: '0 B/s',
  });

  // Refs
  const wsRef = useRef(null);
  const chunksRef = useRef([]);
  const fileRef = useRef(null);
  const transferCancelledRef = useRef(false);
  const startTimeRef = useRef(0);
  const lastProgressTimeRef = useRef(0);
  const lastBytesRef = useRef(0);

  // Fetch Server Info
  const fetchServerInfo = useCallback(async () => {
    try {
      const response = await fetch(`${serverUrl}/server-info`);
      if (!response.ok) throw new Error('Server not available');
      const data = await response.json();
      setServerInfo(data);
      return data;
    } catch (error) {
      console.error('Failed to fetch server info:', error);
      setServerInfo(null);
      return null;
    }
  }, [serverUrl]);

  // Reset State
  const resetState = useCallback(() => {
    setTransferStatus(TransferStatus.IDLE);
    setStatusMessage('');
    setPeerConnected(false);
    setFileInfo({ name: '', size: 0, type: '' });
    setProgress({
      percentage: 0,
      transferred: 0,
      total: 0,
      speed: 0,
      speedFormatted: '0 B/s',
      transferredFormatted: '0 B',
      totalFormatted: '0 B',
      eta: 'calculating...',
      elapsed: '0s',
      averageSpeed: 0,
      averageSpeedFormatted: '0 B/s',
    });
    chunksRef.current = [];
    fileRef.current = null;
    transferCancelledRef.current = false;
    startTimeRef.current = 0;
    lastProgressTimeRef.current = 0;
    lastBytesRef.current = 0;
  }, []);

  // Handle WebSocket Messages
  const handleMessage = useCallback((data) => {
    switch (data.type) {
      case 'connected':
        setConnectionStatus(ConnectionStatus.CONNECTED);
        if (data.sender_connected || data.receiver_connected) {
          setPeerConnected(true);
          setTransferStatus(TransferStatus.READY);
          setStatusMessage('Peer connected! Ready to transfer.');
        } else {
          setTransferStatus(TransferStatus.WAITING_PEER);
          setStatusMessage('Waiting for peer to connect...');
        }
        break;

      case 'peer_joined':
        setPeerConnected(true);
        setTransferStatus(TransferStatus.READY);
        setStatusMessage(`${data.peer} connected! Ready to transfer.`);
        break;

      case 'peer_left':
        setPeerConnected(false);
        if (transferStatus === TransferStatus.TRANSFERRING) {
          setTransferStatus(TransferStatus.ERROR);
          setStatusMessage('Peer disconnected during transfer.');
        } else {
          setTransferStatus(TransferStatus.WAITING_PEER);
          setStatusMessage('Peer disconnected. Waiting...');
        }
        break;

      case 'file_info':
        setFileInfo({
          name: data.name || 'unknown',
          size: data.size || 0,
          type: data.type || '',
        });
        chunksRef.current = [];
        startTimeRef.current = Date.now();
        setTransferStatus(TransferStatus.TRANSFERRING);
        setStatusMessage(`Receiving: ${data.name}`);
        break;

      case 'transfer_started':
        startTimeRef.current = Date.now();
        setTransferStatus(TransferStatus.TRANSFERRING);
        setStatusMessage('Transfer in progress...');
        break;

      case 'progress':
        updateProgress(data);
        break;

      case 'complete':
        setTransferStatus(TransferStatus.COMPLETED);
        setStatusMessage(`Transfer complete! Average: ${data.average_speed || progress.averageSpeedFormatted}`);
        setProgress((prev) => ({ ...prev, percentage: 100 }));
        break;

      case 'cancelled':
        setTransferStatus(TransferStatus.CANCELLED);
        setStatusMessage('Transfer cancelled.');
        break;

      case 'error':
        setTransferStatus(TransferStatus.ERROR);
        setStatusMessage(data.message || 'An error occurred.');
        break;

      default:
        break;
    }
  }, [transferStatus, progress.averageSpeedFormatted]);

  // Update Progress
  const updateProgress = useCallback((data) => {
    const now = Date.now();
    const elapsed = (now - startTimeRef.current) / 1000;
    const transferred = data.transferred || 0;
    const total = data.total_size || fileInfo.size || 0;

    // Calculate current speed
    const timeDiff = (now - lastProgressTimeRef.current) / 1000;
    const bytesDiff = transferred - lastBytesRef.current;
    const currentSpeed = timeDiff > 0 ? bytesDiff / timeDiff : 0;

    // Calculate average speed
    const avgSpeed = elapsed > 0 ? transferred / elapsed : 0;

    // Calculate ETA
    const remaining = total - transferred;
    const eta = avgSpeed > 0 ? remaining / avgSpeed : 0;

    // Update refs for next calculation
    lastProgressTimeRef.current = now;
    lastBytesRef.current = transferred;

    setProgress({
      percentage: data.progress || (total > 0 ? (transferred / total) * 100 : 0),
      transferred,
      total,
      speed: data.speed || currentSpeed,
      speedFormatted: data.speed_formatted || formatSpeed(currentSpeed),
      transferredFormatted: data.transferred_formatted || formatSize(transferred),
      totalFormatted: data.total_formatted || formatSize(total),
      eta: data.eta || formatTime(eta),
      elapsed: data.elapsed || formatTime(elapsed),
      averageSpeed: avgSpeed,
      averageSpeedFormatted: formatSpeed(avgSpeed),
    });
  }, [fileInfo.size]);

  // Handle Binary Data (for receiver)
  const handleBinaryData = useCallback((data) => {
    chunksRef.current.push(data);
  }, []);

  // Connect WebSocket
  const connect = useCallback((room, userRole) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }

    setConnectionStatus(ConnectionStatus.CONNECTING);
    setTransferStatus(TransferStatus.CONNECTING);
    setStatusMessage('Connecting...');

    const wsUrl = serverUrl.replace('https', 'wss').replace('http', 'ws');
    const ws = new WebSocket(`${wsUrl}/ws/${room}/${userRole}`);
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      console.log(`✅ WebSocket connected as ${userRole}`);
      setRoomId(room);
      setRole(userRole);
      setConnectionStatus(ConnectionStatus.CONNECTED);
    };

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        handleBinaryData(event.data);
      } else {
        try {
          const data = JSON.parse(event.data);
          handleMessage(data);
        } catch (error) {
          console.error('Failed to parse message:', error);
        }
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnectionStatus(ConnectionStatus.ERROR);
      setTransferStatus(TransferStatus.ERROR);
      setStatusMessage('Connection failed.');
    };

    ws.onclose = () => {
      console.log('WebSocket closed');
      setConnectionStatus(ConnectionStatus.DISCONNECTED);
    };

    wsRef.current = ws;
  }, [serverUrl, handleMessage, handleBinaryData]);

  // Disconnect
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setRoomId('');
    setRole('');
    setConnectionStatus(ConnectionStatus.DISCONNECTED);
    resetState();
  }, [resetState]);

  // Create Room (for sender)
  const createRoom = useCallback(async () => {
    try {
      setTransferStatus(TransferStatus.CONNECTING);
      setStatusMessage('Creating room...');

      const response = await fetch(`${serverUrl}/create-room`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to create room');

      const data = await response.json();

      if (data.room_id) {
        connect(data.room_id, 'sender');
        return data.room_id;
      }

      throw new Error('No room ID received');
    } catch (error) {
      console.error('Create room error:', error);
      setTransferStatus(TransferStatus.ERROR);
      setStatusMessage('Failed to create room.');
      return null;
    }
  }, [serverUrl, connect]);

  // Join Room (for receiver)
  const joinRoom = useCallback((room) => {
    if (!room || room.trim().length < 4) {
      setStatusMessage('Invalid room code');
      return false;
    }

    connect(room.toUpperCase().trim(), 'receiver');
    return true;
  }, [connect]);

  // Send File
  const sendFile = useCallback(async (file) => {
    if (!file || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return false;
    }

    if (!peerConnected) {
      setStatusMessage('Wait for receiver to connect.');
      return false;
    }

    transferCancelledRef.current = false;
    fileRef.current = file;
    startTimeRef.current = Date.now();
    lastProgressTimeRef.current = Date.now();
    lastBytesRef.current = 0;

    setFileInfo({
      name: file.name,
      size: file.size,
      type: file.type,
    });

    setProgress({
      percentage: 0,
      transferred: 0,
      total: file.size,
      speed: 0,
      speedFormatted: '0 B/s',
      transferredFormatted: '0 B',
      totalFormatted: formatSize(file.size),
      eta: 'calculating...',
      elapsed: '0s',
      averageSpeed: 0,
      averageSpeedFormatted: '0 B/s',
    });

    setTransferStatus(TransferStatus.TRANSFERRING);
    setStatusMessage('Starting transfer...');

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
      if (transferCancelledRef.current) return;

      const slice = file.slice(offset, offset + CHUNK_SIZE);
      reader.readAsArrayBuffer(slice);
    };

    reader.onload = (e) => {
      if (transferCancelledRef.current) return;

      const chunk = e.target?.result;

      if (chunk && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(chunk);
        offset += chunk.byteLength;

        if (offset < file.size) {
          requestAnimationFrame(readNextChunk);
        } else {
          wsRef.current.send(JSON.stringify({ type: 'complete' }));
        }
      }
    };

    reader.onerror = () => {
      setTransferStatus(TransferStatus.ERROR);
      setStatusMessage('Error reading file.');
    };

    readNextChunk();
    return true;
  }, [peerConnected]);

  // Cancel Transfer
  const cancelTransfer = useCallback(() => {
    transferCancelledRef.current = true;

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'cancel' }));
    }

    setTransferStatus(TransferStatus.CANCELLED);
    setStatusMessage('Transfer cancelled.');
  }, []);

  // Save Received File
  const saveReceivedFile = useCallback(() => {
    if (chunksRef.current.length === 0) return false;

    try {
      const blob = new Blob(chunksRef.current);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileInfo.name || 'downloaded_file';
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);

      return true;
    } catch (error) {
      console.error('Save file error:', error);
      return false;
    }
  }, [fileInfo.name]);

  // Get Received File Blob
  const getReceivedBlob = useCallback(() => {
    if (chunksRef.current.length === 0) return null;
    return new Blob(chunksRef.current);
  }, []);

  // Auto-save when transfer completes (receiver)
  useEffect(() => {
    if (
      role === 'receiver' &&
      transferStatus === TransferStatus.COMPLETED &&
      chunksRef.current.length > 0
    ) {
      setTimeout(() => {
        saveReceivedFile();
      }, 500);
    }
  }, [role, transferStatus, saveReceivedFile]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Check if ready to transfer
  const isReady = connectionStatus === ConnectionStatus.CONNECTED && peerConnected;

  // Check if transferring
  const isTransferring = transferStatus === TransferStatus.TRANSFERRING;

  // Check if completed
  const isCompleted = transferStatus === TransferStatus.COMPLETED;

  // Check if error
  const isError = transferStatus === TransferStatus.ERROR;

  return {
    // Connection
    connectionStatus,
    serverInfo,
    fetchServerInfo,
    connect,
    disconnect,

    // Room
    roomId,
    role,
    createRoom,
    joinRoom,

    // Peer
    peerConnected,

    // Transfer
    transferStatus,
    statusMessage,
    fileInfo,
    progress,

    // Actions
    sendFile,
    cancelTransfer,
    saveReceivedFile,
    getReceivedBlob,
    resetState,

    // Helpers
    isReady,
    isTransferring,
    isCompleted,
    isError,

    // Utilities
    formatSize,
    formatSpeed,
    formatTime,
  };
}