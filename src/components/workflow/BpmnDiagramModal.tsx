import React, { useEffect, useRef, useState } from 'react';
import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import {
  X,
  User,
  Clock,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ZoomIn,
  ZoomOut,
  Maximize2
} from 'lucide-react';
import {
  fetchBpmnDiagram,
  fetchTaskUserDestList,
  BpmnDiagramResponse,
  TaskUserDestination
} from '@/services/api/workflow-api';
import { useTranslation } from '@/hooks/useTranslation';
import { formatDateTimeCompact } from '@/utils/format';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { useMiniAppStore } from '@/store/miniAppStore';

interface BpmnDiagramModalProps {
  open: boolean;
  onClose: () => void;
  procInstId: string | null;
  title?: string;
}

interface SelectedTaskState {
  taskId: string;
  taskDefKey: string;
  taskName: string;
  isActive: boolean;
}

export default function BpmnDiagramModal({
  open,
  onClose,
  procInstId,
  title,
}: BpmnDiagramModalProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diagramData, setDiagramData] = useState<BpmnDiagramResponse | null>(null);

  // Selected task state for BottomSheet dest list
  const [selectedTask, setSelectedTask] = useState<SelectedTaskState | null>(null);
  const [destListLoading, setDestListLoading] = useState(false);
  const [destListError, setDestListError] = useState<string | null>(null);
  const [userDestList, setUserDestList] = useState<TaskUserDestination[] | null>(null);

  const superApp = useMiniAppStore((s) => s.superApp);
  
  // Reset selected task drawer when main modal opens or closes
  useEffect(() => {
    if (!open) {
      setSelectedTask(null);
      setUserDestList(null);
    }
  }, [open]);

  // Load diagram XML when modal opens
  useEffect(() => {
    if (!open || !procInstId) {
      setDiagramData(null);
      setError(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    fetchBpmnDiagram(procInstId)
      .then((data) => {
        if (!isMounted) return;
        setDiagramData(data);
      })
      .catch((err: any) => {
        if (!isMounted) return;
        console.error('[BpmnDiagramModal] Error fetching BPMN diagram:', err);
        setError(err?.message || 'Failed to load BPMN diagram.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [open, procInstId]);

  // Disable pull-to-refresh when BPMN diagram modal OR assignee drawer is active
  useEffect(() => {
    const shouldDisable = open || !!selectedTask;
    if (superApp && typeof (superApp as any).setPullToRefreshEnabled === 'function') {
      (superApp as any).setPullToRefreshEnabled(!shouldDisable);
    }
    return () => {
      if (superApp && typeof (superApp as any).setPullToRefreshEnabled === 'function') {
        (superApp as any).setPullToRefreshEnabled(true);
      }
    };
  }, [open, selectedTask, superApp]);

  // Initialize and import XML into bpmn-js viewer
  useEffect(() => {
    if (!open || !containerRef.current || !diagramData?.bpmn20Xml) return;

    if (viewerRef.current) {
      try {
        viewerRef.current.destroy();
      } catch (e) {
        // ignore
      }
      viewerRef.current = null;
    }

    const container = containerRef.current;
    container.innerHTML = '';

    const viewer = new NavigatedViewer({
      container,
    });
    viewerRef.current = viewer;

    viewer
      .importXML(diagramData.bpmn20Xml)
      .then(() => {
        const canvas = viewer.get('canvas') as any;
        const elementRegistry = viewer.get('elementRegistry') as any;
        const eventBus = viewer.get('eventBus') as any;

        // Auto zoom fit viewport
        canvas.zoom('fit-viewport');

        // Color coding rules:
        // isActive === true  -> Light Green (.bpmn-highlight-active)
        // isActive === false -> Light Gray  (.bpmn-highlight-inactive)
        if (diagramData.taskList && Array.isArray(diagramData.taskList)) {
          diagramData.taskList.forEach((taskItem) => {
            if (!taskItem.taskDefKey) return;
            const element = elementRegistry.get(taskItem.taskDefKey);
            if (element) {
              if (taskItem.isActive) {
                canvas.addMarker(taskItem.taskDefKey, 'bpmn-highlight-active');
              } else {
                canvas.addMarker(taskItem.taskDefKey, 'bpmn-highlight-inactive');
              }
            }
          });
        }

        // Element click handler to fetch User Destination List
        eventBus.on('element.click', (event: any) => {
          const element = event.element;
          if (!element || !diagramData.taskList) return;

          const elementId = element.id;
          const matchedTask = diagramData.taskList.find(
            (tItem) => tItem.taskDefKey === elementId || tItem.taskId === elementId
          );

          if (matchedTask) {
            const displayName =
              element.businessObject?.name || matchedTask.taskDefKey || 'Task Details';

            handleTaskNodeClick({
              taskId: matchedTask.taskId,
              taskDefKey: matchedTask.taskDefKey,
              taskName: displayName,
              isActive: matchedTask.isActive,
            });
          }
        });
      })
      .catch((err: any) => {
        console.error('[BpmnDiagramModal] Error importing XML:', err);
        setError('Failed to render BPMN diagram XML.');
      });

    return () => {
      if (viewerRef.current) {
        try {
          viewerRef.current.destroy();
        } catch (e) {
          // ignore
        }
        viewerRef.current = null;
      }
    };
  }, [open, diagramData]);

  // Touch & Mouse Pinch/Pan Gesture Handlers with Unlimited ViewBox Translation
  useEffect(() => {
    const container = containerRef.current;
    if (!open || !container) return;

    let initialPinchDistance = 0;
    let initialZoom = 1;
    let isPinching = false;
    let isTouchPanning = false;
    let lastTouchX = 0;
    let lastTouchY = 0;

    let isMouseDown = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    const getDistance = (t1: Touch, t2: Touch) => {
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const getCenter = (t1: Touch, t2: Touch) => {
      const rect = container.getBoundingClientRect();
      return {
        x: (t1.clientX + t2.clientX) / 2 - rect.left,
        y: (t1.clientY + t2.clientY) / 2 - rect.top,
      };
    };

    // --- Touch Event Handlers ---
    const handleTouchStart = (e: TouchEvent) => {
      if (!viewerRef.current) return;
      const canvas = viewerRef.current.get('canvas') as any;

      if (e.touches.length === 2) {
        isPinching = true;
        isTouchPanning = false;
        initialPinchDistance = getDistance(e.touches[0], e.touches[1]);
        initialZoom = canvas.zoom();
      } else if (e.touches.length === 1) {
        isTouchPanning = true;
        isPinching = false;
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!viewerRef.current) return;
      const canvas = viewerRef.current.get('canvas') as any;

      if (isPinching && e.touches.length === 2 && initialPinchDistance > 0) {
        if (e.cancelable) e.preventDefault();
        const currentDistance = getDistance(e.touches[0], e.touches[1]);
        const factor = currentDistance / initialPinchDistance;
        const newZoom = Math.min(Math.max(initialZoom * factor, 0.1), 6);
        const center = getCenter(e.touches[0], e.touches[1]);
        canvas.zoom(newZoom, center);
      } else if (isTouchPanning && e.touches.length === 1) {
        if (e.cancelable) e.preventDefault();
        const dx = e.touches[0].clientX - lastTouchX;
        const dy = e.touches[0].clientY - lastTouchY;
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;

        // Unclamped viewBox translation allows 100% free panning anywhere in 2D space
        const vb = canvas.viewbox();
        const scale = vb.scale || 1;
        canvas.viewbox({
          x: vb.x - dx / scale,
          y: vb.y - dy / scale,
          width: vb.width,
          height: vb.height,
        });
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        isPinching = false;
      }
      if (e.touches.length === 0) {
        isTouchPanning = false;
      }
    };

    // --- Mouse Drag Handlers (Desktop / Trackpad) ---
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      isMouseDown = true;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isMouseDown || !viewerRef.current) return;
      const dx = e.clientX - lastMouseX;
      const dy = e.clientY - lastMouseY;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;

      const canvas = viewerRef.current.get('canvas') as any;
      const vb = canvas.viewbox();
      const scale = vb.scale || 1;
      canvas.viewbox({
        x: vb.x - dx / scale,
        y: vb.y - dy / scale,
        width: vb.width,
        height: vb.height,
      });
    };

    const handleMouseUp = () => {
      isMouseDown = false;
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('touchcancel', handleTouchEnd);

    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);

      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [open, diagramData]);

  // Handle clicking a task node
  const handleTaskNodeClick = (taskInfo: SelectedTaskState) => {
    setSelectedTask(taskInfo);
    setUserDestList(null);
    setDestListError(null);
    setDestListLoading(true);

    fetchTaskUserDestList(taskInfo.taskId)
      .then((data) => {
        setUserDestList(data || []);
      })
      .catch((err: any) => {
        console.error('[BpmnDiagramModal] Error fetching task user dest list:', err);
        setDestListError(err?.message || 'Failed to load task assignee list.');
      })
      .finally(() => {
        setDestListLoading(false);
      });
  };

  const handleZoomIn = () => {
    if (viewerRef.current) {
      viewerRef.current.get('canvas').zoom(viewerRef.current.get('canvas').zoom() * 1.25);
    }
  };

  const handleZoomOut = () => {
    if (viewerRef.current) {
      viewerRef.current.get('canvas').zoom(viewerRef.current.get('canvas').zoom() / 1.25);
    }
  };

  const handleResetZoom = () => {
    if (viewerRef.current) {
      viewerRef.current.get('canvas').zoom('fit-viewport');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-xs fade-in">
      {/* Modal Container */}
      <div className="bg-white w-full h-full sm:rounded-2xl sm:shadow-2xl sm:max-w-[950px] sm:h-[88vh] sm:max-h-[800px] flex flex-col overflow-hidden border border-gray-100 relative">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-150 flex items-center justify-between bg-gray-50/90 shrink-0 select-none">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#063E89]" />
            <h3 className="text-[14px] sm:text-[15px] font-bold text-gray-900 truncate">
              {title || t('workflow.view_diagram') || 'BPMN Diagram'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Legend / Status Hint Bar */}
        <div className="px-4 py-2 bg-gray-100/70 border-b border-gray-200/60 flex items-center gap-4 text-[11px] font-medium text-gray-600 overflow-x-auto shrink-0 select-none">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200" />
            <span>Active Task</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-gray-400 ring-2 ring-gray-200" />
            <span>Processed / Inactive Task</span>
          </div>
          <span className="text-gray-400 text-[10px] ml-auto hidden sm:inline">
            Pinch to zoom · Drag to pan · Tap a task node to view assignees
          </span>
        </div>

        {/* Diagram Body Area */}
        <div className="flex-1 relative bg-white overflow-hidden flex items-center justify-center">
          {loading && (
            <div className="flex flex-col items-center gap-2 text-gray-500 z-10">
              <Loader2 size={32} className="animate-spin text-[#063E89]" />
              <span className="text-[13px] font-medium">{t('global.loading') || 'Loading diagram...'}</span>
            </div>
          )}

          {error && !loading && (
            <div className="flex flex-col items-center gap-2 text-red-500 p-6 text-center z-10">
              <AlertCircle size={32} />
              <p className="text-[13px] font-semibold">{error}</p>
            </div>
          )}

          {/* BPMN Canvas Container with touch pinch-zoom support */}
          <div
            ref={containerRef}
            tabIndex={0}
            className={`w-full h-full touch-none select-none outline-none ${
              loading || error ? 'hidden' : 'block'
            }`}
          />

          {/* Floating Zoom Controls for Quick Touch / Mouse Navigation */}
          {!loading && !error && diagramData && (
            <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-white/90 backdrop-blur-sm p-1 rounded-xl shadow-md border border-gray-200/80 z-20">
              <button
                type="button"
                onClick={handleZoomIn}
                title="Zoom In"
                className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200 transition-colors cursor-pointer"
              >
                <ZoomIn size={18} />
              </button>
              <button
                type="button"
                onClick={handleZoomOut}
                title="Zoom Out"
                className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200 transition-colors cursor-pointer"
              >
                <ZoomOut size={18} />
              </button>
              <div className="w-[1px] h-4 bg-gray-200 mx-0.5" />
              <button
                type="button"
                onClick={handleResetZoom}
                title="Fit to Viewport"
                className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200 transition-colors cursor-pointer"
              >
                <Maximize2 size={18} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Task User Destination List Bottom Sheet */}
      <Drawer
        open={!!selectedTask}
        onOpenChange={(isOpen) => {
          if (!isOpen) setSelectedTask(null);
        }}
      >
        <DrawerContent className="max-w-[480px] mx-auto pb-6">
          <DrawerHeader className="text-left pb-2 border-b border-gray-100">
            <div className="flex items-center justify-between gap-2">
              <DrawerTitle className="text-[16px] font-bold text-gray-900 truncate">
                {selectedTask?.taskName}
              </DrawerTitle>
              {selectedTask && (
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                    selectedTask.isActive
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-gray-100 text-gray-700 border border-gray-300'
                  }`}
                >
                  {selectedTask.isActive ? 'Active Task' : 'Inactive Task'}
                </span>
              )}
            </div>
            <DrawerDescription className="text-[12px] text-gray-400">
              Task Assignees & Destination Logs
            </DrawerDescription>
          </DrawerHeader>

          <div className="p-4 flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
            {destListLoading ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-gray-400">
                <Loader2 size={24} className="animate-spin text-[#063E89]" />
                <span className="text-[12px] font-medium">Loading assignees...</span>
              </div>
            ) : destListError ? (
              <div className="p-4 rounded-xl bg-red-50 text-red-600 text-[12.5px] font-medium text-center">
                {destListError}
              </div>
            ) : !userDestList || userDestList.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-[13px]">
                <User size={32} className="mx-auto text-gray-300 mb-2" />
                No assignees recorded for this task yet.
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {userDestList.map((userItem, idx) => {
                  const fullName = `${userItem.firstName || ''} ${userItem.lastName || ''}`.trim() || userItem.userId;
                  const initials = `${(userItem.firstName || '')[0] || ''}${(userItem.lastName || '')[0] || ''}`.toUpperCase() || 'U';

                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-gray-50 border border-gray-200/80 flex flex-col gap-2 transition-all hover:border-gray-300"
                    >
                      {/* Top User Info Row */}
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#063E89] text-white font-bold text-[13px] flex items-center justify-center shrink-0 shadow-xs">
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-[13.5px] font-bold text-gray-900 truncate">
                            {fullName}
                          </h4>
                          <p className="text-[11.5px] text-gray-500 font-medium truncate">
                            Emp No: <span className="text-gray-800 font-semibold">{userItem.empNo || '—'}</span> · User ID: <span className="text-gray-800 font-semibold">{userItem.userId || '—'}</span>
                          </p>
                        </div>
                      </div>

                      {/* Dates Timeline */}
                      <div className="pt-2 border-t border-gray-200/60 flex flex-col gap-1 text-[11.5px]">
                        <div className="flex items-center justify-between text-gray-600">
                          <span className="flex items-center gap-1 text-gray-400 font-medium">
                            <Clock size={12} />
                            Started:
                          </span>
                          <span className="font-semibold text-gray-800">
                            {formatDateTimeCompact(userItem.startedDate)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-gray-600">
                          <span className="flex items-center gap-1 text-gray-400 font-medium">
                            <CheckCircle2 size={12} />
                            Ended:
                          </span>
                          {userItem.endedDate ? (
                            <span className="font-semibold text-gray-800">
                              {formatDateTimeCompact(userItem.endedDate)}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              In Progress
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* BPMN Node Custom Styles */}
      <style>{`
        /* isActive: true -> Light Green */
        .bpmn-highlight-active .djs-visual > rect,
        .bpmn-highlight-active .djs-visual > polygon,
        .bpmn-highlight-active .djs-visual > circle {
          stroke: #16a34a !important;
          stroke-width: 2.5px !important;
          fill: #dcfce7 !important;
          cursor: pointer !important;
        }

        .bpmn-highlight-active .djs-visual > text {
          fill: #15803d !important;
          font-weight: 600 !important;
          cursor: pointer !important;
        }

        /* isActive: false -> Light Gray */
        .bpmn-highlight-inactive .djs-visual > rect,
        .bpmn-highlight-inactive .djs-visual > polygon,
        .bpmn-highlight-inactive .djs-visual > circle {
          stroke: #9ca3af !important;
          stroke-width: 2px !important;
          fill: #f3f4f6 !important;
          cursor: pointer !important;
        }

        .bpmn-highlight-inactive .djs-visual > text {
          fill: #4b5563 !important;
          font-weight: 500 !important;
          cursor: pointer !important;
        }

        .bjs-powered-by {
          bottom: 12px !important;
          right: 20px !important;
        }
      `}</style>
    </div>
  );
}
