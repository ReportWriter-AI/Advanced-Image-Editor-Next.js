"use client";

import { useEffect, useRef, useState } from 'react';

interface ThreeSixtyViewerProps {
  imageUrl: string;
  alt?: string;
  width?: string;
  height?: string;
  autoLoad?: boolean;
  className?: string;
}

export default function ThreeSixtyViewer({
  imageUrl,
  alt = '360 Photo',
  width = '100%',
  height = '500px',
  autoLoad = true,
  className = ''
}: ThreeSixtyViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [viewer, setViewer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    let viewerInstance: any = null;

    const loadCSS = () => {
      // Check if CSS is already loaded
      const existingLink = document.querySelector('link[href*="photo-sphere-viewer"]');
      if (existingLink) return;

      // Create CSS link element
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/@photo-sphere-viewer/core@5.7.4/index.min.css';
      document.head.appendChild(link);
      console.log('🎨 Photo Sphere Viewer CSS loaded');
    };

    const initViewer = async () => {
      try {
        // Load CSS first
        loadCSS();
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (!viewerRef.current) {
          setError('Container not ready');
          setLoading(false);
          return;
        }

        console.log('🌐 Initializing Photo Sphere Viewer...');
        
        const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
        console.log('🔗 Using proxy URL:', proxyUrl);

        const { Viewer } = await import('@photo-sphere-viewer/core');
        console.log('📚 Photo Sphere Viewer library loaded');

        viewerInstance = new Viewer({
          container: viewerRef.current,
          panorama: proxyUrl,
          navbar: ['zoom', 'fullscreen'],
          defaultZoomLvl: 50,
        });

        viewerInstance.addEventListener('ready', () => {
          console.log('🎉 360° viewer loaded successfully!');
          setLoading(false);
          setViewer(viewerInstance);
        });

        viewerInstance.addEventListener('error', (err: any) => {
          console.error('❌ Photo Sphere Viewer error:', err);
          setError('Failed to load 360 photo');
          setLoading(false);
        });

      } catch (err) {
        console.error('💥 Error initializing viewer:', err);
        setError('Failed to initialize 360° viewer');
        setLoading(false);
      }
    };

    if (autoLoad) {
      initViewer();
    }

    return () => {
      if (viewerInstance) {
        try {
          viewerInstance.destroy();
        } catch (err) {
          console.error('Error destroying viewer:', err);
        }
      }
    };
  }, [imageUrl, autoLoad]);

  const resetView = () => {
    if (viewer) {
      viewer.animate({
        yaw: 0,
        pitch: 0,
        zoom: 50,
        speed: 1000,
      });
    }
  };

  return (
    <div 
      className={`threesixty-viewer-container ${className}`}
      style={{ 
        position: 'relative',
        width: '100%',
        maxWidth: width,
        height,
        borderRadius: '8px',
        overflow: 'hidden',
        backgroundColor: '#000',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
        margin: '0 auto',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: isMobile ? '6px' : '12px',
          left: isMobile ? '6px' : '12px',
          zIndex: 10,
          background: 'linear-gradient(135deg, rgba(75, 108, 183, 0.95) 0%, rgba(106, 17, 203, 0.95) 100%)',
          color: 'white',
          padding: isMobile ? '4px 8px' : '6px 12px',
          borderRadius: '6px',
          fontSize: isMobile ? '11px' : '13px',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? '4px' : '6px',
          pointerEvents: 'none'
        }}
      >
        <i className="fas fa-sync-alt" style={{ animation: 'spin 3s linear infinite' }}></i>
        {isMobile ? '360°' : '360 Photo'}
      </div>

      {!loading && !error && (
        <button
          onClick={resetView}
          style={{
            position: 'absolute',
            top: isMobile ? '6px' : '12px',
            right: isMobile ? '6px' : '12px',
            zIndex: 10,
            background: 'rgba(255, 255, 255, 0.9)',
            color: '#333',
            border: 'none',
            padding: isMobile ? '6px 8px' : '8px 12px',
            borderRadius: '6px',
            fontSize: isMobile ? '11px' : '13px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? '4px' : '6px',
          }}
          title="Reset to initial view"
        >
          <i className="fas fa-redo"></i>
          {!isMobile && <span>Reset View</span>}
        </button>
      )}

      {loading && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.8)',
            zIndex: 5,
            color: 'white'
          }}
        >
          <i className="fas fa-spinner fa-spin" style={{ fontSize: '32px', marginBottom: '16px' }}></i>
          <p style={{ margin: 0, fontSize: '14px' }}>Loading 360 Photo...</p>
        </div>
      )}

      {error && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.9)',
            zIndex: 5,
            color: 'white',
            padding: '20px'
          }}
        >
          <i className="fas fa-exclamation-triangle" style={{ fontSize: '32px', marginBottom: '16px', color: '#ff6b6b' }}></i>
          <p style={{ margin: 0, fontSize: '14px', textAlign: 'center' }}>{error}</p>
        </div>
      )}

      <div
        ref={viewerRef}
        style={{
          width: '100%',
          height: '100%',
        }}
      />

      {!loading && !error && (
        <div
          style={{
            position: 'absolute',
            bottom: isMobile ? '6px' : '12px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
            background: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: isMobile ? '6px 12px' : '8px 16px',
            borderRadius: '20px',
            fontSize: isMobile ? '9px' : '11px',
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? '6px' : '12px',
            pointerEvents: 'none',
            opacity: 0.8,
            flexWrap: 'wrap',
            justifyContent: 'center',
            maxWidth: isMobile ? '90%' : 'auto'
          }}
        >
          <span><i className="fas fa-hand-paper"></i> {isMobile ? 'Drag' : 'Drag to pan'}</span>
          <span><i className="fas fa-search-plus"></i> {isMobile ? 'Pinch' : 'Scroll to zoom'}</span>
          {!isMobile && <span><i className="fas fa-expand"></i> Fullscreen</span>}
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
