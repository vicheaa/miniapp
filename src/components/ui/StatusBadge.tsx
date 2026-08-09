import React from 'react';
import { WorkflowStatusInfo } from '@/types/workflow';
import { formatStatusText } from '@/utils/format';

export interface StatusBadgeProps {
  status?: string | WorkflowStatusInfo;
  className?: string;
}

export function getStatusBadgeInfo(status?: string | WorkflowStatusInfo) {
  if (!status) return null;

  let text = '';
  let customStyle: React.CSSProperties = {};

  if (typeof status === 'object') {
    text = status.label || status.name || status.status || status.code || status.title || '';
    if (status.bgColor || status.textColor || status.color) {
      customStyle = {
        backgroundColor: status.bgColor || status.color,
        color: status.textColor,
      };
    }
  } else {
    text = status;
  }

  if (!text) return null;

  const codeKey = (typeof status === 'object' ? status.code || text : text)
    .trim()
    .toUpperCase()
    .replace(/[\s-]/g, '_');
  const displayText = formatStatusText(text);

  let badgeClasses = 'bg-gray-100 text-gray-700 border-gray-200';

  if (codeKey.includes('COMPLET') || codeKey.includes('APPROV')) {
    // COMPLETED -> Emerald / Green
    badgeClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
  } else if (codeKey.includes('IN_PROGRESS') || codeKey.includes('PROGRESS')) {
    // IN_PROGRESS -> Blue
    badgeClasses = 'bg-blue-50 text-blue-700 border-blue-200/80';
  } else if (codeKey.includes('PENDING') || codeKey.includes('WAIT')) {
    // PENDING -> Amber / Orange
    badgeClasses = 'bg-amber-50 text-amber-700 border-amber-200/80';
  } else if (codeKey.includes('REJECT') || codeKey.includes('CANCEL')) {
    // REJECTED -> Rose / Red
    badgeClasses = 'bg-rose-50 text-rose-700 border-rose-200/80';
  }

  return {
    text,
    displayText,
    codeKey,
    badgeClasses,
    customStyle,
  };
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const info = getStatusBadgeInfo(status);
  if (!info) return null;

  return (
    <span
      style={info.customStyle}
      className={`inline-flex items-center px-2.5 pt-0.5 rounded-full text-[11px] font-semibold tracking-wide border shrink-0 ${info.badgeClasses} ${className}`}
    >
      {info.displayText}
    </span>
  );
}

export default StatusBadge;
