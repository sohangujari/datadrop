import React from 'react';
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Zap,
  Clock,
  HardDrive,
  Timer,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

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

// Status Types
const TransferType = {
  UPLOAD: 'upload',
  DOWNLOAD: 'download',
};

const TransferStatus = {
  PENDING: 'pending',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  ERROR: 'error',
  CANCELLED: 'cancelled',
};

export default function TransferProgress({
  type = TransferType.UPLOAD,
  status = TransferStatus.ACTIVE,
  filename = '',
  transferred = 0,
  total = 0,
  speed = 0,
  eta = 'Calculating...',
  elapsed = '0s',
  errorMessage = '',
  onCancel,
  compact = false,
}) {
  // Calculate percentage
  const percentage = total > 0 ? Math.min((transferred / total) * 100, 100) : 0;

  // Determine colors based on type and status
  const isUpload = type === TransferType.UPLOAD;
  const isCompleted = status === TransferStatus.COMPLETED;
  const isError = status === TransferStatus.ERROR;
  const isCancelled = status === TransferStatus.CANCELLED;
  const isActive = status === TransferStatus.ACTIVE;

  const accentColor = isCompleted
    ? 'green'
    : isError || isCancelled
    ? 'red'
    : isUpload
    ? 'blue'
    : 'green';

  const gradientClass = isCompleted
    ? 'from-green-500 to-emerald-500'
    : isError || isCancelled
    ? 'from-red-500 to-rose-500'
    : isUpload
    ? 'from-blue-500 via-purple-500 to-blue-500'
    : 'from-green-500 via-emerald-500 to-green-500';

  const Icon = isUpload ? ArrowUpCircle : ArrowDownCircle;
  const StatusIcon = isCompleted
    ? CheckCircle2
    : isError || isCancelled
    ? XCircle
    : Loader2;

  // Compact version for lists
  if (compact) {
    return (
      <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/30">
        <div className="flex items-center gap-3 mb-3">
          <Icon className={`h-5 w-5 text-${accentColor}-400`} />
          <span className="flex-1 font-medium text-white truncate text-sm">
            {filename}
          </span>
          <span className="text-sm text-gray-400">
            {percentage.toFixed(1)}%
          </span>
        </div>

        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${gradientClass} transition-all duration-300`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        <div className="flex justify-between mt-2 text-xs text-gray-500">
          <span>{formatSize(transferred)} / {formatSize(total)}</span>
          <span>{isActive ? formatSpeed(speed) : status}</span>
        </div>
      </div>
    );
  }

  // Full version
  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
      {/* Header */}
      <div
        className={`px-5 py-4 border-b border-gray-800 bg-gradient-to-r 
        ${isUpload ? 'from-blue-600/10 to-purple-600/10' : 'from-green-600/10 to-emerald-600/10'}
        ${isCompleted ? 'from-green-600/10 to-emerald-600/10' : ''}
        ${isError ? 'from-red-600/10 to-rose-600/10' : ''}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 bg-${accentColor}-500/20 rounded-lg`}>
              <Icon className={`h-5 w-5 text-${accentColor}-400`} />
            </div>
            <div>
              <h3 className="font-semibold text-white">
                {isUpload ? 'Uploading' : 'Downloading'}
              </h3>
              <p className="text-sm text-gray-400 truncate max-w-[200px]">
                {filename}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <StatusIcon
              className={`h-5 w-5 
                ${isCompleted ? 'text-green-400' : ''} 
                ${isError || isCancelled ? 'text-red-400' : ''} 
                ${isActive ? 'text-blue-400 animate-spin' : ''}`}
            />
            {isActive && onCancel && (
              <button
                onClick={onCancel}
                className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors"
                title="Cancel"
              >
                <XCircle className="h-4 w-4 text-gray-400 hover:text-red-400" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">Progress</span>
            <span className="text-lg font-bold text-white">
              {percentage.toFixed(1)}%
            </span>
          </div>

          <div className="relative h-4 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`absolute inset-y-0 left-0 bg-gradient-to-r ${gradientClass} 
                         transition-all duration-300 ease-out rounded-full
                         ${isActive ? 'bg-[length:200%_100%] animate-[shimmer_2s_linear_infinite]' : ''}`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Transferred */}
          <div className="bg-gray-800/50 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500 mb-1">
              <HardDrive className="h-3.5 w-3.5" />
              <span>Transferred</span>
            </div>
            <div className="text-sm font-semibold text-white">
              {formatSize(transferred)}
            </div>
            <div className="text-xs text-gray-500">
              / {formatSize(total)}
            </div>
          </div>

          {/* Speed */}
          <div className="bg-gray-800/50 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500 mb-1">
              <Zap className="h-3.5 w-3.5 text-yellow-500" />
              <span>Speed</span>
            </div>
            <div className="text-sm font-semibold text-yellow-400">
              {isActive ? formatSpeed(speed) : '--'}
            </div>
          </div>

          {/* ETA */}
          <div className="bg-gray-800/50 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500 mb-1">
              <Clock className={`h-3.5 w-3.5 text-${accentColor}-400`} />
              <span>ETA</span>
            </div>
            <div className={`text-sm font-semibold text-${accentColor}-400`}>
              {isCompleted ? 'Done!' : isActive ? eta : '--'}
            </div>
          </div>

          {/* Elapsed */}
          <div className="bg-gray-800/50 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500 mb-1">
              <Timer className="h-3.5 w-3.5 text-purple-400" />
              <span>Elapsed</span>
            </div>
            <div className="text-sm font-semibold text-purple-400">
              {elapsed}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {isError && errorMessage && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <XCircle className="h-4 w-4 text-red-400 shrink-0" />
            <span className="text-sm text-red-400">{errorMessage}</span>
          </div>
        )}

        {/* Completed Message */}
        {isCompleted && (
          <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
            <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
            <span className="text-sm text-green-400">
              Transfer completed successfully!
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// Export types for use in other components
TransferProgress.Type = TransferType;
TransferProgress.Status = TransferStatus;