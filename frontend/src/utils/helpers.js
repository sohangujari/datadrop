// ============================================================================
// Size & Speed Formatting
// ============================================================================

export const formatSize = (bytes) => {
  if (bytes === 0) return '0 B';
  if (!bytes || isNaN(bytes)) return '--';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const formatSpeed = (bytesPerSecond) => {
  if (!bytesPerSecond || isNaN(bytesPerSecond)) return '0 B/s';
  return formatSize(bytesPerSecond) + '/s';
};

export const parseSize = (sizeString) => {
  const units = {
    B: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
    TB: 1024 * 1024 * 1024 * 1024,
  };

  const match = sizeString.match(/^([\d.]+)\s*(\w+)$/i);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();

  return value * (units[unit] || 1);
};

// ============================================================================
// Time Formatting
// ============================================================================

export const formatTime = (seconds) => {
  if (!seconds || seconds === Infinity || isNaN(seconds) || seconds < 0) {
    return 'calculating...';
  }

  seconds = Math.round(seconds);

  if (seconds < 60) {
    return `${seconds}s`;
  }

  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }

  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  return h > 0 ? `${d}d ${h}h` : `${d}d`;
};

export const formatDuration = (ms) => {
  return formatTime(ms / 1000);
};

export const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
};

export const formatRelativeTime = (date) => {
  const now = new Date();
  const d = new Date(date);
  const seconds = Math.floor((now - d) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return formatDate(date);
};

// ============================================================================
// Percentage & Progress
// ============================================================================

export const calculatePercentage = (current, total) => {
  if (!total || total === 0) return 0;
  return Math.min(Math.max((current / total) * 100, 0), 100);
};

export const formatPercentage = (value, decimals = 1) => {
  if (!value || isNaN(value)) return '0%';
  return value.toFixed(decimals) + '%';
};

// ============================================================================
// File Utilities
// ============================================================================

export const getFileExtension = (filename) => {
  if (!filename) return '';
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
};

export const getFileName = (filename) => {
  if (!filename) return '';
  const parts = filename.split('.');
  if (parts.length > 1) parts.pop();
  return parts.join('.');
};

export const getFileType = (filename) => {
  const ext = getFileExtension(filename);

  const types = {
    image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff'],
    video: ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', '3gp'],
    audio: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma', 'opus'],
    archive: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso'],
    document: ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'md'],
    spreadsheet: ['xls', 'xlsx', 'csv', 'ods'],
    presentation: ['ppt', 'pptx', 'odp'],
    code: ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'html', 'css', 'json', 'xml'],
    executable: ['exe', 'msi', 'dmg', 'app', 'deb', 'rpm', 'apk'],
  };

  for (const [type, extensions] of Object.entries(types)) {
    if (extensions.includes(ext)) return type;
  }

  return 'file';
};

export const isImageFile = (filename) => getFileType(filename) === 'image';
export const isVideoFile = (filename) => getFileType(filename) === 'video';
export const isAudioFile = (filename) => getFileType(filename) === 'audio';
export const isArchiveFile = (filename) => getFileType(filename) === 'archive';
export const isDocumentFile = (filename) => getFileType(filename) === 'document';

export const getMimeType = (filename) => {
  const ext = getFileExtension(filename);

  const mimeTypes = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    pdf: 'application/pdf',
    zip: 'application/zip',
    json: 'application/json',
    txt: 'text/plain',
    html: 'text/html',
    css: 'text/css',
    js: 'text/javascript',
  };

  return mimeTypes[ext] || 'application/octet-stream';
};

// ============================================================================
// String Utilities
// ============================================================================

export const truncate = (str, maxLength, suffix = '...') => {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - suffix.length) + suffix;
};

export const truncateMiddle = (str, maxLength, separator = '...') => {
  if (!str) return '';
  if (str.length <= maxLength) return str;

  const charsToShow = maxLength - separator.length;
  const frontChars = Math.ceil(charsToShow / 2);
  const backChars = Math.floor(charsToShow / 2);

  return str.slice(0, frontChars) + separator + str.slice(-backChars);
};

export const capitalize = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

export const slugify = (str) => {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

// ============================================================================
// ID Generation
// ============================================================================

export const generateId = (length = 8) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const generateRoomCode = (length = 6) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous chars
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// ============================================================================
// Clipboard
// ============================================================================

export const copyToClipboard = async (text) => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    const success = document.execCommand('copy');
    document.body.removeChild(textArea);
    return success;
  } catch (error) {
    console.error('Copy failed:', error);
    return false;
  }
};

// ============================================================================
// URL Utilities
// ============================================================================

export const getQueryParam = (name) => {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
};

export const setQueryParam = (name, value) => {
  const url = new URL(window.location);
  url.searchParams.set(name, value);
  window.history.replaceState({}, '', url);
};

export const removeQueryParam = (name) => {
  const url = new URL(window.location);
  url.searchParams.delete(name);
  window.history.replaceState({}, '', url);
};

export const buildUrl = (base, params = {}) => {
  const url = new URL(base);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
};

// ============================================================================
// Network Utilities
// ============================================================================

export const getApiUrl = () => {
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:8000';
  }
  return `http://${hostname}:8000`;
};

export const getWebSocketUrl = (path = '') => {
  const apiUrl = getApiUrl();
  return apiUrl.replace('http', 'ws') + path;
};

export const isLocalNetwork = (ip) => {
  if (!ip) return false;
  return (
    ip.startsWith('192.168.') ||
    ip.startsWith('10.') ||
    ip.startsWith('172.16.') ||
    ip.startsWith('172.17.') ||
    ip.startsWith('172.18.') ||
    ip.startsWith('172.19.') ||
    ip.startsWith('172.2') ||
    ip.startsWith('172.30.') ||
    ip.startsWith('172.31.') ||
    ip === 'localhost' ||
    ip === '127.0.0.1'
  );
};

// ============================================================================
// Validation
// ============================================================================

export const isValidRoomCode = (code) => {
  if (!code) return false;
  return /^[A-Z0-9]{4,10}$/i.test(code.trim());
};

export const isValidIpAddress = (ip) => {
  if (!ip) return false;
  const pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!pattern.test(ip)) return false;

  const parts = ip.split('.');
  return parts.every((part) => {
    const num = parseInt(part, 10);
    return num >= 0 && num <= 255;
  });
};

export const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// ============================================================================
// Debounce & Throttle
// ============================================================================

export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

export const throttle = (func, limit) => {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
};

// ============================================================================
// Storage Utilities
// ============================================================================

export const storage = {
  get: (key, defaultValue = null) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  },

  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },

  remove: (key) => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },

  clear: () => {
    try {
      localStorage.clear();
      return true;
    } catch {
      return false;
    }
  },
};

// ============================================================================
// Class Name Utility (like clsx/classnames)
// ============================================================================

export const cn = (...classes) => {
  return classes
    .flat()
    .filter((x) => typeof x === 'string' && x.trim())
    .join(' ')
    .trim();
};

// ============================================================================
// Device Detection
// ============================================================================

export const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
};

export const isIOS = () => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
};

export const isAndroid = () => {
  return /Android/.test(navigator.userAgent);
};

export const isTouchDevice = () => {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};

// ============================================================================
// Browser Utilities
// ============================================================================

export const supportsWebSocket = () => {
  return 'WebSocket' in window || 'MozWebSocket' in window;
};

export const supportsClipboard = () => {
  return navigator.clipboard && window.isSecureContext;
};

export const supportsFileApi = () => {
  return !!(window.File && window.FileReader && window.FileList && window.Blob);
};

export const supportsDragAndDrop = () => {
  const div = document.createElement('div');
  return 'draggable' in div || ('ondragstart' in div && 'ondrop' in div);
};

// ============================================================================
// Sleep / Delay
// ============================================================================

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const waitFor = async (condition, timeout = 5000, interval = 100) => {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (condition()) return true;
    await sleep(interval);
  }

  return false;
};

// ============================================================================
// Error Handling
// ============================================================================

export const safeJsonParse = (str, defaultValue = null) => {
  try {
    return JSON.parse(str);
  } catch {
    return defaultValue;
  }
};

export const tryCatch = async (fn, fallback = null) => {
  try {
    return await fn();
  } catch (error) {
    console.error('Error:', error);
    return fallback;
  }
};

// ============================================================================
// Export All
// ============================================================================

export default {
  // Size & Speed
  formatSize,
  formatSpeed,
  parseSize,

  // Time
  formatTime,
  formatDuration,
  formatDate,
  formatRelativeTime,

  // Percentage
  calculatePercentage,
  formatPercentage,

  // File
  getFileExtension,
  getFileName,
  getFileType,
  getMimeType,
  isImageFile,
  isVideoFile,
  isAudioFile,
  isArchiveFile,
  isDocumentFile,

  // String
  truncate,
  truncateMiddle,
  capitalize,
  slugify,

  // ID
  generateId,
  generateRoomCode,
  generateUUID,

  // Clipboard
  copyToClipboard,

  // URL
  getQueryParam,
  setQueryParam,
  removeQueryParam,
  buildUrl,

  // Network
  getApiUrl,
  getWebSocketUrl,
  isLocalNetwork,

  // Validation
  isValidRoomCode,
  isValidIpAddress,
  isValidUrl,

  // Debounce & Throttle
  debounce,
  throttle,

  // Storage
  storage,

  // Class Names
  cn,

  // Device
  isMobile,
  isIOS,
  isAndroid,
  isTouchDevice,

  // Browser
  supportsWebSocket,
  supportsClipboard,
  supportsFileApi,
  supportsDragAndDrop,

  // Async
  sleep,
  waitFor,

  // Error Handling
  safeJsonParse,
  tryCatch,
};