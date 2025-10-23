"use client";

import { useState } from 'react';
import styles from './DefectPhotoGrid.module.css';

interface Photo {
  url: string;
  location: string;
}

interface DefectPhotoGridProps {
  mainPhoto: string;
  mainLocation: string;
  additionalPhotos?: Photo[];
  onPhotoClick?: (url: string) => void;
}

export default function DefectPhotoGrid({ 
  mainPhoto, 
  mainLocation, 
  additionalPhotos = [],
  onPhotoClick 
}: DefectPhotoGridProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  
  const allPhotos = [
    { url: mainPhoto, location: mainLocation },
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

  // Layout logic based on photo count
  const renderGrid = () => {
    if (totalCount === 1) {
      // Single photo - full width
      return (
        <div className={styles.gridSingle}>
          <div className={styles.photoWrapper} onClick={() => handlePhotoClick(0)}>
            <img src={allPhotos[0].url} alt={allPhotos[0].location} className={styles.photo} />
            <div className={styles.locationLabel}>{allPhotos[0].location}</div>
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
              <img src={photo.url} alt={photo.location} className={styles.photo} />
              <div className={styles.locationLabel}>{photo.location}</div>
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
          <img src={allPhotos[0].url} alt={allPhotos[0].location} className={styles.photo} />
          <div className={styles.locationLabel}>{allPhotos[0].location}</div>
        </div>
        
        {/* Bottom row - 2 photos side by side */}
        <div className={styles.photoColumn}>
          <div className={styles.photoWrapper} onClick={() => handlePhotoClick(1)}>
            <img src={allPhotos[1].url} alt={allPhotos[1].location} className={styles.photo} />
            <div className={styles.locationLabel}>{allPhotos[1].location}</div>
          </div>
          
          {visibleCount > 2 && (
            <div className={styles.photoWrapperWithOverlay} onClick={() => handlePhotoClick(2)}>
              <img src={allPhotos[2].url} alt={allPhotos[2].location} className={styles.photo} />
              <div className={styles.locationLabel}>{allPhotos[2].location}</div>
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
            <img 
              src={allPhotos[lightboxIndex].url} 
              alt={allPhotos[lightboxIndex].location}
              className={styles.lightboxImage}
            />
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
