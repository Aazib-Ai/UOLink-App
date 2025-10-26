'use client';

import { ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh: () => Promise<void> | void;
  enabled?: boolean;
}

export default function PullToRefresh({ 
  children, 
  onRefresh, 
  enabled = true 
}: PullToRefreshProps) {
  const {
    containerRef,
    isPulling,
    pullDistance,
    isRefreshing,
    shouldShowIndicator,
    shouldTrigger
  } = usePullToRefresh({ onRefresh, enabled });

  return (
    <div ref={containerRef} className="relative">
      {/* Pull to refresh indicator */}
      {shouldShowIndicator && (
        <div 
          className={`pull-to-refresh ${shouldShowIndicator ? 'show' : ''}`}
          style={{
            transform: `translateX(-50%) translateY(${Math.min(pullDistance - 40, 0)}px)`
          }}
        >
          <div className="flex items-center space-x-2">
            <RefreshCw 
              className={`h-4 w-4 ${
                isRefreshing || shouldTrigger ? 'animate-spin' : ''
              }`} 
            />
            <span>
              {isRefreshing 
                ? 'Refreshing...' 
                : shouldTrigger 
                  ? 'Release to refresh' 
                  : 'Pull to refresh'
              }
            </span>
          </div>
        </div>
      )}

      {/* Content with pull transform */}
      <div
        style={{
          transform: isPulling ? `translateY(${pullDistance * 0.5}px)` : 'none',
          transition: isPulling ? 'none' : 'transform 0.3s ease'
        }}
      >
        {children}
      </div>
    </div>
  );
}