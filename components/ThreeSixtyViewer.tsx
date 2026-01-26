"use client";

import { useEffect, useRef, useState } from 'react';

interface ThreeSixtyViewerProps {
  imageUrl: string;
  alt?: string;
  width?: string;
  height?: string;
  autoLoad?: boolean;
  className?: string;
  location?: string;
}

export default function ThreeSixtyViewer({
  imageUrl,
  alt = '360 Photo',
  width = '100%',
  height = '500px',
  autoLoad = true,
  className = '',
  location
}: ThreeSixtyViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
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
    let locationBarEl: HTMLDivElement | null = null;
    let fullscreenHandler: ((e: { fullscreenEnabled: boolean }) => void) | null = null;

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

    const removeLocationBar = () => {
      if (locationBarEl && locationBarEl.parentNode) {
        locationBarEl.parentNode.removeChild(locationBarEl);
        locationBarEl = null;
      }
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
        });

        viewerInstance.addEventListener('error', (err: any) => {
          console.error('❌ Photo Sphere Viewer error:', err);
          setError('Failed to load 360 photo');
          setLoading(false);
        });

        fullscreenHandler = (e: { fullscreenEnabled: boolean }) => {
          if (e.fullscreenEnabled && location?.trim()) {
            removeLocationBar();
            const bar = document.createElement('div');
            bar.setAttribute('data-psv-location-bar', 'true');
            Object.assign(bar.style, {
              position: 'absolute',
              bottom: '48px',
              left: '0',
              right: '0',
              zIndex: '100',
              background: 'rgba(0, 0, 0, 0.7)',
              color: 'white',
              padding: '8px 12px',
              fontSize: '14px',
              textAlign: 'center',
              pointerEvents: 'none',
            });
            bar.textContent = location.trim();
            viewerInstance.container.appendChild(bar);
            locationBarEl = bar;
          } else {
            removeLocationBar();
          }
        };
        viewerInstance.addEventListener('fullscreen', fullscreenHandler);

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
          if (fullscreenHandler) {
            viewerInstance.removeEventListener('fullscreen', fullscreenHandler);
          }
          removeLocationBar();
          viewerInstance.destroy();
        } catch (err) {
          console.error('Error destroying viewer:', err);
        }
      }
    };
  }, [imageUrl, autoLoad, location]);
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
        <i className="fas fa-sync-alt" style={{ animation: 'spin 3s linear infinite', fontSize: isMobile ? '18px' : '22px' }}></i>
        {/* {isMobile ? '360°' : '360 Photo'} */}
      </div>

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

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
