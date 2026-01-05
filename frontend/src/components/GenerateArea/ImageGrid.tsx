import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { ImageCard } from './ImageCard';
import { useGenerateStore } from '../../store/generateStore';
import { GeneratedImage } from '../../types';

interface ImageGridProps {
  onPreview: (image: GeneratedImage) => void;
}

// 最大显示图片数量限制
const MAX_IMAGES = 100;

export function ImageGrid({ onPreview }: ImageGridProps) {
  const images = useGenerateStore((s) => s.images);
  const selectedIds = useGenerateStore((s) => s.selectedIds);
  const toggleSelect = useGenerateStore((s) => s.toggleSelect);
  const startTime = useGenerateStore(s => s.startTime);
  const status = useGenerateStore(s => s.status);

  // 统一的计时状态 - 所有卡片共享一个计时器
  const [elapsedTime, setElapsedTime] = useState('0.0');
  const rafRef = useRef<number | null>(null);

  // 使用 requestAnimationFrame 优化计时更新
  useEffect(() => {
    // 只在处理中且有开始时间时启动计时
    if (status !== 'processing' || !startTime) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    const updateTimer = () => {
      const seconds = ((Date.now() - startTime) / 1000).toFixed(1);
      setElapsedTime(seconds);

      // 只要有正在处理的图片，继续更新
      // 检查当前显示的图片中是否还有 pending 状态的
      const hasPendingImages = images.some(img => img.status === 'pending');
      if (hasPendingImages || status === 'processing') {
        rafRef.current = requestAnimationFrame(updateTimer);
      } else {
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(updateTimer);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [status, startTime, images]);

  // 限制最大显示数量，防止 DOM 爆炸
  const displayedImages = useMemo(() => {
    return images.slice(0, MAX_IMAGES);
  }, [images]);

  // 是否有超过限制的图片
  const hasOverflow = useMemo(() => {
    return images.length > MAX_IMAGES;
  }, [images.length]);

  const handlePreview = useCallback((image: GeneratedImage) => {
    onPreview(image);
  }, [onPreview]);

  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <div className="w-24 h-24 bg-gray-100 rounded-full mb-4 flex items-center justify-center">
          <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <p>暂无生成的图片，请在左侧配置并开始生成</p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 p-4 content-start">
        {displayedImages.map((img) => (
          <ImageCard
            key={img.id}
            image={img}
            selected={selectedIds.has(img.id)}
            onSelect={toggleSelect}
            onClick={handlePreview}
            elapsed={elapsedTime}
          />
        ))}
      </div>

      {/* 超过限制时的提示 */}
      {hasOverflow && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 m-6 mt-0">
          <p className="text-sm text-blue-800 text-center">
            显示前 {MAX_IMAGES} 张图片，共 {images.length} 张
            <span className="block text-xs text-blue-600 mt-1">
              提示：为获得最佳性能，建议分批生成或清理历史记录
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
