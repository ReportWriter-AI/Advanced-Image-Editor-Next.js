"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import styles from './ImageEditor.module.css';

// Use in JSX:
<div className={styles.cameraFullscreen}></div>

interface Point {
  x: number;
  y: number;
}

interface Line {
  points: Point[];
  color: string;
  size: number;
  type: 'draw' | 'arrow' | 'circle' | 'square';
  id: number;
  rotation?: number;
  scale?: number;
  center?: Point;
  radius?: number; // Keep for backward compatibility
  width?: number;
  height?: number;
}

interface CropAction {
  type: 'crop';
  previousImage: HTMLImageElement;
  previousLines: Line[];
  previousActionHistory: any[];
  cropFrame: CropFrame;
  id: number;
}

interface RotateAction {
  type: 'rotate';
  previousRotation: number;
  newRotation: number;
  id: number;
}

type Action = Line | CropAction | RotateAction;

interface CropFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ImageEditorProps {
  activeMode: 'none' | 'crop' | 'arrow' | 'circle' | 'square';
  onCropStateChange: (hasFrame: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
  onImageChange?: (img: HTMLImageElement | null) => void;
  onEditedFile?: (file: File | null) => void;
  videoRef?: React.RefObject<HTMLVideoElement>;
  setIsCameraOpen: (val: boolean) => void;
  isCameraOpen: boolean;
  setVideoFile: (file: File | null) => void;
  setVideoSrc: (src: string | null) => void;
  setThumbnail: (thumb: string | null) => void;
  preloadedImage?: HTMLImageElement | null; // New prop for preloaded images
  preloadedFile?: File | null; // New prop for preloaded file
}

const ImageEditor: React.FC<ImageEditorProps> = ({ 
  activeMode, 
  onCropStateChange, 
  onUndo, 
  onRedo,
  onImageChange, 
  onEditedFile,
  videoRef,
  setIsCameraOpen,
  isCameraOpen,
  setVideoFile,
  setVideoSrc,
  setThumbnail,
  preloadedImage,
  preloadedFile
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraCanvasRef = useRef<HTMLCanvasElement>(null);
  // const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageRotation, setImageRotation] = useState(0); // Track image rotation in degrees
  const [lines, setLines] = useState<Line[]>([]);
  const [currentLine, setCurrentLine] = useState<Point[] | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingColor, setDrawingColor] = useState('#d63636');
  const [synchronizedColor, setSynchronizedColor] = useState('#d63636'); // Global synchronized color
  const [brushSize, setBrushSize] = useState(3);
  const [currentArrowSize, setCurrentArrowSize] = useState(3);
  
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cropFrame, setCropFrame] = useState<CropFrame | null>(null);
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const [dragCropOffset, setDragCropOffset] = useState({ x: 0, y: 0 });
  const [resizingCropHandle, setResizingCropHandle] = useState<string | null>(null);

  const [selectedArrowId, setSelectedArrowId] = useState<number | null>(null);
  const [hoveredArrowId, setHoveredArrowId] = useState<number | null>(null);
  const [isDraggingArrow, setIsDraggingArrow] = useState(false);
  const [isRotatingArrow, setIsRotatingArrow] = useState(false);
  const [isResizingArrow, setIsResizingArrow] = useState(false);
  const [dragArrowOffset, setDragArrowOffset] = useState({ x: 0, y: 0 });
  const [interactionMode, setInteractionMode] = useState<'move' | 'rotate' | 'resize' | null>(null);
  
  // Circle and square states
  const [circleColor, setCircleColor] = useState('#d63636');
  const [squareColor, setSquareColor] = useState('#d63636');
  const [isResizingShape, setIsResizingShape] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [initialShapeData, setInitialShapeData] = useState<any>(null);
  const [isMovingShape, setIsMovingShape] = useState(false);
  const [moveOffset, setMoveOffset] = useState({ x: 0, y: 0 });
  
  // Drag detection states
  const [dragStartPoint, setDragStartPoint] = useState<Point | null>(null);
  const [hasDragged, setHasDragged] = useState(false);
  const DRAG_THRESHOLD = 5; // Minimum pixels to move before considering it a drag

  const [touchStartAngle, setTouchStartAngle] = useState<number | null>(null);
  const [touchStartDistance, setTouchStartDistance] = useState<number | null>(null);
  const [touchStartArrowRotation, setTouchStartArrowRotation] = useState<number | null>(null);
  const [touchStartArrowScale, setTouchStartArrowScale] = useState<number | null>(null);
  const [isTwoFingerTouch, setIsTwoFingerTouch] = useState(false);
  const [rotationCenter, setRotationCenter] = useState<Point | null>(null);
  const [lastTapTime, setLastTapTime] = useState<number>(0);

  const [actionHistory, setActionHistory] = useState<Action[]>([]);
  const [redoHistory, setRedoHistory] = useState<Action[]>([]);
  const [lineIdCounter, setLineIdCounter] = useState(0);
  const [isCameraFullscreen, setIsCameraFullscreen] = useState(false);

  // Animation frame reference for smooth rotation
  const animationRef = useRef<number | null>(null);
  const [rotationVelocity, setRotationVelocity] = useState(0);
  const [lastRotationTime, setLastRotationTime] = useState<number | null>(null);

  const [image, setImage] = useState<HTMLImageElement | null>(null); // displayed image
  const [editedFile, setEditedFile] = useState<File | null>(null);   // original or processed file
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const cameraVideoRef = useRef<HTMLInputElement>(null); // for file input (video recording)
  const [videoSrc, setVideoSrc2] = useState<string | null>(null);

  const [videoFile, setVideoFile2] = useState<File | null>(null);
  const [thumbnail, setThumbnail2] = useState<string | null>(null);

  // Load preloaded image if provided
  useEffect(() => {
    console.log('🔍 preloadedImage useEffect triggered');
    console.log('  - preloadedImage exists:', !!preloadedImage);
    console.log('  - preloadedFile exists:', !!preloadedFile);
    console.log('  - current image state exists:', !!image);
    
    if (preloadedImage && preloadedFile) {
      console.log('📥 Setting preloaded image in ImageEditor');
      setImage(preloadedImage);
      setEditedFile(preloadedFile);
      if (onImageChange) {
        onImageChange(preloadedImage);
      }
      if (onEditedFile) {
        onEditedFile(preloadedFile);
      }
    } else if (!preloadedImage && image) {
      console.log('⚠️ preloadedImage became null/undefined but image state still exists - NOT clearing');
      // DON'T clear the image if preloadedImage becomes null
    }
  }, [preloadedImage, preloadedFile, onImageChange, onEditedFile]);




  


const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (file) {
    setEditedFile(file);  // ✅ keep reference to uploaded/taken file

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        setImage(img);

        const canvas = canvasRef.current;
        if (canvas) {
          const context = canvas.getContext('2d', { alpha: false });
          if (context) {
            canvas.width = img.width;
            canvas.height = img.height;

            // Enable high-quality image rendering
            context.imageSmoothingEnabled = true;
            context.imageSmoothingQuality = 'high';

            context.clearRect(0, 0, canvas.width, canvas.height);
            context.drawImage(img, 0, 0, canvas.width, canvas.height);

            // Reset editor states
            setLines([]);
            setCurrentLine(null);
            setCropFrame(null);
            setActionHistory([]);
            setRedoHistory([]);
            onCropStateChange(false);

            if (onImageChange) onImageChange(img);
          }
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }
};



const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  setEditedFile(file);
  if (onEditedFile) onEditedFile(file);

  // Check MIME type
  if (file.type.startsWith("image/")) {
    // 🖼 Image handling
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setLines([]);
      setCropFrame(null);
      onCropStateChange(false);
      if (onImageChange) onImageChange(img);
    };
    img.src = URL.createObjectURL(file);
  } 
  else if (file.type.startsWith("video/")) {
    // 🎥 Video handling
    const videoURL = URL.createObjectURL(file);
    setImage(null); // clear canvas image
    setLines([]);
    setCropFrame(null);
    onCropStateChange(false);

    setVideoSrc(videoURL);   // for <video> preview
    setVideoFile(file);      // store full video
    setVideoSrc2(videoURL);  // optional second preview
    setVideoFile2(file);     // optional second video

    // Capture the first frame as thumbnail
    const video = document.createElement("video");
    video.src = videoURL;
    video.crossOrigin = "anonymous"; // allow drawing to canvas

    // Wait for metadata (video dimensions)
    video.addEventListener("loadedmetadata", () => {
      video.currentTime = 0; // jump to first frame
    });

    // Once first frame is ready
    video.addEventListener("seeked", () => {
      // ✅ Canvas defined locally here
      const canvasEl = document.createElement("canvas");
      canvasEl.width = video.videoWidth;
      canvasEl.height = video.videoHeight;
      const ctx = canvasEl.getContext("2d");

      if (ctx) {
        ctx.drawImage(video, 0, 0, canvasEl.width, canvasEl.height);

        // Create thumbnail as base64
        const thumbnailDataUrl = canvasEl.toDataURL("image/png");

        setThumbnail(thumbnailDataUrl);   // store thumbnail
        setThumbnail2(thumbnailDataUrl);  // optional second
        console.log("Thumbnail captured:", thumbnailDataUrl);
      }
    });
  }

  // Reset so same file can be chosen again
  e.target.value = "";
};






  // Ultra-smooth arrow movement optimization
  const movementFrameRef = useRef<number | null>(null);
  const pendingMovementRef = useRef<{
    id: number;
    deltaX: number;
    deltaY: number;
  } | null>(null);
  const isMovingRef = useRef(false);
  const linesRef = useRef<Line[]>([]);
  
  // Keep linesRef in sync with lines state
  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);
  

  // Synchronized color event listeners for all tools
  useEffect(() => {
    const handleColorChange = (e: CustomEvent) => {
      const color = e.detail;
      setSynchronizedColor(color);
      setDrawingColor(color);
      setCircleColor(color);
      setSquareColor(color);
      console.log('Color synchronized across all tools:', color);
    };

    window.addEventListener('setArrowColor', handleColorChange as EventListener);
    window.addEventListener('setCircleColor', handleColorChange as EventListener);
    window.addEventListener('setSquareColor', handleColorChange as EventListener);
    
    return () => {
      window.removeEventListener('setArrowColor', handleColorChange as EventListener);
      window.removeEventListener('setCircleColor', handleColorChange as EventListener);
      window.removeEventListener('setSquareColor', handleColorChange as EventListener);
    };
  }, []);

  // Smooth rotation animation
  useEffect(() => {
    if (rotationVelocity !== 0 && selectedArrowId !== null) {
      const animateRotation = (timestamp: number) => {
        if (!lastRotationTime) {
          setLastRotationTime(timestamp);
        }
        
        const deltaTime = timestamp - (lastRotationTime || timestamp);
        const rotationDelta = rotationVelocity * (deltaTime / 1000);
        
        if (Math.abs(rotationDelta) > 0.001) {
          setLines(prev => prev.map(line => 
            line.id === selectedArrowId 
              ? {
                  ...line,
                  rotation: (line.rotation || 0) + rotationDelta,
                  points: line.points.map(point => {
                    const center = getArrowCenter(line);
                    return rotatePoint(point, center, rotationDelta);
                  })
                }
              : line
          ));
          
          // Apply friction to slow down rotation
          setRotationVelocity(prev => prev * 0.95);
          setLastRotationTime(timestamp);
          animationRef.current = requestAnimationFrame(animateRotation);
        } else {
          setRotationVelocity(0);
          setLastRotationTime(null);
        }
      };
      
      animationRef.current = requestAnimationFrame(animateRotation);
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [rotationVelocity, selectedArrowId, lastRotationTime]);

  // Ultra-smooth arrow movement with requestAnimationFrame
  useEffect(() => {
    const processMovement = () => {
      if (pendingMovementRef.current && isMovingRef.current) {
        // Use ref for ultra-fast updates without triggering re-renders
        const movement = pendingMovementRef.current;
        const newLines = [...linesRef.current];
        const lineIndex = newLines.findIndex(line => line.id === movement.id);
        if (lineIndex !== -1) {
          newLines[lineIndex] = {
            ...newLines[lineIndex],
            points: newLines[lineIndex].points.map(point => ({
              x: point.x + movement.deltaX,
              y: point.y + movement.deltaY
            }))
          };
          linesRef.current = newLines;
          setLines(newLines);
        }
        pendingMovementRef.current = null;
      }
      
      if (isMovingRef.current) {
        movementFrameRef.current = requestAnimationFrame(processMovement);
      }
    };
    
    if (isMovingRef.current) {
      movementFrameRef.current = requestAnimationFrame(processMovement);
    }
    
    return () => {
      if (movementFrameRef.current) {
        cancelAnimationFrame(movementFrameRef.current);
      }
    };
  }, [isMovingRef.current]);


  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    
    if (e.touches.length === 2) {
      setIsTwoFingerTouch(true);
      const touch1 = e.nativeEvent.touches[0];
      const touch2 = e.nativeEvent.touches[1];
      
      const angle = getAngle(touch1, touch2);
      const distance = getDistance(touch1, touch2);
      const center = getTouchCenter(touch1, touch2, rect);
      
      setTouchStartAngle(angle);
      setTouchStartDistance(distance);
      setRotationCenter(center);
      
      if (selectedArrowId !== null) {
        const selectedArrow = lines.find(line => line.id === selectedArrowId);
        if (selectedArrow) {
          setTouchStartArrowRotation(selectedArrow.rotation || 0);
          setTouchStartArrowScale(selectedArrow.scale || 1);
          setIsRotatingArrow(true);
        }
      }
    } else if (e.touches.length === 1) {
      const touch = e.touches[0];
      const mouseX = touch.clientX - rect.left;
      const mouseY = touch.clientY - rect.top;
      
      const currentTime = Date.now();
      const timeDiff = currentTime - lastTapTime;
      
      if (timeDiff < 300 && selectedArrowId !== null) {
        const clickedArrow = lines.find(line => 
          line.type === 'arrow' && isPointInArrow(line, { x: mouseX, y: mouseY })
        );
        
        if (clickedArrow) {
          const center = getArrowCenter(clickedArrow);
          const rotationAngle = Math.PI / 8; // Increased from 15 to 22.5 degrees for faster rotation
          
          setLines(prev => prev.map(line => 
            line.id === selectedArrowId 
              ? {
                  ...line,
                  rotation: (line.rotation || 0) + rotationAngle,
                  points: line.points.map(point => rotatePoint(point, center, rotationAngle))
                }
              : line
          ));
          setLastTapTime(0);
          return;
        }
      }
      
      setLastTapTime(currentTime);
  
      const mockEvent = {
        clientX: touch.clientX,
        clientY: touch.clientY,
        preventDefault: () => e.preventDefault(),
      } as unknown as React.MouseEvent<HTMLCanvasElement>;
      
      handleMouseDown(mockEvent);
    }
  };
  
  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    
    if (e.touches.length === 2 && isTwoFingerTouch && selectedArrowId !== null) {
      const touch1 = e.nativeEvent.touches[0];
      const touch2 = e.nativeEvent.touches[1];
      
      const currentAngle = getAngle(touch1, touch2);
      const currentDistance = getDistance(touch1, touch2);
      
      if (touchStartAngle !== null && touchStartDistance !== null && 
          touchStartArrowRotation !== null && touchStartArrowScale !== null && rotationCenter) {
        
        const angleDelta = currentAngle - touchStartAngle;
        const scaleDelta = currentDistance / touchStartDistance;
        
        // Increased rotation speed by 30% (from 0.5 to 0.65)
        setLines(prev => prev.map(line => 
          line.id === selectedArrowId 
            ? {
                ...line,
                rotation: touchStartArrowRotation + angleDelta * 1.0,
                scale: touchStartArrowScale * scaleDelta,
                points: line.points.map(point => {
                  const scaledPoint = scalePoint(point, rotationCenter, scaleDelta);
                  return rotatePoint(scaledPoint, rotationCenter, angleDelta * 1.0);
                })
              }
            : line
        ));
        
        // Calculate rotation velocity for smooth animation
        const deltaTime = 16; // Approximate frame time
        setRotationVelocity(angleDelta * 1.0 / deltaTime * 1000);
        
        setTouchStartAngle(currentAngle);
        setTouchStartDistance(currentDistance);
      }
    } else if (e.touches.length === 1) {
      const touch = e.touches[0];
      const mouseX = touch.clientX - rect.left;
      const mouseY = touch.clientY - rect.top;
  
      const mockEvent = {
        clientX: touch.clientX,
        clientY: touch.clientY,
        preventDefault: () => e.preventDefault(),
      } as unknown as React.MouseEvent<HTMLCanvasElement>;
      
      handleMouseMove(mockEvent);
    }
  };
  
  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    
    setIsTwoFingerTouch(false);
    setTouchStartAngle(null);
    setTouchStartDistance(null);
    setTouchStartArrowRotation(null);
    setTouchStartArrowScale(null);
    setRotationCenter(null);
    
    handleMouseUp();
    
    // const file = exportEditedFile();
    // onEditedFile?.(file);
  };

  const exportEditedFile = (): File | null => {
    if (!image) {
      console.warn('⚠️ exportEditedFile called but no image available');
      return null;
    }
    
    console.log('🎨 Exporting edited file with', lines.length, 'annotations');
    
    try {
      // Create a new canvas with the same dimensions as the display canvas
      const canvas = document.createElement('canvas');
      const displayCanvas = canvasRef.current;
      
      if (!displayCanvas) {
        console.error('❌ Display canvas not available');
        return null;
      }
      
      canvas.width = displayCanvas.width;
      canvas.height = displayCanvas.height;
      
      const ctx = canvas.getContext('2d', { 
        willReadFrequently: false,
        alpha: false // Better performance on mobile
      });
      
      if (!ctx) {
        console.error('❌ Could not get canvas context');
        return null;
      }

      // Enable high-quality image rendering
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // Clear the canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw the background
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw the image with the same scaling as the display canvas
      if (image) {
        // Apply rotation if needed
        if (imageRotation !== 0) {
          ctx.save();
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate((imageRotation * Math.PI) / 180);
          ctx.translate(-canvas.width / 2, -canvas.height / 2);
          
          // For rotated images, fill the entire canvas
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          
          ctx.restore();
        } else {
          // For non-rotated images, use aspect ratio fitting
          const imgAspect = image.width / image.height;
          const canvasAspect = canvas.width / canvas.height;
          
          let drawWidth, drawHeight, offsetX, offsetY;
          
          if (imgAspect > canvasAspect) {
            drawWidth = canvas.width;
            drawHeight = canvas.width / imgAspect;
            offsetX = 0;
            offsetY = (canvas.height - drawHeight) / 2;
          } else {
            drawHeight = canvas.height;
            drawWidth = canvas.height * imgAspect;
            offsetX = (canvas.width - drawWidth) / 2;
            offsetY = 0;
          }
          
          ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
        }
      }
      
      // Draw all lines with their current positions
      lines.forEach(line => {
        ctx.strokeStyle = line.color;
        ctx.lineWidth = line.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.fillStyle = line.color;
        
        if (line.type === 'draw') {
          ctx.beginPath();
          line.points.forEach((pt, i) => {
            if (i === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          });
          ctx.stroke();
        } else if (line.type === 'arrow' && line.points.length >= 2) {
          drawTransformedArrow(ctx, line);
        } else if (line.type === 'circle' && line.center && line.width !== undefined && line.height !== undefined) {
          drawCircle(ctx, line.center.x, line.center.y, line.width, line.height, line.color);
        } else if (line.type === 'square' && line.center && line.width !== undefined && line.height !== undefined) {
          drawSquare(ctx, line.center.x, line.center.y, line.width, line.height, line.color);
        }
      });
    
      // Use JPEG for better mobile compatibility and smaller file size
      const dataUrl = canvas.toDataURL("image/jpeg", 0.98);
      const byteString = atob(dataUrl.split(",")[1]);
      const mimeString = dataUrl.split(",")[0].split(":")[1].split(";")[0];
    
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
    
      const file = new File([ab], "edited.jpg", { type: mimeString });
      console.log('✅ Exported edited file:', file.size, 'bytes');
      return file;
    } catch (error) {
      console.error('❌ Error exporting edited file:', error);
      alert('Error creating edited image. Please try again.');
      return null;
    }
  };

  useEffect(() => {
    console.log('🎯 exportEditedFile useEffect triggered!');
    console.log('  - imageRotation:', imageRotation, '°');
    console.log('  - lines.length:', lines.length);
    console.log('  - has image:', !!image);
    console.log('  - has onEditedFile:', !!onEditedFile);
    
    try {
      const file = exportEditedFile();
      if (file && onEditedFile) {
        console.log('🔄 Updating edited file in parent component:', file.size, 'bytes');
        onEditedFile(file);
      } else {
        console.log('⚠️ exportEditedFile returned null or no onEditedFile callback');
      }
    } catch (error) {
      console.error('❌ Error in useEffect for exportEditedFile:', error);
    }
  }, [image, imageRotation, lines, onEditedFile]);

  const saveAction = (action: Action) => {
    setActionHistory(prev => [...prev, action]);
    setRedoHistory([]);
  };

  const handleUndo = () => {
    if (actionHistory.length === 0) return;
    
    const lastAction = actionHistory[actionHistory.length - 1];
    setRedoHistory(prev => [...prev, lastAction]);
    
    if (lastAction.type === 'crop') {
      setImage(lastAction.previousImage);
      setLines(lastAction.previousLines);
      setActionHistory(lastAction.previousActionHistory);
      onCropStateChange(false);
      if (onImageChange) onImageChange(lastAction.previousImage);
    } else {
      // Handle undo for drawing actions (arrow, circle, square)
      setLines(prev => prev.filter(line => line.id !== lastAction.id));
    }
    
    setActionHistory(prev => prev.slice(0, -1));
  };

  const handleRedo = () => {
    if (redoHistory.length === 0) return;
    
    const lastRedoAction = redoHistory[redoHistory.length - 1];
    
    if (lastRedoAction.type === 'crop') {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx && lastRedoAction.previousImage && lastRedoAction.cropFrame && canvasRef.current) {
        const imgAspect = lastRedoAction.previousImage.width / lastRedoAction.previousImage.height;
        const canvasWidth = canvasRef.current.width;
        const canvasHeight = canvasRef.current.height;
        const canvasAspect = canvasWidth / canvasHeight;
        
        let drawWidth, drawHeight, offsetX, offsetY;
        
        if (imgAspect > canvasAspect) {
          drawWidth = canvasWidth;
          drawHeight = canvasWidth / imgAspect;
          offsetX = 0;
          offsetY = (canvasHeight - drawHeight) / 2;
        } else {
          drawHeight = canvasHeight;
          drawWidth = canvasHeight * imgAspect;
          offsetX = (canvasWidth - drawWidth) / 2;
          offsetY = 0;
        }
        
        const scaleX = lastRedoAction.previousImage.width / drawWidth;
        const scaleY = lastRedoAction.previousImage.height / drawHeight;
        
        const cropX = (lastRedoAction.cropFrame.x - offsetX) * scaleX;
        const cropY = (lastRedoAction.cropFrame.y - offsetY) * scaleY;
        const cropW = lastRedoAction.cropFrame.w * scaleX;
        const cropH = lastRedoAction.cropFrame.h * scaleY;
        
        const finalCropX = Math.max(0, Math.min(cropX, lastRedoAction.previousImage.width));
        const finalCropY = Math.max(0, Math.min(cropY, lastRedoAction.previousImage.height));
        const finalCropW = Math.min(cropW, lastRedoAction.previousImage.width - finalCropX);
        const finalCropH = Math.min(cropH, lastRedoAction.previousImage.height - finalCropY);
        
        canvas.width = finalCropW;
        canvas.height = finalCropH;
        
        ctx.drawImage(
          lastRedoAction.previousImage,
          finalCropX, finalCropY, finalCropW, finalCropH,
          0, 0, finalCropW, finalCropH
        );
        
        const croppedImage = new Image();
        croppedImage.onload = () => {
          setImage(croppedImage);
          setCropFrame(null);
          setLines([]);
          onCropStateChange(false);
          if (onImageChange) onImageChange(croppedImage);
        };
        croppedImage.src = canvas.toDataURL();
      }
    } else if (lastRedoAction.type !== 'rotate') {
      // Handle redo for drawing actions (arrow, circle, square) only
      // Skip rotation actions (they should never be in redoHistory anymore)
      setLines(prev => [...prev, lastRedoAction as Line]);
    }
    
    setActionHistory(prev => [...prev, lastRedoAction]);
    setRedoHistory(prev => prev.slice(0, -1));
  };

  const applyCrop = () => {
    if (!cropFrame || !image || !canvasRef.current) return;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const canvasWidth = canvasRef.current.width;
    const canvasHeight = canvasRef.current.height;
    
    const imgAspect = image.width / image.height;
    const canvasAspect = canvasWidth / canvasHeight;
    
    let drawWidth, drawHeight, offsetX, offsetY;
    
    if (imgAspect > canvasAspect) {
      drawWidth = canvasWidth;
      drawHeight = canvasWidth / imgAspect;
      offsetX = 0;
      offsetY = (canvasHeight - drawHeight) / 2;
    } else {
      drawHeight = canvasHeight;
      drawWidth = canvasHeight * imgAspect;
      offsetX = (canvasWidth - drawWidth) / 2;
      offsetY = 0;
    }
    
    const scaleX = image.width / drawWidth;
    const scaleY = image.height / drawHeight;
    
    const cropX = (cropFrame.x - offsetX) * scaleX;
    const cropY = (cropFrame.y - offsetY) * scaleY;
    const cropW = cropFrame.w * scaleX;
    const cropH = cropFrame.h * scaleY;
    
    const finalCropX = Math.max(0, Math.min(cropX, image.width));
    const finalCropY = Math.max(0, Math.min(cropY, image.height));
    const finalCropW = Math.min(cropW, image.width - finalCropX);
    const finalCropH = Math.min(cropH, image.height - finalCropY);
    
    canvas.width = finalCropW;
    canvas.height = finalCropH;
    
    ctx.drawImage(
      image,
      finalCropX, finalCropY, finalCropW, finalCropH,
      0, 0, finalCropW, finalCropH
    );
    
    const croppedImage = new Image();
    croppedImage.onload = () => {
      const cropAction: CropAction = {
        type: 'crop',
        previousImage: image,
        previousLines: [...lines],
        previousActionHistory: [...actionHistory],
        cropFrame: cropFrame,
        id: lineIdCounter
      };
      
      setLineIdCounter(prev => prev + 1);
      setActionHistory(prev => [...prev, cropAction]);
      setRedoHistory([]);
      
      setImage(croppedImage);
      setCropFrame(null);
      setLines([]);
      onCropStateChange(false);

      const file = exportEditedFile();
      onEditedFile?.(file);
      onImageChange?.(croppedImage);
    };
    croppedImage.src = canvas.toDataURL();
  };

  const rotateImage = useCallback(() => {
    if (!image) {
      console.log('❌ rotateImage: No image to rotate');
      return;
    }
    
    const newRotation = (imageRotation + 90) % 360;
    console.log('🔄 rotateImage: Rotating from', imageRotation, '° to', newRotation, '°');
    console.log('🔄 rotateImage: Current lines count:', lines.length);
    
    // Rotation is now independent - NOT added to action history
    // This allows unlimited rotations without affecting undo/redo of annotations
    setImageRotation(newRotation);
    console.log('✅ rotateImage: setImageRotation called with', newRotation, '°');
  }, [image, imageRotation, lines.length]);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      
      img.onload = () => {
        setImage(img);
        setLines([]);
        setCurrentLine(null);
        setCropFrame(null);
        setActionHistory([]);
        setRedoHistory([]);
        onCropStateChange(false);
      };
      img.src = event.target?.result as string;
      onImageChange?.(img);
    };
    reader.readAsDataURL(file);
  };

  const startCamera = async () => {
    try {
      setIsCameraFullscreen(true);      

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      
      if (videoRef?.current) {
        videoRef.current.srcObject = stream;
        setCameraStream(stream);
        setIsCameraOpen(true);
        
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(error => {
            console.error('Error playing video:', error);
          });
        };
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Unable to access camera. Please make sure you have granted camera permissions.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    if (videoRef?.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
    setIsCameraFullscreen(false);
  };

const captureImage = () => {
  if (videoRef?.current && cameraCanvasRef.current) {
    const video = videoRef.current;
    const canvas = cameraCanvasRef.current;
    const context = canvas.getContext("2d", { alpha: false });

    if (context && video.videoWidth > 0 && video.videoHeight > 0) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Enable high-quality image rendering
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';

      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const img = new Image();
      img.onload = () => {
        setImage(img);

        // Reset editor states
        setLines([]);
        setCurrentLine(null);
        setCropFrame(null);
        setActionHistory([]);
        setRedoHistory([]);
        onCropStateChange(false);

        if (onImageChange) onImageChange(img);

        // ✅ Create a File from canvas and save in editedFile
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], "captured-image.jpg", { type: "image/jpeg" });
            setEditedFile(file);
            if (onEditedFile) onEditedFile(file);
          }
        }, "image/jpeg", 0.98);

        stopCamera();
      };
      img.src = canvas.toDataURL("image/jpeg", 0.98);
    }
  }
};


  useEffect(() => {
    if (activeMode === 'crop' && !cropFrame) {
      setCropFrame(null);
      onCropStateChange(false);
    } else if (activeMode !== 'crop') {
      setCropFrame(null);
      onCropStateChange(false);
    }
  }, [activeMode, cropFrame, onCropStateChange]);

  useEffect(() => {
    const handleUndoAction = () => {
      handleUndo();
    };

    const handleRedoAction = () => {
      handleRedo();
    };

    const handleApplyCrop = () => {
      if (cropFrame) {
        applyCrop();
      }
    };

    const handleRotateImage = () => {
      rotateImage();
    };

    window.addEventListener('undoAction', handleUndoAction);
    window.addEventListener('redoAction', handleRedoAction);
    window.addEventListener('applyCrop', handleApplyCrop);
    window.addEventListener('rotateImage', handleRotateImage);

    return () => {
      window.removeEventListener('undoAction', handleUndoAction);
      window.removeEventListener('redoAction', handleRedoAction);
      window.removeEventListener('applyCrop', handleApplyCrop);
      window.removeEventListener('rotateImage', handleRotateImage);
    };
  }, [actionHistory, redoHistory, cropFrame, rotateImage]);

  const handleColorChange = (newColor: string) => {
    setDrawingColor(newColor);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Store the initial click point for drag detection
    setDragStartPoint({ x: mouseX, y: mouseY });
    setHasDragged(false);

    if (activeMode === 'crop') {
      if (cropFrame) {
        const handle = getHandles(cropFrame).find(
          (h) => Math.abs(h.x - mouseX) < 6 && Math.abs(h.y - mouseY) < 6
        );
        if (handle) {
          setResizingCropHandle(handle.name);
          return;
        }
        if (
          mouseX > cropFrame.x &&
          mouseX < cropFrame.x + cropFrame.w &&
          mouseY > cropFrame.y &&
          mouseY < cropFrame.y + cropFrame.h
        ) {
          setIsDraggingCrop(true);
          setDragCropOffset({ x: mouseX - cropFrame.x, y: mouseY - cropFrame.y });
          return;
        }
      }
      setCropFrame({ x: mouseX, y: mouseY, w: 0, h: 0 });
      setIsDrawing(true);
      return;
    } else if (activeMode === 'none') {
      // In none mode, allow interaction with any existing shape
      const clickedShape = lines.find(line => {
        if (line.type === 'arrow') {
          return isPointInArrow(line, { x: mouseX, y: mouseY }, 25);
        } else if (line.type === 'circle' && line.center && line.width !== undefined && line.height !== undefined) {
          const dx = (mouseX - line.center.x) / (line.width / 2);
          const dy = (mouseY - line.center.y) / (line.height / 2);
          const distance = dx * dx + dy * dy;
          return distance <= 1.2;
        } else if (line.type === 'square' && line.center && line.width !== undefined && line.height !== undefined) {
          const left = line.center.x - line.width / 2;
          const right = line.center.x + line.width / 2;
          const top = line.center.y - line.height / 2;
          const bottom = line.center.y + line.height / 2;
          return mouseX >= left && mouseX <= right && mouseY >= top && mouseY <= bottom;
        }
        return false;
      });
      
      if (clickedShape) {
        setSelectedArrowId(clickedShape.id);
        
        if (clickedShape.type === 'arrow') {
          setIsDraggingArrow(true);
          const center = getArrowCenter(clickedShape);
          setDragArrowOffset({ x: mouseX - center.x, y: mouseY - center.y });
          setInteractionMode('move');
        } else {
          // For circles and squares, just move them
          const center = clickedShape.center || clickedShape.points[0];
          setIsMovingShape(true);
          setMoveOffset({
            x: mouseX - center.x,
            y: mouseY - center.y
          });
        }
        return;
      } else {
        // Clicked on empty area - deselect any currently selected shape
        setSelectedArrowId(null);
        setInteractionMode(null);
        setIsDraggingArrow(false);
        setIsMovingShape(false);
        setIsResizingShape(false);
        setResizeHandle(null);
        setInitialShapeData(null);
        setMoveOffset({ x: 0, y: 0 });
        setDragArrowOffset({ x: 0, y: 0 });
        return;
      }
    } else if (activeMode === 'arrow') {
      // Check if clicking on an existing arrow with increased selection area
      const clickedArrow = lines.find(line => 
        line.type === 'arrow' && isPointInArrow(line, { x: mouseX, y: mouseY }, 25)
      );
      
      if (clickedArrow) {
        setSelectedArrowId(clickedArrow.id);
        setIsDraggingArrow(true);
        const center = getArrowCenter(clickedArrow);
        setDragArrowOffset({ x: mouseX - center.x, y: mouseY - center.y });
        setInteractionMode('move');
        return;
      } else {
        // Clicked on empty area - deselect any currently selected arrow and start drawing new one
        setSelectedArrowId(null);
        setInteractionMode(null);
        setIsDrawing(true);
        setCurrentLine([{ x: mouseX, y: mouseY }]);
        setCurrentArrowSize(3); // Reset arrow size when starting to draw
      }
    } else if (activeMode === 'circle' || activeMode === 'square') {
      // Check if clicking on an existing shape
      const clickedShape = lines.find(line => {
        if (line.type === 'circle' && line.center && line.width !== undefined && line.height !== undefined) {
          // Check if point is inside ellipse or within resize handle area
          const dx = (mouseX - line.center.x) / (line.width / 2);
          const dy = (mouseY - line.center.y) / (line.height / 2);
          const distance = dx * dx + dy * dy;
          
          // Include resize handle area (extend the selection area)
          const handleArea = 15; // Extra area around the shape for handles
          const extendedWidth = line.width + handleArea;
          const extendedHeight = line.height + handleArea;
          const extendedDx = (mouseX - line.center.x) / (extendedWidth / 2);
          const extendedDy = (mouseY - line.center.y) / (extendedHeight / 2);
          const extendedDistance = extendedDx * extendedDx + extendedDy * extendedDy;
          
          return distance <= 1.2 || extendedDistance <= 1.0; // Original shape or extended area
        } else if (line.type === 'square' && line.center && line.width !== undefined && line.height !== undefined) {
          const left = line.center.x - line.width / 2;
          const right = line.center.x + line.width / 2;
          const top = line.center.y - line.height / 2;
          const bottom = line.center.y + line.height / 2;
          return mouseX >= left - 15 && mouseX <= right + 15 && mouseY >= top - 15 && mouseY <= bottom + 15;
        }
        return false;
      });
      
      if (clickedShape) {
        setSelectedArrowId(clickedShape.id);
        
        // Check if clicking on a resize handle
        const center = clickedShape.center || clickedShape.points[0];
        const handleSize = 4; // Smaller for less intrusive mobile experience
        const tolerance = 20; // Wider tolerance for easier clicking on smaller handles
        
        if (clickedShape.type === 'circle' && clickedShape.width !== undefined && clickedShape.height !== undefined) {
          const handles = [
            { x: center.x, y: center.y - clickedShape.height/2 - 5, name: 'top' },
            { x: center.x + clickedShape.width/2 + 5, y: center.y, name: 'right' },
            { x: center.x, y: center.y + clickedShape.height/2 + 5, name: 'bottom' },
            { x: center.x - clickedShape.width/2 - 5, y: center.y, name: 'left' }
          ];
          
          const clickedHandle = handles.find(handle => 
            Math.abs(mouseX - handle.x) < tolerance && Math.abs(mouseY - handle.y) < tolerance
          );
          
          if (clickedHandle) {
            setIsResizingShape(true);
            setResizeHandle(clickedHandle.name);
            setInitialShapeData({
              center: center,
              width: clickedShape.width,
              height: clickedShape.height,
              id: clickedShape.id
            });
            return;
          }
        } else if (clickedShape.type === 'square' && clickedShape.width !== undefined && clickedShape.height !== undefined) {
          const handles = [
            { x: center.x - clickedShape.width/2 - 5, y: center.y - clickedShape.height/2 - 5, name: 'top-left' },
            { x: center.x + clickedShape.width/2 + 5, y: center.y - clickedShape.height/2 - 5, name: 'top-right' },
            { x: center.x + clickedShape.width/2 + 5, y: center.y + clickedShape.height/2 + 5, name: 'bottom-right' },
            { x: center.x - clickedShape.width/2 - 5, y: center.y + clickedShape.height/2 + 5, name: 'bottom-left' },
            { x: center.x, y: center.y - clickedShape.height/2 - 5, name: 'top' },
            { x: center.x + clickedShape.width/2 + 5, y: center.y, name: 'right' },
            { x: center.x, y: center.y + clickedShape.height/2 + 5, name: 'bottom' },
            { x: center.x - clickedShape.width/2 - 5, y: center.y, name: 'left' }
          ];
          
          const clickedHandle = handles.find(handle => 
            Math.abs(mouseX - handle.x) < tolerance && Math.abs(mouseY - handle.y) < tolerance
          );
          
          if (clickedHandle) {
            setIsResizingShape(true);
            setResizeHandle(clickedHandle.name);
            setInitialShapeData({
              center: center,
              width: clickedShape.width,
              height: clickedShape.height,
              id: clickedShape.id
            });
            return;
          }
        }
        
        // If no resize handle was clicked, start moving the shape
        setIsMovingShape(true);
        setMoveOffset({
          x: mouseX - center.x,
          y: mouseY - center.y
        });
        return;
      }
      
      // Deselect any currently selected shape when clicking on empty space
      if (selectedArrowId !== null) {
        setSelectedArrowId(null);
        setIsResizingShape(false);
        setResizeHandle(null);
        setInitialShapeData(null);
        setIsMovingShape(false);
        setMoveOffset({ x: 0, y: 0 });
      }
      
      // Start drawing new shape only if not clicking on an existing shape
      setIsDrawing(true);
      setCurrentLine([{ x: mouseX, y: mouseY }]);
      return;
    }
  };

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    
    // Check if we've dragged enough to consider it a drag
    if (dragStartPoint && !hasDragged) {
      const distance = Math.sqrt(
        Math.pow(mouseX - dragStartPoint.x, 2) + Math.pow(mouseY - dragStartPoint.y, 2)
      );
      if (distance > DRAG_THRESHOLD) {
        setHasDragged(true);
      }
    }

    if (activeMode === 'crop' && cropFrame) {
      if (resizingCropHandle) {
        setCropFrame(prev => resizeObj(prev!, resizingCropHandle, mouseX, mouseY));
        return;
      }
      if (isDraggingCrop) {
        setCropFrame(prev => ({
          ...prev!,
          x: mouseX - dragCropOffset.x,
          y: mouseY - dragCropOffset.y,
        }));
        return;
      }
      if (isDrawing) {
        setCropFrame(prev => ({
          ...prev!,
          w: mouseX - prev!.x,
          h: mouseY - prev!.y,
        }));
        return;
      }
    } else if (activeMode === 'none') {
      // Handle shape interactions in none mode
      if (isDraggingArrow && selectedArrowId !== null) {
        const selectedArrow = lines.find(line => line.id === selectedArrowId);
        if (selectedArrow) {
          const center = getArrowCenter(selectedArrow);
          const distanceFromCenter = Math.sqrt(
            Math.pow(mouseX - center.x, 2) + Math.pow(mouseY - center.y, 2)
          );
          
          // Check if user is trying to rotate (cursor is far from center)
          if (distanceFromCenter > 40 && interactionMode === 'move') {
            setInteractionMode('rotate');
            setIsRotatingArrow(true);
            setIsDraggingArrow(false);
          }
          
          if (interactionMode === 'move') {
            const newCenter = { x: mouseX - dragArrowOffset.x, y: mouseY - dragArrowOffset.y };
            const oldCenter = getArrowCenter(selectedArrow);
            const deltaX = newCenter.x - oldCenter.x;
            const deltaY = newCenter.y - oldCenter.y;
            
            // Use ultra-smooth movement with requestAnimationFrame
            pendingMovementRef.current = {
              id: selectedArrowId,
              deltaX,
              deltaY
            };
            
            if (!isMovingRef.current) {
              isMovingRef.current = true;
            }
          } else if (interactionMode === 'rotate') {
            // Faster rotation with less easing for more responsive feel
            const angle = Math.atan2(mouseY - center.y, mouseX - center.x);
            const currentRotation = selectedArrow.rotation || 0;
            const rotationDelta = angle - currentRotation;
            
            // Reduced easing for faster rotation (from 0.3 to 0.5)
            const easedRotation = currentRotation + rotationDelta * 0.5;
            
            setLines(prev => prev.map(line => 
                line.id === selectedArrowId 
                  ? {
                      ...line,
                      rotation: easedRotation,
                      points: line.points.map(point => rotatePoint(point, center, easedRotation - currentRotation))
                    }
                  : line
            ));
          }
        }
        return;
      } else if (isMovingShape && selectedArrowId !== null) {
        // Handle shape moving in none mode
        const newCenterX = mouseX - moveOffset.x;
        const newCenterY = mouseY - moveOffset.y;
        
        setLines(prev => {
          const updatedLines = prev.map(line => {
            if (line.id === selectedArrowId) {
              if (line.type === 'circle') {
                return {
                  ...line,
                  center: { x: newCenterX, y: newCenterY },
                  points: [
                    { x: newCenterX - line.width! / 2, y: newCenterY - line.height! / 2 },
                    { x: newCenterX + line.width! / 2, y: newCenterY + line.height! / 2 }
                  ]
                };
              } else if (line.type === 'square') {
                return {
                  ...line,
                  center: { x: newCenterX, y: newCenterY },
                  points: [
                    { x: newCenterX - line.width! / 2, y: newCenterY - line.height! / 2 },
                    { x: newCenterX + line.width! / 2, y: newCenterY + line.height! / 2 }
                  ]
                };
              } else if (line.type === 'arrow') {
                // For arrows, update the points array with the new positions
                const oldCenter = getArrowCenter(line);
                const deltaX = newCenterX - oldCenter.x;
                const deltaY = newCenterY - oldCenter.y;
                
                return {
                  ...line,
                  points: line.points.map(point => ({
                    x: point.x + deltaX,
                    y: point.y + deltaY
                  }))
                };
              }
            }
            return line;
          });
          
          return updatedLines;
        });
        return;
      } else {
        // Check for hover effects on shapes in none mode
        const hoveredShape = lines.find(line => {
          if (line.type === 'arrow') {
            return isPointInArrow(line, { x: mouseX, y: mouseY }, 25);
          } else if (line.type === 'circle' && line.center && line.width !== undefined && line.height !== undefined) {
            const dx = (mouseX - line.center.x) / (line.width / 2);
            const dy = (mouseY - line.center.y) / (line.height / 2);
            const distance = dx * dx + dy * dy;
            return distance <= 1.2;
          } else if (line.type === 'square' && line.center && line.width !== undefined && line.height !== undefined) {
            const left = line.center.x - line.width / 2;
            const right = line.center.x + line.width / 2;
            const top = line.center.y - line.height / 2;
            const bottom = line.center.y + line.height / 2;
            return mouseX >= left && mouseX <= right && mouseY >= top && mouseY <= bottom;
          }
          return false;
        });
        setHoveredArrowId(hoveredShape ? hoveredShape.id : null);
      }
    } else if (activeMode === 'arrow') {
      if (isDraggingArrow && selectedArrowId !== null) {
        const selectedArrow = lines.find(line => line.id === selectedArrowId);
        if (selectedArrow) {
          const center = getArrowCenter(selectedArrow);
          const distanceFromCenter = Math.sqrt(
            Math.pow(mouseX - center.x, 2) + Math.pow(mouseY - center.y, 2)
          );
          
          // Check if user is trying to rotate (cursor is far from center)
          if (distanceFromCenter > 40 && interactionMode === 'move') {
            setInteractionMode('rotate');
            setIsRotatingArrow(true);
            setIsDraggingArrow(false);
          }
          
          if (interactionMode === 'move') {
            const newCenter = { x: mouseX - dragArrowOffset.x, y: mouseY - dragArrowOffset.y };
            const oldCenter = getArrowCenter(selectedArrow);
            const deltaX = newCenter.x - oldCenter.x;
            const deltaY = newCenter.y - oldCenter.y;
            
            // Use ultra-smooth movement with requestAnimationFrame
            pendingMovementRef.current = {
              id: selectedArrowId,
              deltaX,
              deltaY
            };
            
            if (!isMovingRef.current) {
              isMovingRef.current = true;
            }
          } else if (interactionMode === 'rotate') {
            // Faster rotation with less easing for more responsive feel
            const angle = Math.atan2(mouseY - center.y, mouseX - center.x);
            const currentRotation = selectedArrow.rotation || 0;
            const rotationDelta = angle - currentRotation;
            
            // Reduced easing for faster rotation (from 0.3 to 0.5)
            const easedRotation = currentRotation + rotationDelta * 0.5;
            
            setLines(prev => prev.map(line => 
                line.id === selectedArrowId 
                  ? {
                      ...line,
                      rotation: easedRotation,
                      points: line.points.map(point => rotatePoint(point, center, easedRotation - currentRotation))
                    }
                  : line
            ));
          }
        }
        return;
      }
      
      if (isDrawing) {
        setCurrentLine(prev => [...prev!, { x: mouseX, y: mouseY }]);
        
        // Calculate and update arrow size based on distance
        // In the handleMouseMove function, replace the size calculation:
// Calculate and update arrow size based on distance
if (currentLine && currentLine.length > 1) {
  const from = currentLine[0];
  const to = { x: mouseX, y: mouseY };
  const distance = Math.sqrt(Math.pow(to.x - from.x, 2) + Math.pow(to.y - from.y, 2));
  
  // Extremely subtle size increase (from 3 to 6 over the entire drawing area)
  const newSize = Math.min(0.1, Math.max(3, 3 + distance / 150));
  setCurrentArrowSize(newSize);
}
      } else {  
        // Check for hover effects on arrows with increased selection area
        const hoveredArrow = lines.find(line => 
          line.type === 'arrow' && isPointInArrow(line, { x: mouseX, y: mouseY }, 25)
        );
        setHoveredArrowId(hoveredArrow ? hoveredArrow.id : null);
      }
    } else if (isResizingShape && selectedArrowId !== null && initialShapeData) {
      // Handle shape resizing
      const center = initialShapeData.center;
      
      // Find the shape to determine its type
      const shape = lines.find(line => line.id === initialShapeData.id);
      
      if (shape?.type === 'circle' && initialShapeData.width !== undefined && initialShapeData.height !== undefined) {
        // Circle resizing
        let newWidth = initialShapeData.width;
        let newHeight = initialShapeData.height;
        
        // Calculate the distance from center to mouse
        const deltaX = mouseX - center.x;
        const deltaY = mouseY - center.y;
        
        switch (resizeHandle) {
          case 'top':
            // Only resize height
            newHeight = Math.max(20, 2 * Math.abs(deltaY));
            newWidth = initialShapeData.width; // Keep original width
            break;
          case 'right':
            // Only resize width
            newWidth = Math.max(20, 2 * Math.abs(deltaX));
            newHeight = initialShapeData.height; // Keep original height
            break;
          case 'bottom':
            // Only resize height
            newHeight = Math.max(20, 2 * Math.abs(deltaY));
            newWidth = initialShapeData.width; // Keep original width
            break;
          case 'left':
            // Only resize width
            newWidth = Math.max(20, 2 * Math.abs(deltaX));
            newHeight = initialShapeData.height; // Keep original height
            break;
        }
        
        setLines(prev => {
          const updatedLines = prev.map(line => 
            line.id === initialShapeData.id 
              ? { ...line, width: newWidth, height: newHeight }
              : line
          );
          
          
          return updatedLines;
        });
      } else if (shape?.type === 'square' && initialShapeData.width !== undefined && initialShapeData.height !== undefined) {
        // Square resizing
        let newWidth = initialShapeData.width;
        let newHeight = initialShapeData.height;
        
        switch (resizeHandle) {
          case 'top-left':
            newWidth = Math.max(20, center.x - mouseX + initialShapeData.width / 2);
            newHeight = Math.max(20, center.y - mouseY + initialShapeData.height / 2);
            break;
          case 'top-right':
            newWidth = Math.max(20, mouseX - center.x + initialShapeData.width / 2);
            newHeight = Math.max(20, center.y - mouseY + initialShapeData.height / 2);
            break;
          case 'bottom-right':
            newWidth = Math.max(20, mouseX - center.x + initialShapeData.width / 2);
            newHeight = Math.max(20, mouseY - center.y + initialShapeData.height / 2);
            break;
          case 'bottom-left':
            newWidth = Math.max(20, center.x - mouseX + initialShapeData.width / 2);
            newHeight = Math.max(20, mouseY - center.y + initialShapeData.height / 2);
            break;
          case 'top':
            newHeight = Math.max(20, center.y - mouseY + initialShapeData.height / 2);
            break;
          case 'right':
            newWidth = Math.max(20, mouseX - center.x + initialShapeData.width / 2);
            break;
          case 'bottom':
            newHeight = Math.max(20, mouseY - center.y + initialShapeData.height / 2);
            break;
          case 'left':
            newWidth = Math.max(20, center.x - mouseX + initialShapeData.width / 2);
            break;
        }
        
        setLines(prev => {
          const updatedLines = prev.map(line => 
            line.id === initialShapeData.id 
              ? { ...line, width: newWidth, height: newHeight }
              : line
          );
          
          
          return updatedLines;
        });
      }
      return;
    } else if (isMovingShape && selectedArrowId !== null) {
      // Handle shape moving
      const newCenterX = mouseX - moveOffset.x;
      const newCenterY = mouseY - moveOffset.y;
      
      setLines(prev => {
        const updatedLines = prev.map(line => {
          if (line.id === selectedArrowId) {
            if (line.type === 'circle') {
              return {
                ...line,
                center: { x: newCenterX, y: newCenterY },
                points: [
                  { x: newCenterX - line.width! / 2, y: newCenterY - line.height! / 2 },
                  { x: newCenterX + line.width! / 2, y: newCenterY + line.height! / 2 }
                ]
              };
            } else if (line.type === 'square') {
              return {
                ...line,
                center: { x: newCenterX, y: newCenterY },
                points: [
                  { x: newCenterX - line.width! / 2, y: newCenterY - line.height! / 2 },
                  { x: newCenterX + line.width! / 2, y: newCenterY + line.height! / 2 }
                ]
              };
            } else if (line.type === 'arrow') {
              // For arrows, update the points array with the new positions
              const oldCenter = getArrowCenter(line);
              const deltaX = newCenterX - oldCenter.x;
              const deltaY = newCenterY - oldCenter.y;
              
              return {
                ...line,
                points: line.points.map(point => ({
                  x: point.x + deltaX,
                  y: point.y + deltaY
                }))
              };
            }
          }
          return line;
        });
        
        
        return updatedLines;
      });
      return;
    } else if ((activeMode === 'circle' || activeMode === 'square') && isDrawing && currentLine && hasDragged) {
      // Update the current line with the new mouse position for real-time preview
      if (currentLine.length >= 1) {
        setCurrentLine([currentLine[0], { x: mouseX, y: mouseY }]);
      }
      return;
    } else if (activeMode === 'circle' || activeMode === 'square') {
      // Check for hover effects on shapes
      const hoveredShape = lines.find(line => {
        if (line.type === 'circle' && line.center && line.width !== undefined && line.height !== undefined) {
          // Check if point is inside ellipse or within resize handle area
          const dx = (mouseX - line.center.x) / (line.width / 2);
          const dy = (mouseY - line.center.y) / (line.height / 2);
          const distance = dx * dx + dy * dy;
          
          // Include resize handle area (extend the selection area)
          const handleArea = 15; // Extra area around the shape for handles
          const extendedWidth = line.width + handleArea;
          const extendedHeight = line.height + handleArea;
          const extendedDx = (mouseX - line.center.x) / (extendedWidth / 2);
          const extendedDy = (mouseY - line.center.y) / (extendedHeight / 2);
          const extendedDistance = extendedDx * extendedDx + extendedDy * extendedDy;
          
          return distance <= 1.2 || extendedDistance <= 1.0; // Original shape or extended area
        } else if (line.type === 'square' && line.center && line.width !== undefined && line.height !== undefined) {
          const left = line.center.x - line.width / 2;
          const right = line.center.x + line.width / 2;
          const top = line.center.y - line.height / 2;
          const bottom = line.center.y + line.height / 2;
          return mouseX >= left - 15 && mouseX <= right + 15 && mouseY >= top - 15 && mouseY <= bottom + 15;
        }
        return false;
      });
      setHoveredArrowId(hoveredShape ? hoveredShape.id : null);
    }
  }, [activeMode, cropFrame, resizingCropHandle, isDraggingCrop, dragCropOffset, isDrawing, selectedArrowId, lines, isDraggingArrow, interactionMode, dragArrowOffset, currentLine, currentArrowSize, hoveredArrowId, isResizingShape, initialShapeData, resizeHandle, isMovingShape, moveOffset, hasDragged, dragStartPoint, circleColor, squareColor]);

  const handleMouseUp = () => {
    if (activeMode === 'crop' && isDrawing && cropFrame) {
      if (cropFrame.w < 0) {
        setCropFrame(prev => ({
          ...prev!,
          x: prev!.x + prev!.w,
          w: Math.abs(prev!.w),
        }));
      }
      if (cropFrame.h < 0) {
        setCropFrame(prev => ({
          ...prev!,
          y: prev!.y + prev!.h,
          h: Math.abs(prev!.h),
        }));
      }
      setIsDrawing(false);
      onCropStateChange(true);
      return;
    }
    
    if (activeMode === 'arrow' && isDrawing && currentLine && currentLine.length > 1) {
      const lineType = 'arrow';
      const newLine: Line = {
        points: [...currentLine],
        color: drawingColor,
        size: currentArrowSize, // Use the dynamic size instead of brushSize
        type: lineType,
        id: lineIdCounter,
        rotation: 0,
        scale: 1,
        center: getArrowCenter({ points: currentLine, color: drawingColor, size: currentArrowSize, type: 'arrow', id: lineIdCounter })
      };
      
      setLineIdCounter(prev => prev + 1);
      setLines(prev => [...prev, newLine]);
      setSelectedArrowId(newLine.id);
      saveAction(newLine);
      setCurrentLine(null);
      const file = exportEditedFile();
      onEditedFile?.(file);
    } else if ((activeMode === 'circle' || activeMode === 'square') && isDrawing && currentLine && currentLine.length >= 2 && hasDragged) {
      const startPoint = currentLine[0];
      const endPoint = currentLine[1];
      const center = {
        x: (startPoint.x + endPoint.x) / 2,
        y: (startPoint.y + endPoint.y) / 2
      };
      
      let newLine: Line;
      
      if (activeMode === 'circle') {
        const width = Math.abs(endPoint.x - startPoint.x);
        const height = Math.abs(endPoint.y - startPoint.y);
        newLine = {
          points: [startPoint, endPoint],
          color: circleColor,
          size: 3,
          type: 'circle',
          id: lineIdCounter,
          center: center,
          width: width,
          height: height
        };
      } else { // square
        const width = Math.abs(endPoint.x - startPoint.x);
        const height = Math.abs(endPoint.y - startPoint.y);
        newLine = {
          points: [startPoint, endPoint],
          color: squareColor,
          size: 3,
          type: 'square',
          id: lineIdCounter,
          center: center,
          width: width,
          height: height
        };
      }
      
      setLineIdCounter(prev => prev + 1);
      setLines(prev => [...prev, newLine]);
      setSelectedArrowId(newLine.id);
      saveAction(newLine);
      setCurrentLine(null);
      const file = exportEditedFile();
      onEditedFile?.(file);
    }
    
    if (isResizingShape) {
      setIsResizingShape(false);
      setResizeHandle(null);
      setInitialShapeData(null);
    }
    
    if (isMovingShape) {
      // Save the final position to action history
      if (selectedArrowId !== null) {
        const movedShape = lines.find(line => line.id === selectedArrowId);
        if (movedShape) {
          saveAction(movedShape);
          // Update the exported file with the new position
          const file = exportEditedFile();
          onEditedFile?.(file);
        }
      }
      setIsMovingShape(false);
      setMoveOffset({ x: 0, y: 0 });
    }
    
    // Reset drag detection states
    setDragStartPoint(null);
    setHasDragged(false);
    
    setIsDrawing(false);
    setIsDraggingCrop(false);
    setResizingCropHandle(null);
    setIsDraggingArrow(false);
    setIsRotatingArrow(false);
    setIsResizingArrow(false);
    setInteractionMode(null);
    
    // Stop ultra-smooth movement
    isMovingRef.current = false;
    if (movementFrameRef.current) {
      cancelAnimationFrame(movementFrameRef.current);
      movementFrameRef.current = null;
    }
  };

  const getHandles = (obj: CropFrame) => {
    const { x, y, w, h } = obj;
    return [
      { name: "nw", x, y },
      { name: "n", x: x + w / 2, y },
      { name: "ne", x: x + w, y },
      { name: "e", x: x + w, y: y + h / 2 },
      { name: "se", x: x + w, y: y + h },
      { name: "s", x: x + w / 2, y: y + h },
      { name: "sw", x, y: y + h },
      { name: "w", x, y: y + h / 2 },
    ];
  };

  const resizeObj = (obj: CropFrame, handle: string, mx: number, my: number) => {
    let { x, y, w, h } = obj;
    switch (handle) {
      case "nw":
        w = w + (x - mx);
        h = h + (y - my);
        x = mx;
        y = my;
        break;
      case "n":
        h = h + (y - my);
        y = my;
        break;
      case "ne":
        w = mx - x;
        h = h + (y - my);
        y = my;
        break;
      case "e":
        w = mx - x;
        break;
      case "se":
        w = mx - x;
        h = my - y;
        break;
      case "s":
        h = my - y;
        break;
      case "sw":
        w = w + (x - mx);
        h = my - y;
        x = mx;
        break;
      case "w":
        w = w + (x - mx);
        x = mx;
        break;
    }
    return { ...obj, x, y, w, h };
  };

  const getArrowBounds = (line: Line) => {
    if (line.points.length < 2) return null;
    const from = line.points[0];
    const to = line.points[line.points.length - 1];
    const minX = Math.min(from.x, to.x);
    const maxX = Math.max(from.x, to.x);
    const minY = Math.min(from.y, to.y);
    const maxY = Math.max(from.y, to.y);
    return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
  };

  const getArrowCenter = (line: Line) => {
    if (line.points.length < 2) return { x: 0, y: 0 };
    const from = line.points[0];
    const to = line.points[line.points.length - 1];
    return {
      x: (from.x + to.x) / 2,
      y: (from.y + to.y) / 2
    };
  };

  // Updated to accept a tolerance parameter for larger selection area
  const isPointInArrow = (line: Line, point: Point, tolerance: number = 15) => {
    if (line.points.length < 2) return false;
    const from = line.points[0];
    const to = line.points[line.points.length - 1];
    
    // Calculate distance from point to line
    const A = point.x - from.x;
    const B = point.y - from.y;
    const C = to.x - from.x;
    const D = to.y - from.y;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;
    
    let xx, yy;
    if (param < 0) {
      xx = from.x;
      yy = from.y;
    } else if (param > 1) {
      xx = to.x;
      yy = to.y;
    } else {
      xx = from.x + param * C;
      yy = from.y + param * D;
    }
    
    const dx = point.x - xx;
    const dy = point.y - yy;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Use tolerance parameter for larger selection area
    const arrowThickness = Math.max(line.size * 4, 12);
    return distance <= arrowThickness + tolerance;
  };

  const getArrowHandles = (line: Line) => {
    const center = getArrowCenter(line);
    const handleSize = 8;
    const rotation = line.rotation || 0;
    
    return [
      { 
        name: 'move', 
        x: center.x, 
        y: center.y, 
        type: 'move' 
      },
      { 
        name: 'rotate', 
        x: center.x + 50 * Math.sin(rotation),
        y: center.y - 50 * Math.cos(rotation), 
        type: 'rotate' 
      },
      { 
        name: 'resize-start', 
        x: center.x - 40 * Math.cos(rotation),
        y: center.y - 40 * Math.sin(rotation), 
        type: 'resize' 
      },
      { 
        name: 'resize-end', 
        x: center.x + 40 * Math.cos(rotation),
        y: center.y + 40 * Math.sin(rotation), 
        type: 'resize' 
      }
    ];
  };

  const rotatePoint = (point: Point, center: Point, angle: number) => {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    return {
      x: center.x + dx * cos - dy * sin,
      y: center.y + dx * sin + dy * cos
    };
  };

  const scalePoint = (point: Point, center: Point, scale: number) => {
    return {
      x: center.x + (point.x - center.x) * scale,
      y: center.y + (point.y - center.y) * scale
    };
  };

  const getDistance = (touch1: Touch, touch2: Touch) => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getAngle = (touch1: Touch, touch2: Touch) => {
    return Math.atan2(touch2.clientY - touch1.clientY, touch2.clientX - touch1.clientX);
  };

  const getTouchCenter = (touch1: Touch, touch2: Touch, rect: DOMRect) => {
    return {
      x: ((touch1.clientX + touch2.clientX) / 2) - rect.left,
      y: ((touch1.clientY + touch2.clientY) / 2) - rect.top
    };
  };

const drawArrow = (
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  size: number
) => {
  // 1. Calculate distance between start and end
  const dx = toX - fromX;
  const dy = toY - fromY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // 2. Scale thickness and head size based on distance
  const arrowThickness = Math.max(size * 1, 2) + distance * 0.05;
  const headlen = Math.max(arrowThickness * 1.0, 0.1) + distance * 0.30;

  const angle = Math.atan2(dy, dx);

  ctx.strokeStyle = drawingColor;
  ctx.fillStyle = drawingColor;
  ctx.setLineDash([]);

  // Shaft (tapered)
  const tailRatio = 0.7;
  const shaftEndX = toX - headlen * tailRatio * Math.cos(angle);
  const shaftEndY = toY - headlen * tailRatio * Math.sin(angle);

  const minTailThickness = arrowThickness * 0.9; // thin at far end
  const maxTailThickness = arrowThickness * 1.2; // thicker near head

   // Shaft (tapered slightly: 85% → 100%)
  ctx.beginPath();
  // back (85%)
  ctx.moveTo(
    fromX - (minTailThickness / 2) * Math.sin(angle),
    fromY + (minTailThickness / 2) * Math.cos(angle)
  );
  ctx.lineTo(
    fromX + (minTailThickness / 2) * Math.sin(angle),
    fromY - (minTailThickness / 2) * Math.cos(angle)
  );
  // front (100%)
  ctx.lineTo(
    shaftEndX + (maxTailThickness / 2) * Math.sin(angle),
    shaftEndY - (maxTailThickness / 2) * Math.cos(angle)
  );
  ctx.lineTo(
    shaftEndX - (maxTailThickness / 2) * Math.sin(angle),
    shaftEndY + (maxTailThickness / 2) * Math.cos(angle)
  );
  ctx.closePath();
  ctx.fill();


  // Arrow head with curved back
  const leftX = toX - headlen * Math.cos(angle - Math.PI / 8);
  const leftY = toY - headlen * Math.sin(angle - Math.PI / 8);
  const rightX = toX - headlen * Math.cos(angle + Math.PI / 8);
  const rightY = toY - headlen * Math.sin(angle + Math.PI / 8);

  ctx.beginPath();
  ctx.moveTo(toX, toY);       // tip
  ctx.lineTo(leftX, leftY);   // left side

  ctx.quadraticCurveTo(
    toX - headlen * 0.8 * Math.cos(angle), // control point
    toY - headlen * 0.8 * Math.sin(angle),
    rightX,
    rightY
  );

  ctx.closePath();
  ctx.fill();

  // Border for head
  ctx.strokeStyle = drawingColor;
  ctx.lineWidth = 1;
  ctx.stroke();
};

const drawCircle = (
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  color: string
) => {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.setLineDash([]);
  ctx.lineWidth = 3;
  
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, width / 2, height / 2, 0, 0, 2 * Math.PI);
  ctx.stroke();
};

const drawSquare = (
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  color: string
) => {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.setLineDash([]);
  ctx.lineWidth = 3;
  
  const left = centerX - width / 2;
  const top = centerY - height / 2;
  
  ctx.beginPath();
  ctx.rect(left, top, width, height);
  ctx.stroke();
};




  const drawTransformedArrow = (ctx: CanvasRenderingContext2D, line: Line) => {
    if (line.points.length < 2) return;
    
    const center = getArrowCenter(line);
    const rotation = line.rotation || 0;
    const scale = line.scale || 1;
    
    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.rotate(rotation);
    ctx.scale(scale, scale);
    ctx.translate(-center.x, -center.y);
    
    const from = line.points[0];
    const to = line.points[line.points.length - 1];
    drawArrow(ctx, from.x, from.y, to.x, to.y, line.size);
    
    ctx.restore();
  };

  // Draw everything on canvas
  useEffect(() => {
    console.log('🎨 Canvas render useEffect triggered!');
    console.log('  - imageRotation:', imageRotation, '°');
    console.log('  - lines.length:', lines.length);
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (image) {
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Apply rotation if needed
      if (imageRotation !== 0) {
        console.log('✅ Drawing rotated image at', imageRotation, '°');
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((imageRotation * Math.PI) / 180);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);
        
        // For rotated images, fill the entire canvas
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        
        ctx.restore();
      } else {
        // For non-rotated images, use aspect ratio fitting
        const imgAspect = image.width / image.height;
        const canvasAspect = canvas.width / canvas.height;
        
        let drawWidth, drawHeight, offsetX, offsetY;
        
        if (imgAspect > canvasAspect) {
          drawWidth = canvas.width;
          drawHeight = canvas.width / imgAspect;
          offsetX = 0;
          offsetY = (canvas.height - drawHeight) / 2;
        } else {
          drawHeight = canvas.height;
          drawWidth = canvas.height * imgAspect;
          offsetX = (canvas.width - drawWidth) / 2;
          offsetY = 0;
        }
        
        ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
      }
    } else {
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#666666';
      ctx.textAlign = 'center';
      ctx.font = '24px Arial';
      ctx.fillText('Upload Image here', canvas.width/2, canvas.height/2);
    }

    // Draw existing lines
    lines.forEach(line => {
      ctx.strokeStyle = line.color;
      ctx.lineWidth = line.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.fillStyle = line.color;
      
      if (line.type === 'draw') {
        ctx.beginPath();
        line.points.forEach((pt, i) => {
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();
      } else if (line.type === 'arrow' && line.points.length >= 2) {
        // Draw hover effect if this arrow is hovered
        if (hoveredArrowId === line.id && selectedArrowId !== line.id) {
          ctx.strokeStyle = line.color;
          ctx.lineWidth = line.size + 4;
          ctx.globalAlpha = 0.3;
          drawTransformedArrow(ctx, line);
          ctx.globalAlpha = 1.0;
        }
        
        // Draw the main arrow
        drawTransformedArrow(ctx, line);
        
        // Show subtle selection indicator
        if (selectedArrowId === line.id) {
          // Draw a subtle outline around the selected arrow
          ctx.strokeStyle = 'rgba(0, 123, 255, 0.5)';
          ctx.lineWidth = line.size + 2;
          ctx.globalAlpha = 0.3;
          drawTransformedArrow(ctx, line);
          ctx.globalAlpha = 1.0;
          
          // Draw rotation guide circle
          const center = getArrowCenter(line);
          ctx.fillStyle = 'rgba(40, 167, 69, 0.3)';
          ctx.strokeStyle = '#28a745';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(center.x, center.y, 40, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
          
          // Draw rotation handle
          const rotation = line.rotation || 0;
          const handleX = center.x + 50 * Math.sin(rotation);
          const handleY = center.y - 50 * Math.cos(rotation);
          
          ctx.fillStyle = '#28a745';
          ctx.beginPath();
          ctx.arc(handleX, handleY, 8, 0, 2 * Math.PI);
          ctx.fill();
          
          // Draw rotation direction indicator
          ctx.fillStyle = 'white';
          ctx.font = '14px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('↻', handleX, handleY);
        }
      } else if (line.type === 'circle' && line.center && line.width !== undefined && line.height !== undefined) {
        // Draw hover effect if this circle is hovered
        if (hoveredArrowId === line.id && selectedArrowId !== line.id) {
          ctx.strokeStyle = line.color;
          ctx.lineWidth = line.size + 4;
          ctx.globalAlpha = 0.3;
          drawCircle(ctx, line.center.x, line.center.y, line.width || 0, line.height || 0, line.color);
          ctx.globalAlpha = 1.0;
        }
        
        // Draw the main circle
        drawCircle(ctx, line.center.x, line.center.y, line.width || 0, line.height || 0, line.color);
        
        // Show selection indicator
        if (selectedArrowId === line.id) {
          // Draw selection outline
          ctx.strokeStyle = 'rgba(0, 123, 255, 0.8)';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.ellipse(line.center.x, line.center.y, line.width / 2, line.height / 2, 0, 0, 2 * Math.PI);
          ctx.stroke();
          ctx.setLineDash([]);
          
          // Draw resize handles (4 edge handles only)
          const handles = [
            { x: line.center.x, y: line.center.y - line.height/2 - 5, name: 'top' },
            { x: line.center.x + line.width/2 + 5, y: line.center.y, name: 'right' },
            { x: line.center.x, y: line.center.y + line.height/2 + 5, name: 'bottom' },
            { x: line.center.x - line.width/2 - 5, y: line.center.y, name: 'left' }
          ];
          
          // Draw professional resize handles
          handles.forEach((h, index) => {
            // All handles are edge handles now
            const handleSize = 4; // Smaller, less intrusive handles
            
            // Outer ring
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.beginPath();
            ctx.arc(h.x, h.y, handleSize + 2, 0, 2 * Math.PI);
            ctx.fill();
            
            // Inner handle
            ctx.fillStyle = 'rgba(0, 123, 255, 0.9)';
            ctx.beginPath();
            ctx.arc(h.x, h.y, handleSize, 0, 2 * Math.PI);
            ctx.fill();
            
            // Border for better visibility
            ctx.strokeStyle = 'rgba(0, 123, 255, 1)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(h.x, h.y, handleSize, 0, 2 * Math.PI);
            ctx.stroke();
          });
        }
      } else if (line.type === 'square' && line.center && line.width !== undefined && line.height !== undefined) {
        // Draw hover effect if this square is hovered
        if (hoveredArrowId === line.id && selectedArrowId !== line.id) {
          ctx.strokeStyle = line.color;
          ctx.lineWidth = line.size + 4;
          ctx.globalAlpha = 0.3;
          drawSquare(ctx, line.center.x, line.center.y, line.width, line.height, line.color);
          ctx.globalAlpha = 1.0;
        }
        
        // Draw the main square
        drawSquare(ctx, line.center.x, line.center.y, line.width, line.height, line.color);
        
        // Show selection indicator
        if (selectedArrowId === line.id) {
          // Draw selection outline
          ctx.strokeStyle = 'rgba(0, 123, 255, 0.8)';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          const left = line.center.x - line.width / 2;
          const top = line.center.y - line.height / 2;
          ctx.strokeRect(left, top, line.width, line.height);
          ctx.setLineDash([]);
          
          // Draw resize handles
          const handles = [
            { x: line.center.x - line.width/2 - 5, y: line.center.y - line.height/2 - 5, name: 'top-left' },
            { x: line.center.x + line.width/2 + 5, y: line.center.y - line.height/2 - 5, name: 'top-right' },
            { x: line.center.x + line.width/2 + 5, y: line.center.y + line.height/2 + 5, name: 'bottom-right' },
            { x: line.center.x - line.width/2 - 5, y: line.center.y + line.height/2 + 5, name: 'bottom-left' },
            { x: line.center.x, y: line.center.y - line.height/2 - 5, name: 'top' },
            { x: line.center.x + line.width/2 + 5, y: line.center.y, name: 'right' },
            { x: line.center.x, y: line.center.y + line.height/2 + 5, name: 'bottom' },
            { x: line.center.x - line.width/2 - 5, y: line.center.y, name: 'left' }
          ];
          
          // Draw professional resize handles for squares
          handles.forEach((h, index) => {
            // Different styling for corner vs edge handles
            const isCorner = ['top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(h.name);
            const handleSize = isCorner ? 5 : 4; // Smaller, less intrusive handles
            
            // Outer ring
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.beginPath();
            ctx.arc(h.x, h.y, handleSize + 2, 0, 2 * Math.PI);
            ctx.fill();
            
            // Inner handle
            ctx.fillStyle = 'rgba(0, 123, 255, 0.9)';
            ctx.beginPath();
            ctx.arc(h.x, h.y, handleSize, 0, 2 * Math.PI);
            ctx.fill();
            
            // Border for better visibility
            ctx.strokeStyle = 'rgba(0, 123, 255, 1)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(h.x, h.y, handleSize, 0, 2 * Math.PI);
            ctx.stroke();
          });
        }
      }
    });

    // Draw current line if drawing
    if (isDrawing && currentLine && currentLine.length > 0) {
      ctx.strokeStyle = drawingColor;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.fillStyle = drawingColor;
      
      if (activeMode === 'arrow' && currentLine.length >= 2) {
        const from = currentLine[0];
        const to = currentLine[currentLine.length - 1];
        
        // Use the currentArrowSize for drawing
        drawArrow(ctx, from.x, from.y, to.x, to.y, currentArrowSize);
      } else if (activeMode === 'circle' && currentLine.length >= 2 && hasDragged) {
        const startPoint = currentLine[0];
        const endPoint = currentLine[1];
        const center = {
          x: (startPoint.x + endPoint.x) / 2,
          y: (startPoint.y + endPoint.y) / 2
        };
        const width = Math.abs(endPoint.x - startPoint.x);
        const height = Math.abs(endPoint.y - startPoint.y);
        drawCircle(ctx, center.x, center.y, width, height, circleColor);
      } else if (activeMode === 'square' && currentLine.length >= 2 && hasDragged) {
        const startPoint = currentLine[0];
        const endPoint = currentLine[1];
        const center = {
          x: (startPoint.x + endPoint.x) / 2,
          y: (startPoint.y + endPoint.y) / 2
        };
        const width = Math.abs(endPoint.x - startPoint.x);
        const height = Math.abs(endPoint.y - startPoint.y);
        drawSquare(ctx, center.x, center.y, width, height, squareColor);
      } else {
        ctx.beginPath();
        currentLine.forEach((pt, i) => {
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();
      }
    }

    // Draw crop frame
    if (activeMode === 'crop' && cropFrame) {
      ctx.strokeStyle = '#FF0000';
      ctx.lineWidth = 2;
      ctx.strokeRect(cropFrame.x, cropFrame.y, cropFrame.w, cropFrame.h);

      const handles = getHandles(cropFrame);
      ctx.fillStyle = '#FF0000';
      handles.forEach((h) => {
        ctx.beginPath();
        ctx.arc(h.x, h.y, 6, 0, 2 * Math.PI);
        ctx.fill();
      });
    }
  }, [image, imageRotation, lines, currentLine, isDrawing, drawingColor, brushSize, activeMode, cropFrame, selectedArrowId, hoveredArrowId, currentArrowSize, circleColor, squareColor, hasDragged]);

  const getCursor = () => {
    if (isMovingShape) {
      return 'grabbing';
    } else if (isResizingShape) {
      // Different cursors for different resize handles
      switch (resizeHandle) {
        case 'top':
        case 'bottom':
          return 'ns-resize';
        case 'left':
        case 'right':
          return 'ew-resize';
        default:
          return 'ns-resize';
      }
    } else if (activeMode === 'crop' || activeMode === 'circle' || activeMode === 'square') {
      return 'crosshair';
    } else if (activeMode === 'arrow') {
      if (interactionMode === 'move') return 'grabbing';
      if (interactionMode === 'rotate') return 'grab';
      if (hoveredArrowId !== null) return 'pointer';
      return 'default';
    } else if (activeMode === 'none') {
      // Show move cursor when hovering over shapes
      if (hoveredArrowId !== null) {
        const hoveredShape = lines.find(line => line.id === hoveredArrowId);
        if (hoveredShape) {
          if (hoveredShape.type === 'arrow') {
            return 'pointer';
          } else if (hoveredShape.type === 'circle' || hoveredShape.type === 'square') {
            return 'grab';
          }
        }
      }
      return 'default';
    }
    return 'default';
  };

  return (
    <div className={styles.imageEditorSimple}>
      {/* Fullscreen Camera Overlay */}
      {isCameraFullscreen && (
      <div className={styles.cameraFullscreen}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={styles.cameraVideo}
        />

        <div className={styles.cameraControlsOverlay}>
          <button className={styles.captureBtnFullscreen} onClick={captureImage}>
            <div className={styles.captureCircle}></div>
          </button>
          <button className={styles.closeCameraBtn} onClick={stopCamera}>
            <i className="fas fa-times"></i>
          </button>
        </div>
      </div>
    )}




  {/* Main Content */}
<div className={styles.uploadContainer}>
  {!image && !videoSrc ? (
    <>
      <div className={styles.uploadInstructions}>
        Drag & drop your image or video here or click to browse
      </div>
      <div className={styles.buttonContainer}>
        <div className="button-group">
          <div
           style={{
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    justifyContent:
      typeof window !== "undefined" && window.innerWidth <= 600
        ? "center"
        : "flex-start",
    width: "100%",
  }}
          >
            {/* Choose Image */}
           <button
  onClick={() => fileInputRef.current?.click()}
  style={{
    backgroundColor: "#007bff",
    color: "white",
    border: "none",
    borderRadius: "6px",
    padding: "10px 16px",
    fontSize: "1rem",
    cursor: "pointer",
    transition: "background-color 0.2s ease",
  }}
  onMouseOver={(e) =>
    (e.currentTarget.style.backgroundColor = "#0056b3")
  }
  onMouseOut={(e) =>
    (e.currentTarget.style.backgroundColor = "#007bff")
  }
>
  Choose Image
</button>


            {/* Take Picture */}
          <button
  onClick={() => cameraInputRef.current?.click()}
  style={{
    backgroundColor: "#007bff",
    color: "white",
    border: "none",
    borderRadius: "6px",
    padding: "10px 16px",
    fontSize: "1rem",
    cursor: "pointer",
    transition: "background-color 0.2s ease",
  }}
  onMouseOver={(e) =>
    (e.currentTarget.style.backgroundColor = "#0056b3")
  }
  onMouseOut={(e) =>
    (e.currentTarget.style.backgroundColor = "#007bff")
  }
>
  Take a Picture
</button>


            {/* Record Video */}
           <button
  onClick={() => cameraVideoRef.current?.click()}
  style={{
    backgroundColor: "#007bff",
    color: "white",
    border: "none",
    borderRadius: "6px",
    padding: "10px 16px",
    fontSize: "1rem",
    cursor: "pointer",
    transition: "background-color 0.2s ease",
  }}
  onMouseOver={(e) =>
    (e.currentTarget.style.backgroundColor = "#0056b3")
  }
  onMouseOut={(e) =>
    (e.currentTarget.style.backgroundColor = "#007bff")
  }
>
  Record Video
</button>

          </div>

          {/* Hidden file inputs */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleFileSelected}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
            onChange={handleFileSelected}
          />
          <input
            ref={cameraVideoRef}
            type="file"
            accept="video/*"
            capture="environment"
            style={{ display: "none" }}
            onChange={handleFileSelected}
          />
        </div>
      </div>
    </>
  ) : videoSrc ? (
    // 👇 This is where your video preview will show
    <div className={styles.videoDisplayArea}>
      <video
        src={videoSrc}
        controls
        autoPlay
        style={{ maxWidth: "100%", maxHeight: "400px" }}
      />
    </div>
  ) : (
    // 👇 Fallback: image canvas
    <div className={styles.imageDisplayArea}>
      <canvas
        ref={canvasRef}
        width={300}
        height={400}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ cursor: getCursor() }}
      />
    </div>
  )}
</div>




    </div>
  );
};

export default ImageEditor;