import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  className?: string;
  hideHeader?: boolean;
  variant?: 'default' | 'unstyled';
}

export function Modal({
  isOpen,
  onClose,
  children,
  title,
  className = '',
  hideHeader = false,
  variant = 'default'
}: ModalProps) {
  // 当弹窗打开时，禁止背景滚动
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 sm:p-6">
      {/* 全屏背景遮罩 - 增强通透感 */}
      <div 
        className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm animate-in fade-in duration-300" 
        onClick={onClose}
      />
      
      {/* 弹窗主体 - 样式与侧边栏对齐 */}
      <div 
        className={cn(
          'relative w-full flex flex-col animate-in fade-in zoom-in-95 duration-300',
          variant === 'default' &&
            'bg-white/80 backdrop-blur-2xl rounded-[2.5rem] border border-white/50 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.15)] max-h-[90vh]',
          className
        )}
      >
        {variant === 'default' && !hideHeader && (
            <div className="flex items-center justify-between px-10 py-8 border-b border-slate-200/20 flex-shrink-0">
                {title ? (
                    <h3 className="text-2xl font-black text-slate-900 tracking-tighter">
                        {title}
                    </h3>
                ) : <div />}
                <button
                    onClick={onClose}
                    className="p-3 bg-slate-200/30 hover:bg-white rounded-2xl transition-all text-slate-400 hover:text-slate-900 active:scale-90"
                >
                    <X className="w-6 h-6" />
                </button>
            </div>
        )}
        
        {/* 内容区域 - 确保可滚动且不被遮挡 */}
        {variant === 'default' ? (
          <div className={cn('flex-1 overflow-y-auto scrollbar-none', hideHeader ? '' : 'px-10 py-8 pb-12')}>
            {children}
          </div>
        ) : (
          children
        )}
      </div>
    </div>,
    document.body
  );
}
