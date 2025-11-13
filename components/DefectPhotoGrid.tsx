"use client";

import { useState } from 'react';
import styles from './DefectPhotoGrid.module.css';
import dynamic from 'next/dynamic';

// Dynamic import to avoid SSR issues with the 360 viewer
const ThreeSixtyViewer = dynamic(() => import('./ThreeSixtyViewer'), {
  ssr: false,
  loading: () => (
    <div style={{ 
      width: '100%', 
      height: '100%', 
      minHeight: '160px',
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: '#000',
      borderRadius: '8px'
    }}>
      <i className="fas fa-spinner fa-spin" style={{ fontSize: '24px', color: 'white' }}></i>
    </div>
  )
});

interface Photo {
  url: string;
  location: string;
  isThreeSixty?: boolean;
}

interface DefectPhotoGridProps {
  mainPhoto: string;
  mainLocation: string;
  mainIsThreeSixty?: boolean;
  additionalPhotos?: Photo[];
  onPhotoClick?: (url: string) => void;
}

export default function DefectPhotoGrid({ 
  mainPhoto, 
  mainLocation, 
  mainIsThreeSixty = false,
  additionalPhotos = [],
  onPhotoClick 
}: DefectPhotoGridProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  
  const allPhotos = [
    { url: mainPhoto, location: mainLocation, isThreeSixty: mainIsThreeSixty },
    ...additionalPhotos
  ];
  
  const totalCount = allPhotos.length;
  const visibleCount = Math.min(totalCount, 3);
  const remainingCount = totalCount - visibleCount;

  const handlePhotoClick = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
    if (onPhotoClick) {
      onPhotoClick(allPhotos[index].url);
    }
  };

  const handleCloseLightbox = () => {
    setLightboxOpen(false);
  };

  const handleNextPhoto = () => {
    setLightboxIndex((prev) => (prev + 1) % totalCount);
  };

  const handlePrevPhoto = () => {
    setLightboxIndex((prev) => (prev - 1 + totalCount) % totalCount);
  };

  // Helper to render either a standard image or a 360 viewer
  const renderMedia = (photo: Photo) => {
    if (photo.isThreeSixty) {
      return (
        <>
          <div className={styles.photo} style={{ background: '#000', borderRadius: 8, overflow: 'hidden' }}>
            <ThreeSixtyViewer
              imageUrl={photo.url}
              alt={`360° view for ${photo.location}`}
              width="100%"
              height="100%"
            />
          </div>
          <div className={styles.locationLabel}>
            {photo.location}
            <span style={{ marginLeft: 8, fontWeight: 600 }}>360°</span>
          </div>
        </>
      );
    }
    return (
      <>
        <img src={photo.url} alt={photo.location} className={styles.photo} />
        <div className={styles.locationLabel}>{photo.location}</div>
      </>
    );
  };

  // Layout logic based on photo count
  const renderGrid = () => {
    if (totalCount === 1) {
      // Single photo - full width
      return (
        <div className={styles.gridSingle}>
          <div className={styles.photoWrapper} onClick={() => handlePhotoClick(0)}>
            {renderMedia(allPhotos[0])}
          </div>
        </div>
      );
    }

    if (totalCount === 2) {
      // Two photos - side by side
      return (
        <div className={styles.gridTwo}>
          {allPhotos.map((photo, idx) => (
            <div key={idx} className={styles.photoWrapper} onClick={() => handlePhotoClick(idx)}>
              {renderMedia(photo)}
            </div>
          ))}
        </div>
      );
    }

    // 3 or more photos - mobile-style grid layout
    // 1 large photo on top, 2 smaller photos below side-by-side
    return (
      <div className={styles.gridMultiple}>
        {/* First photo - takes full width at top */}
        <div className={styles.photoWrapperLarge} onClick={() => handlePhotoClick(0)}>
          {renderMedia(allPhotos[0])}
        </div>
        
        {/* Bottom row - 2 photos side by side */}
        <div className={styles.photoColumn}>
          <div className={styles.photoWrapper} onClick={() => handlePhotoClick(1)}>
            {renderMedia(allPhotos[1])}
          </div>
          
          {visibleCount > 2 && (
            <div className={styles.photoWrapperWithOverlay} onClick={() => handlePhotoClick(2)}>
              {renderMedia(allPhotos[2])}
              {remainingCount > 0 && (
                <div className={styles.overlay}>
                  <span className={styles.overlayText}>+{remainingCount}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className={styles.container}>
        {renderGrid()}
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <div className={styles.lightbox} onClick={handleCloseLightbox}>
          <button className={styles.closeBtn} onClick={handleCloseLightbox}>×</button>
          
          {totalCount > 1 && (
            <>
              <button 
                className={`${styles.navBtn} ${styles.prevBtn}`} 
                onClick={(e) => { e.stopPropagation(); handlePrevPhoto(); }}
              >
                ‹
              </button>
              <button 
                className={`${styles.navBtn} ${styles.nextBtn}`} 
                onClick={(e) => { e.stopPropagation(); handleNextPhoto(); }}
              >
                ›
              </button>
            </>
          )}
          
          <div className={styles.lightboxContent} onClick={(e) => e.stopPropagation()}>
            {allPhotos[lightboxIndex].isThreeSixty ? (
              <div style={{ width: '90vw', maxWidth: '1000px', height: '70vh', background: '#000', borderRadius: 8 }}>
                <ThreeSixtyViewer
                  imageUrl={allPhotos[lightboxIndex].url}
                  alt={`360° view for ${allPhotos[lightboxIndex].location}`}
                  width="100%"
                  height="100%"
                />
              </div>
            ) : (
              <img 
                src={allPhotos[lightboxIndex].url} 
                alt={allPhotos[lightboxIndex].location}
                className={styles.lightboxImage}
              />
            )}
            <div className={styles.lightboxLocation}>
              {allPhotos[lightboxIndex].location}
            </div>
            <div className={styles.lightboxCounter}>
              {lightboxIndex + 1} / {totalCount}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
