"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Camera, X, Check, Grid3x3, ChevronLeft, ChevronRight } from 'lucide-react';

type ViewMode = 'camera' | 'preview' | 'gallery' | 'submitted';

// Annotation interfaces
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
	radius?: number;
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

interface DeleteAction {
	type: 'delete';
	line: Line;
	id: number;
}

type Action = Line | CropAction | RotateAction | DeleteAction;

interface CropFrame {
	x: number;
	y: number;
	w: number;
	h: number;
}

interface ImageWithAnnotations {
	url: string;
	annotations: Line[];
	imageRotation: number;
	location?: string;
}

const RapidImagesPage = () => {
	// State management
	const [capturedImages, setCapturedImages] = useState<ImageWithAnnotations[]>([]);
	const [currentPreview, setCurrentPreview] = useState<string | null>(null);
	const [isCameraActive, setIsCameraActive] = useState(false);
	const [viewMode, setViewMode] = useState<ViewMode>('camera');
	const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);

	// Annotation state
	const [activeMode, setActiveMode] = useState<'none' | 'crop' | 'arrow' | 'circle' | 'square'>('none');
	const [lines, setLines] = useState<Line[]>([]);
	const [currentLine, setCurrentLine] = useState<Point[] | null>(null);
	const [isDrawing, setIsDrawing] = useState(false);
	const [drawingColor, setDrawingColor] = useState('#d63636');
	const [circleColor, setCircleColor] = useState('#d63636');
	const [squareColor, setSquareColor] = useState('#d63636');
	const [shapeThickness, setShapeThickness] = useState(3);
	const [selectedColor, setSelectedColor] = useState('#d63636');
	const [cropFrame, setCropFrame] = useState<CropFrame | null>(null);
	const [hasCropFrame, setHasCropFrame] = useState(false);
	const [imageRotation, setImageRotation] = useState(0);
	const [selectedArrowId, setSelectedArrowId] = useState<number | null>(null);
	const [hoveredArrowId, setHoveredArrowId] = useState<number | null>(null);
	const [isDraggingArrow, setIsDraggingArrow] = useState(false);
	const [isRotatingArrow, setIsRotatingArrow] = useState(false);
	const [isResizingArrow, setIsResizingArrow] = useState(false);
	const [isDraggingCrop, setIsDraggingCrop] = useState(false);
	const [dragCropOffset, setDragCropOffset] = useState({ x: 0, y: 0 });
	const [resizingCropHandle, setResizingCropHandle] = useState<string | null>(null);
	const [isResizingShape, setIsResizingShape] = useState(false);
	const [resizeHandle, setResizeHandle] = useState<string | null>(null);
	const [isMovingShape, setIsMovingShape] = useState(false);
	const [moveOffset, setMoveOffset] = useState({ x: 0, y: 0 });
	const [dragArrowOffset, setDragArrowOffset] = useState({ x: 0, y: 0 });
	const [interactionMode, setInteractionMode] = useState<'move' | 'rotate' | 'resize' | null>(null);
	const [arrowResizeEnd, setArrowResizeEnd] = useState<'start' | 'end' | 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left' | null>(null);
	const [initialShapeData, setInitialShapeData] = useState<any>(null);
	const [dragStartPoint, setDragStartPoint] = useState<Point | null>(null);
	const [hasDragged, setHasDragged] = useState(false);
	const [actionHistory, setActionHistory] = useState<Action[]>([]);
	const [redoHistory, setRedoHistory] = useState<Action[]>([]);
	const [lineIdCounter, setLineIdCounter] = useState(0);
	const [showDrawingDropdown, setShowDrawingDropdown] = useState(false);
	const [showCircleDropdown, setShowCircleDropdown] = useState(false);
	const [showSquareDropdown, setShowSquareDropdown] = useState(false);
	const [currentImage, setCurrentImage] = useState<HTMLImageElement | null>(null);
	const [arrowTipPosition, setArrowTipPosition] = useState<Point | null>(null);
	const frameCounterRef = useRef(0);
	const DRAG_THRESHOLD = 5;

	// Refs
	const videoRef = useRef<HTMLVideoElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const annotationCanvasRef = useRef<HTMLCanvasElement>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const thumbnailContainerRef = useRef<HTMLDivElement>(null);
	const imageContainerRef = useRef<HTMLDivElement>(null);
	const drawingDropdownRef = useRef<HTMLDivElement>(null);
	const circleDropdownRef = useRef<HTMLDivElement>(null);
	const squareDropdownRef = useRef<HTMLDivElement>(null);
	const zoomCanvasRef = useRef<HTMLCanvasElement>(null);
	const renderMetricsRef = useRef({
		offsetX: 0,
		offsetY: 0,
		drawWidth: 0,
		drawHeight: 0,
	});

	// Initialize camera on mount
	useEffect(() => {
		if (viewMode === 'camera') {
			startCamera();
		}

		return () => {
			stopCamera();
		};
	}, [viewMode]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			stopCamera();
		};
	}, []);

	// Reset selected image index when entering gallery view
	useEffect(() => {
		if (viewMode === 'gallery' && capturedImages.length > 0) {
			// Ensure selected index is valid
			if (selectedImageIndex >= capturedImages.length) {
				setSelectedImageIndex(0);
			}
		}
	}, [viewMode, capturedImages.length, selectedImageIndex]);

	// Load annotations when switching images
	useEffect(() => {
		if (viewMode === 'gallery' && capturedImages.length > 0 && selectedImageIndex < capturedImages.length) {
			const imageData = capturedImages[selectedImageIndex];
			setLines(imageData.annotations || []);
			setImageRotation(imageData.imageRotation || 0);
			setActionHistory([]);
			setRedoHistory([]);
			setSelectedArrowId(null);
			setCropFrame(null);
			setHasCropFrame(false);
			
			// Find max ID to continue from
			if (imageData.annotations && imageData.annotations.length > 0) {
				const maxId = Math.max(0, ...imageData.annotations.map(line => line.id || 0));
				setLineIdCounter(maxId + 1);
			} else {
				setLineIdCounter(0);
			}

			// Load image for canvas rendering
			const img = new Image();
			img.onload = () => {
				setCurrentImage(img);
			};
			img.src = imageData.url;
		}
	}, [viewMode, selectedImageIndex, capturedImages]);

	// Save annotations when they change
	useEffect(() => {
		if (viewMode === 'gallery' && capturedImages.length > 0 && selectedImageIndex < capturedImages.length) {
			setCapturedImages(prev => {
				const updated = [...prev];
				updated[selectedImageIndex] = {
					...updated[selectedImageIndex],
					annotations: lines,
					imageRotation: imageRotation
				};
				return updated;
			});
		}
	}, [lines, imageRotation]); // Only save when annotations or rotation change, not on every render

	// Close dropdowns when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (drawingDropdownRef.current && !drawingDropdownRef.current.contains(event.target as Node)) {
				setShowDrawingDropdown(false);
			}
			if (circleDropdownRef.current && !circleDropdownRef.current.contains(event.target as Node)) {
				setShowCircleDropdown(false);
			}
			if (squareDropdownRef.current && !squareDropdownRef.current.contains(event.target as Node)) {
				setShowSquareDropdown(false);
			}
		};

		document.addEventListener('mousedown', handleClickOutside);
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, []);

	// Start camera
	const startCamera = async () => {
		try {
			setError(null);
			setIsLoading(true);

			// Check if getUserMedia is available
			if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
				setError('Camera access is not supported in this browser. Please use a modern browser like Chrome, Safari, or Firefox.');
				setIsLoading(false);
				return;
			}

			// Stop existing stream if any
			if (streamRef.current) {
				stopCamera();
			}

			const stream = await navigator.mediaDevices.getUserMedia({
				video: {
					facingMode: 'environment', // Prefer rear camera on mobile
					width: { ideal: 1920 },
					height: { ideal: 1080 }
				}
			});

			streamRef.current = stream;
			setIsCameraActive(true);

			if (videoRef.current) {
				videoRef.current.srcObject = stream;
				videoRef.current.onloadedmetadata = () => {
					videoRef.current?.play().catch(err => {
						console.error('Error playing video:', err);
						setError('Failed to start camera preview');
					});
				};
			}

			setIsLoading(false);
		} catch (err: any) {
			console.error('Error accessing camera:', err);
			
			// Provide specific error messages based on error type
			let errorMessage = 'Unable to access camera. ';
			
			if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
				errorMessage += 'Camera permission was denied. ';
				errorMessage += 'On mobile: Go to your browser settings → Site permissions → Camera → Allow. ';
				errorMessage += 'Or look for the camera icon in your browser\'s address bar and tap it to grant permission.';
			} else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
				errorMessage += 'No camera found on this device.';
			} else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
				errorMessage += 'Camera is already in use by another application. Please close other apps using the camera and try again.';
			} else {
				errorMessage += 'Please make sure you have granted camera permissions in your browser settings.';
			}
			
			setError(errorMessage);
			setIsCameraActive(false);
			setIsLoading(false);
		}
	};

	// Stop camera
	const stopCamera = () => {
		if (streamRef.current) {
			streamRef.current.getTracks().forEach(track => track.stop());
			streamRef.current = null;
		}

		if (videoRef.current) {
			videoRef.current.srcObject = null;
		}

		setIsCameraActive(false);
	};

	// Capture image
	const captureImage = () => {
		if (!videoRef.current || !canvasRef.current) {
			return;
		}

		const video = videoRef.current;
		const canvas = canvasRef.current;
		const context = canvas.getContext('2d');

		if (!context) {
			return;
		}

		// Set canvas dimensions to match video
		canvas.width = video.videoWidth;
		canvas.height = video.videoHeight;

		// Draw video frame to canvas
		context.drawImage(video, 0, 0, canvas.width, canvas.height);

		// Convert to data URL
		const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
		setCurrentPreview(dataUrl);
		setViewMode('preview');
		stopCamera();
	};

	// Discard current image
	const handleDiscard = () => {
		setCurrentPreview(null);
		setViewMode('camera');
	};

	// Continue - save image and return to camera
	const handleContinue = () => {
		if (currentPreview) {
			setCapturedImages(prev => [...prev, {
				url: currentPreview,
				annotations: [],
				imageRotation: 0,
				location: undefined
			}]);
			setCurrentPreview(null);
			setViewMode('camera');
		}
	};

	// Continue and Edit - save image and show gallery
	const handleContinueAndEdit = () => {
		if (currentPreview) {
			setCapturedImages(prev => [...prev, {
				url: currentPreview,
				annotations: [],
				imageRotation: 0,
				location: undefined
			}]);
			setCurrentPreview(null);
			setSelectedImageIndex(capturedImages.length); // Start with the new image
			setViewMode('gallery');
		}
	};

	// Back to camera from gallery
	const handleBackToCamera = () => {
		setViewMode('camera');
	};

	// Handle location change for selected image
	const handleLocationChange = (value: string) => {
		if (selectedImageIndex < capturedImages.length) {
			setCapturedImages(prev => {
				const updated = [...prev];
				updated[selectedImageIndex] = {
					...updated[selectedImageIndex],
					location: value
				};
				return updated;
			});
		}
	};

	// Handle submit - switch to submitted view
	const handleSubmit = async () => {
		// Get gallery canvas dimensions for scaling annotations
		let galleryCanvasWidth = 800;
		let galleryCanvasHeight = 600;
		
		if (imageContainerRef.current) {
			const rect = imageContainerRef.current.getBoundingClientRect();
			galleryCanvasWidth = rect.width;
			galleryCanvasHeight = rect.height;
		}

		// Create composite images for all images with annotations or rotation
		const updatedImages = await Promise.all(
			capturedImages.map(async (imageData) => {
				// Only create composite if there are annotations or rotation
				if ((imageData.annotations && imageData.annotations.length > 0) || (imageData.imageRotation && imageData.imageRotation !== 0)) {
					try {
						const compositeUrl = await createCompositeImage(
							imageData.url,
							imageData.annotations || [],
							imageData.imageRotation || 0,
							galleryCanvasWidth,
							galleryCanvasHeight
						);
						return {
							...imageData,
							url: compositeUrl
						};
					} catch (error) {
						console.error('Error creating composite image:', error);
						// Return original image if composite creation fails
						return imageData;
					}
				}
				return imageData;
			})
		);

		// Update captured images with composite images
		setCapturedImages(updatedImages);
		setViewMode('submitted');
	};

	// Handle thumbnail click - select image
	const handleThumbnailClick = (index: number) => {
		setSelectedImageIndex(index);
		
		// Scroll thumbnail into view if needed
		if (thumbnailContainerRef.current) {
			const thumbnailElement = thumbnailContainerRef.current.children[index] as HTMLElement;
			if (thumbnailElement) {
				thumbnailElement.scrollIntoView({
					behavior: 'smooth',
					block: 'nearest',
					inline: 'center'
				});
			}
		}
	};

	// Navigate to previous image
	const handlePreviousImage = () => {
		if (selectedImageIndex > 0) {
			handleThumbnailClick(selectedImageIndex - 1);
		}
	};

	// Navigate to next image
	const handleNextImage = () => {
		if (selectedImageIndex < capturedImages.length - 1) {
			handleThumbnailClick(selectedImageIndex + 1);
		}
	};

	// Annotation helper functions
	const getArrowCenter = (line: Line): Point => {
		if (line.points.length < 2) return { x: 0, y: 0 };
		const from = line.points[0];
		const to = line.points[line.points.length - 1];
		return {
			x: (from.x + to.x) / 2,
			y: (from.y + to.y) / 2
		};
	};

	const createCompositeImage = async (
		imageUrl: string,
		annotations: Line[],
		imageRotation: number,
		galleryCanvasWidth: number,
		galleryCanvasHeight: number
	): Promise<string> => {
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.crossOrigin = 'anonymous';
			img.onload = () => {
				// Create canvas with original image dimensions
				const canvas = document.createElement('canvas');
				canvas.width = img.width;
				canvas.height = img.height;
				const ctx = canvas.getContext('2d');
				if (!ctx) {
					reject(new Error('Failed to get canvas context'));
					return;
				}

				// Calculate how image was fitted in gallery view
				const imgAspect = img.width / img.height;
				const galleryAspect = galleryCanvasWidth / galleryCanvasHeight;
				
				let galleryDrawWidth: number, galleryDrawHeight: number, galleryOffsetX: number, galleryOffsetY: number;
				if (imgAspect > galleryAspect) {
					galleryDrawWidth = galleryCanvasWidth;
					galleryDrawHeight = galleryCanvasWidth / imgAspect;
					galleryOffsetX = 0;
					galleryOffsetY = (galleryCanvasHeight - galleryDrawHeight) / 2;
				} else {
					galleryDrawHeight = galleryCanvasHeight;
					galleryDrawWidth = galleryCanvasHeight * imgAspect;
					galleryOffsetX = (galleryCanvasWidth - galleryDrawWidth) / 2;
					galleryOffsetY = 0;
				}

				// Calculate scale factors to convert from gallery canvas coordinates to image coordinates
				const scaleX = img.width / galleryDrawWidth;
				const scaleY = img.height / galleryDrawHeight;

				// Apply rotation if needed
				if (imageRotation !== 0) {
					ctx.save();
					ctx.translate(canvas.width / 2, canvas.height / 2);
					ctx.rotate((imageRotation * Math.PI) / 180);
					ctx.translate(-canvas.width / 2, -canvas.height / 2);
				}

				// Draw the image
				ctx.drawImage(img, 0, 0);

				// Scale and draw annotations
				annotations.forEach((line) => {
					ctx.strokeStyle = line.color;
					ctx.lineWidth = line.size * Math.min(scaleX, scaleY);
					ctx.lineCap = 'round';
					ctx.lineJoin = 'round';
					ctx.fillStyle = line.color;

					if (line.type === 'arrow' && line.points.length >= 2) {
						// Scale arrow points from gallery canvas coordinates to image coordinates
						const scaledPoints = line.points.map(point => ({
							x: (point.x - galleryOffsetX) * scaleX,
							y: (point.y - galleryOffsetY) * scaleY
						}));
						const scaledLine: Line = {
							...line,
							points: scaledPoints,
							size: line.size * Math.min(scaleX, scaleY)
						};
						drawTransformedArrow(ctx, scaledLine);
					} else if (line.type === 'circle' && line.center && line.width !== undefined && line.height !== undefined) {
						// Scale circle from gallery canvas coordinates to image coordinates
						const scaledCenterX = (line.center.x - galleryOffsetX) * scaleX;
						const scaledCenterY = (line.center.y - galleryOffsetY) * scaleY;
						const scaledWidth = line.width * scaleX;
						const scaledHeight = line.height * scaleY;
						const scaledSize = (line.size || shapeThickness) * Math.min(scaleX, scaleY);
						drawCircle(ctx, scaledCenterX, scaledCenterY, scaledWidth, scaledHeight, line.color, scaledSize);
					} else if (line.type === 'square' && line.center && line.width !== undefined && line.height !== undefined) {
						// Scale square from gallery canvas coordinates to image coordinates
						const scaledCenterX = (line.center.x - galleryOffsetX) * scaleX;
						const scaledCenterY = (line.center.y - galleryOffsetY) * scaleY;
						const scaledWidth = line.width * scaleX;
						const scaledHeight = line.height * scaleY;
						const scaledSize = (line.size || shapeThickness) * Math.min(scaleX, scaleY);
						drawSquare(ctx, scaledCenterX, scaledCenterY, scaledWidth, scaledHeight, line.color, scaledSize);
					}
				});

				if (imageRotation !== 0) {
					ctx.restore();
				}

				// Convert to data URL
				const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
				resolve(dataUrl);
			};
			img.onerror = () => {
				reject(new Error('Failed to load image'));
			};
			img.src = imageUrl;
		});
	};

	const isPointInArrow = (line: Line, point: Point, tolerance: number = 15): boolean => {
		if (line.points.length < 2) return false;
		const from = line.points[0];
		const to = line.points[line.points.length - 1];
		
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
		
		const arrowThickness = Math.max(line.size * 4, 12);
		return distance <= arrowThickness + tolerance;
	};

	const rotatePoint = (point: Point, center: Point, angle: number): Point => {
		const cos = Math.cos(angle);
		const sin = Math.sin(angle);
		const dx = point.x - center.x;
		const dy = point.y - center.y;
		return {
			x: center.x + dx * cos - dy * sin,
			y: center.y + dx * sin + dy * cos
		};
	};

	const drawArrow = (
		ctx: CanvasRenderingContext2D,
		fromX: number,
		fromY: number,
		toX: number,
		toY: number,
		size: number,
		color: string
	) => {
		const dx = toX - fromX;
		const dy = toY - fromY;
		const distance = Math.sqrt(dx * dx + dy * dy);
		const arrowThickness = Math.max(size * 1, 2) + distance * 0.05;
		const headlen = Math.max(arrowThickness * 1.0, 0.1) + distance * 0.30;
		const angle = Math.atan2(dy, dx);

		ctx.strokeStyle = color;
		ctx.fillStyle = color;
		ctx.setLineDash([]);

		const tailRatio = 0.7;
		const shaftEndX = toX - headlen * tailRatio * Math.cos(angle);
		const shaftEndY = toY - headlen * tailRatio * Math.sin(angle);
		const minTailThickness = arrowThickness * 0.9;
		const maxTailThickness = arrowThickness * 1.2;

		ctx.beginPath();
		ctx.moveTo(
			fromX - (minTailThickness / 2) * Math.sin(angle),
			fromY + (minTailThickness / 2) * Math.cos(angle)
		);
		ctx.lineTo(
			fromX + (minTailThickness / 2) * Math.sin(angle),
			fromY - (minTailThickness / 2) * Math.cos(angle)
		);
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

		const leftX = toX - headlen * Math.cos(angle - Math.PI / 8);
		const leftY = toY - headlen * Math.sin(angle - Math.PI / 8);
		const rightX = toX - headlen * Math.cos(angle + Math.PI / 8);
		const rightY = toY - headlen * Math.sin(angle + Math.PI / 8);

		ctx.beginPath();
		ctx.moveTo(toX, toY);
		ctx.lineTo(leftX, leftY);
		ctx.quadraticCurveTo(
			toX - headlen * 0.8 * Math.cos(angle),
			toY - headlen * 0.8 * Math.sin(angle),
			rightX,
			rightY
		);
		ctx.closePath();
		ctx.fill();

		ctx.strokeStyle = color;
		ctx.lineWidth = 1;
		ctx.stroke();
	};

	const drawCircle = (
		ctx: CanvasRenderingContext2D,
		centerX: number,
		centerY: number,
		width: number,
		height: number,
		color: string,
		lineWidth: number = 3
	) => {
		ctx.setLineDash([]);
		ctx.beginPath();
		ctx.ellipse(centerX, centerY, width / 2, height / 2, 0, 0, 2 * Math.PI);
		ctx.save();
		ctx.strokeStyle = 'rgba(0,0,0,0.35)';
		ctx.lineWidth = Math.max(1, lineWidth + 3);
		ctx.stroke();
		ctx.restore();
		ctx.strokeStyle = color;
		ctx.lineWidth = lineWidth;
		ctx.stroke();
	};

	const drawSquare = (
		ctx: CanvasRenderingContext2D,
		centerX: number,
		centerY: number,
		width: number,
		height: number,
		color: string,
		lineWidth: number = 3
	) => {
		const left = centerX - width / 2;
		const top = centerY - height / 2;
		ctx.setLineDash([]);
		ctx.beginPath();
		ctx.rect(left, top, width, height);
		ctx.save();
		ctx.strokeStyle = 'rgba(0,0,0,0.35)';
		ctx.lineWidth = Math.max(1, lineWidth + 3);
		ctx.stroke();
		ctx.restore();
		ctx.strokeStyle = color;
		ctx.lineWidth = lineWidth;
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
		drawArrow(ctx, from.x, from.y, to.x, to.y, line.size, line.color);
		
		ctx.restore();
	};

	const renderImageWithAnnotations = (
		canvas: HTMLCanvasElement,
		image: HTMLImageElement,
		annotations: Line[],
		imageRotation: number
	) => {
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const containerWidth = canvas.width;
		const containerHeight = canvas.height;

		ctx.clearRect(0, 0, canvas.width, canvas.height);

		const imgAspect = image.width / image.height;
		const canvasAspect = containerWidth / containerHeight;

		let drawWidth: number, drawHeight: number, offsetX: number, offsetY: number;
		if (imgAspect > canvasAspect) {
			drawWidth = containerWidth;
			drawHeight = containerWidth / imgAspect;
			offsetX = 0;
			offsetY = (containerHeight - drawHeight) / 2;
		} else {
			drawHeight = containerHeight;
			drawWidth = containerHeight * imgAspect;
			offsetX = (containerWidth - drawWidth) / 2;
			offsetY = 0;
		}

		// Draw annotations (no hover/selection states in submitted view)
		// The annotations are stored in gallery view coordinates, which we need to scale
		// Since both views use the same image fitting logic, annotations should scale proportionally
		annotations.forEach((line) => {
			ctx.strokeStyle = line.color;
			ctx.lineWidth = line.size;
			ctx.lineCap = 'round';
			ctx.lineJoin = 'round';
			ctx.fillStyle = line.color;

			if (line.type === 'arrow' && line.points.length >= 2) {
				drawTransformedArrow(ctx, line);
			} else if (line.type === 'circle' && line.center && line.width !== undefined && line.height !== undefined) {
				drawCircle(ctx, line.center.x, line.center.y, line.width, line.height, line.color, line.size || shapeThickness);
			} else if (line.type === 'square' && line.center && line.width !== undefined && line.height !== undefined) {
				drawSquare(ctx, line.center.x, line.center.y, line.width, line.height, line.color, line.size || shapeThickness);
			}
		});
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

	const resizeObj = (obj: CropFrame, handle: string, mx: number, my: number): CropFrame => {
		let { x, y, w, h } = obj;
		switch (handle) {
			case "nw": w = w + (x - mx); h = h + (y - my); x = mx; y = my; break;
			case "n": h = h + (y - my); y = my; break;
			case "ne": w = mx - x; h = h + (y - my); y = my; break;
			case "e": w = mx - x; break;
			case "se": w = mx - x; h = my - y; break;
			case "s": h = my - y; break;
			case "sw": w = w + (x - mx); h = my - y; x = mx; break;
			case "w": w = w + (x - mx); x = mx; break;
		}
		return { ...obj, x, y, w, h };
	};

	const saveAction = (action: Action) => {
		setActionHistory(prev => [...prev, action]);
		setRedoHistory([]);
	};

	const handleUndo = () => {
		if (actionHistory.length === 0) return;
		
		const lastAction = actionHistory[actionHistory.length - 1];
		setRedoHistory(prev => [...prev, lastAction]);
		
		if (lastAction.type === 'delete') {
			setLines(prev => {
				const alreadyExists = prev.some(line => line.id === lastAction.line.id);
				if (alreadyExists) return prev;
				return [...prev, lastAction.line];
			});
			setSelectedArrowId(lastAction.line.id);
		} else {
			setLines(prev => prev.filter(line => line.id !== lastAction.id));
		}
		
		setActionHistory(prev => prev.slice(0, -1));
	};

	const handleRedo = () => {
		if (redoHistory.length === 0) return;
		
		const lastRedoAction = redoHistory[redoHistory.length - 1];
		
		if (lastRedoAction.type === 'delete') {
			setLines(prev => prev.filter(line => line.id !== lastRedoAction.line.id));
			setSelectedArrowId(null);
		} else if (lastRedoAction.type !== 'rotate') {
			setLines(prev => [...prev, lastRedoAction as Line]);
		}
		
		setActionHistory(prev => [...prev, lastRedoAction]);
		setRedoHistory(prev => prev.slice(0, -1));
	};

	const handleRotate = () => {
		setImageRotation(prev => (prev + 90) % 360);
	};

	const deleteSelectedAnnotation = () => {
		if (selectedArrowId === null) return;
		const targetLine = lines.find(line => line.id === selectedArrowId);
		if (!targetLine) return;

		const updatedLines = lines.filter(line => line.id !== targetLine.id);
		setLines(updatedLines);
		setSelectedArrowId(null);
		setHoveredArrowId(null);

		const deleteAction: DeleteAction = {
			type: 'delete',
			id: targetLine.id,
			line: targetLine,
		};
		saveAction(deleteAction);
	};

	const handleActionClick = (mode: 'none' | 'crop' | 'arrow' | 'circle' | 'square') => {
		if (mode === 'arrow') {
			setShowDrawingDropdown(!showDrawingDropdown);
			setShowCircleDropdown(false);
			setShowSquareDropdown(false);
			setActiveMode(activeMode === 'arrow' ? 'none' : 'arrow');
		} else if (mode === 'circle') {
			setShowCircleDropdown(!showCircleDropdown);
			setShowDrawingDropdown(false);
			setShowSquareDropdown(false);
			setActiveMode(activeMode === 'circle' ? 'none' : 'circle');
		} else if (mode === 'square') {
			setShowSquareDropdown(!showSquareDropdown);
			setShowDrawingDropdown(false);
			setShowCircleDropdown(false);
			setActiveMode(activeMode === 'square' ? 'none' : 'square');
		} else {
			setShowDrawingDropdown(false);
			setShowCircleDropdown(false);
			setShowSquareDropdown(false);
			setActiveMode(activeMode === mode ? 'none' : mode);
		}
	};

	const handleColorSelection = (color: string) => {
		setSelectedColor(color);
		setDrawingColor(color);
		setCircleColor(color);
		setSquareColor(color);
		setShowDrawingDropdown(false);
		setShowCircleDropdown(false);
		setShowSquareDropdown(false);
	};

	const toolColors = ['#d63636', '#FF8C00', '#0066CC', '#4CBB17', '#800080'];

	// Mouse and touch event handlers
	const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
		if (!annotationCanvasRef.current) return;
		
		const rect = annotationCanvasRef.current.getBoundingClientRect();
		let mouseX = e.clientX - rect.left;
		let mouseY = e.clientY - rect.top;
		
		// Transform coordinates to account for image offset
		const metrics = renderMetricsRef.current;
		if (metrics.drawWidth > 0 && metrics.drawHeight > 0) {
			// Coordinates are already in canvas space, which matches our drawing space
			// No transformation needed as canvas is positioned over the image
		}
		
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
			const clickedShape = lines.find(line => {
				if (line.type === 'arrow') {
					return isPointInArrow(line, { x: mouseX, y: mouseY }, 25);
				} else if (line.type === 'circle' && line.center && line.width !== undefined && line.height !== undefined) {
					const dx = (mouseX - line.center.x) / (line.width / 2);
					const dy = (mouseY - line.center.y) / (line.height / 2);
					return (dx * dx + dy * dy) <= 1.2;
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
					const center = getArrowCenter(clickedShape);
					setIsDraggingArrow(true);
					setDragArrowOffset({ x: mouseX - center.x, y: mouseY - center.y });
					setInteractionMode('move');
					// Set initial arrow tip position
					if (clickedShape.points.length > 0) {
						setArrowTipPosition(clickedShape.points[clickedShape.points.length - 1]);
					}
				} else if (clickedShape.type === 'circle' || clickedShape.type === 'square') {
					const center = clickedShape.center || clickedShape.points[0];
					setIsMovingShape(true);
					setMoveOffset({ x: mouseX - center.x, y: mouseY - center.y });
				}
				return;
			} else {
				setSelectedArrowId(null);
				return;
			}
		} else if (activeMode === 'arrow') {
			const clickedShape = lines.find(line => {
				if (line.type === 'arrow') {
					return isPointInArrow(line, { x: mouseX, y: mouseY }, 25);
				}
				return false;
			});

			if (clickedShape) {
				setSelectedArrowId(clickedShape.id);
				const center = getArrowCenter(clickedShape);
				setIsDraggingArrow(true);
				setDragArrowOffset({ x: mouseX - center.x, y: mouseY - center.y });
				setInteractionMode('move');
				// Set initial arrow tip position
				if (clickedShape.points.length > 0) {
					setArrowTipPosition(clickedShape.points[clickedShape.points.length - 1]);
				}
				return;
			} else {
				setSelectedArrowId(null);
				setIsDrawing(true);
				const initialPoint = { x: mouseX, y: mouseY };
				setCurrentLine([initialPoint]);
				setArrowTipPosition(initialPoint); // Set initial arrow tip position for zoom view
			}
		} else if (activeMode === 'circle' || activeMode === 'square') {
			const clickedShape = lines.find(line => {
				if (line.type === 'arrow') {
					return isPointInArrow(line, { x: mouseX, y: mouseY }, 25);
				} else if (line.type === 'circle' && line.center && line.width !== undefined && line.height !== undefined) {
					const dx = (mouseX - line.center.x) / (line.width / 2);
					const dy = (mouseY - line.center.y) / (line.height / 2);
					return (dx * dx + dy * dy) <= 1.2;
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
				if (clickedShape.type === 'circle' || clickedShape.type === 'square') {
					const center = clickedShape.center || clickedShape.points[0];
					setIsMovingShape(true);
					setMoveOffset({ x: mouseX - center.x, y: mouseY - center.y });
				}
				return;
			}
			
			setIsDrawing(true);
			setCurrentLine([{ x: mouseX, y: mouseY }]);
		}
	};

	const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
		if (!annotationCanvasRef.current) return;
		
		const rect = annotationCanvasRef.current.getBoundingClientRect();
		const mouseX = e.clientX - rect.left;
		const mouseY = e.clientY - rect.top;
		
		if (dragStartPoint && !hasDragged) {
			const distance = Math.sqrt(
				Math.pow(mouseX - dragStartPoint.x, 2) + Math.pow(mouseY - dragStartPoint.y, 2)
			);
			if (distance > DRAG_THRESHOLD) {
				setHasDragged(true);
			}
		}

		if (isDraggingArrow && selectedArrowId !== null) {
			const selectedArrow = lines.find(line => line.id === selectedArrowId);
			if (selectedArrow && interactionMode === 'move') {
				const center = getArrowCenter(selectedArrow);
				const newCenter = { x: mouseX - dragArrowOffset.x, y: mouseY - dragArrowOffset.y };
				const oldCenter = getArrowCenter(selectedArrow);
				const deltaX = newCenter.x - oldCenter.x;
				const deltaY = newCenter.y - oldCenter.y;

				if (frameCounterRef.current++ % 3 === 0) {
					setLines(prev => prev.map(line => {
						if (line.id === selectedArrowId) {
							const updatedLine = {
								...line,
								points: line.points.map(point => ({
									x: point.x + deltaX,
									y: point.y + deltaY
								}))
							};
							// Track arrow tip position (last point)
							if (updatedLine.points.length > 0) {
								setArrowTipPosition(updatedLine.points[updatedLine.points.length - 1]);
							}
							return updatedLine;
						}
						return line;
					}));
				} else {
					// Update tip position even when not updating lines
					if (selectedArrow.points.length > 0) {
						const tip = selectedArrow.points[selectedArrow.points.length - 1];
						setArrowTipPosition({ x: tip.x + deltaX, y: tip.y + deltaY });
					}
				}
			}
			return;
		}

		if (isMovingShape && selectedArrowId !== null) {
			const newCenterX = mouseX - moveOffset.x;
			const newCenterY = mouseY - moveOffset.y;

			if (frameCounterRef.current++ % 3 === 0) {
				setLines(prev => prev.map(line => {
					if (line.id === selectedArrowId) {
						if (line.type === 'circle' || line.type === 'square') {
							return {
								...line,
								center: { x: newCenterX, y: newCenterY },
								points: [
									{ x: newCenterX - (line.width || 0) / 2, y: newCenterY - (line.height || 0) / 2 },
									{ x: newCenterX + (line.width || 0) / 2, y: newCenterY + (line.height || 0) / 2 }
								]
							};
						} else if (line.type === 'arrow') {
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
				}));
			}
			return;
		}

		if (activeMode === 'crop' && cropFrame) {
			if (resizingCropHandle) {
				setCropFrame(prev => prev ? resizeObj(prev, resizingCropHandle, mouseX, mouseY) : null);
				return;
			}
			if (isDraggingCrop) {
				setCropFrame(prev => prev ? {
					...prev,
					x: mouseX - dragCropOffset.x,
					y: mouseY - dragCropOffset.y,
				} : null);
				return;
			}
			if (isDrawing) {
				setCropFrame(prev => prev ? {
					...prev,
					w: mouseX - prev.x,
					h: mouseY - prev.y,
				} : null);
				return;
			}
		} else if (activeMode === 'arrow' && isDrawing && currentLine) {
			setCurrentLine(prev => {
				if (prev) {
					const updatedLine = [...prev, { x: mouseX, y: mouseY }];
					// Track arrow tip position (last point) for zoom view
					if (updatedLine.length > 0) {
						setArrowTipPosition(updatedLine[updatedLine.length - 1]);
					}
					return updatedLine;
				}
				return null;
			});
		} else if ((activeMode === 'circle' || activeMode === 'square') && isDrawing && currentLine && hasDragged) {
			if (currentLine.length >= 1) {
				setCurrentLine([currentLine[0], { x: mouseX, y: mouseY }]);
			}
		} else if (activeMode === 'none') {
			const hoveredShape = lines.find(line => {
				if (line.type === 'arrow') {
					return isPointInArrow(line, { x: mouseX, y: mouseY }, 25);
				} else if (line.type === 'circle' && line.center && line.width !== undefined && line.height !== undefined) {
					const dx = (mouseX - line.center.x) / (line.width / 2);
					const dy = (mouseY - line.center.y) / (line.height / 2);
					return (dx * dx + dy * dy) <= 1.2;
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
	}, [activeMode, cropFrame, resizingCropHandle, isDraggingCrop, dragCropOffset, isDrawing, selectedArrowId, lines, isDraggingArrow, interactionMode, dragArrowOffset, currentLine, hoveredArrowId, isResizingShape, isMovingShape, moveOffset, hasDragged, dragStartPoint]);

	const handleMouseUp = () => {
		if (activeMode === 'crop' && isDrawing && cropFrame) {
			if (cropFrame.w < 0) {
				setCropFrame(prev => prev ? {
					...prev,
					x: prev.x + prev.w,
					w: Math.abs(prev.w),
				} : null);
			}
			if (cropFrame.h < 0) {
				setCropFrame(prev => prev ? {
					...prev,
					y: prev.y + prev.h,
					h: Math.abs(prev.h),
				} : null);
			}
			setIsDrawing(false);
			setHasCropFrame(true);
			return;
		}
		
		if (activeMode === 'arrow' && isDrawing && currentLine && currentLine.length > 1) {
			const newLine: Line = {
				points: [...currentLine],
				color: drawingColor,
				size: Math.max(2, shapeThickness),
				type: 'arrow',
				id: lineIdCounter,
				rotation: 0,
				scale: 1,
				center: getArrowCenter({ points: currentLine, color: drawingColor, size: Math.max(2, shapeThickness), type: 'arrow', id: lineIdCounter })
			};

			setLineIdCounter(prev => prev + 1);
			const newLines = [...lines, newLine];
			setLines(newLines);
			setSelectedArrowId(newLine.id);
			saveAction(newLine);
			setCurrentLine(null);
			setArrowTipPosition(null); // Clear arrow tip position when arrow creation is complete
		} else if ((activeMode === 'circle' || activeMode === 'square') && isDrawing && currentLine && currentLine.length >= 2 && hasDragged) {
			const startPoint = currentLine[0];
			const endPoint = currentLine[1];
			const center = {
				x: (startPoint.x + endPoint.x) / 2,
				y: (startPoint.y + endPoint.y) / 2
			};

			const width = Math.abs(endPoint.x - startPoint.x);
			const height = Math.abs(endPoint.y - startPoint.y);
			const newLine: Line = {
				points: [startPoint, endPoint],
				color: activeMode === 'circle' ? circleColor : squareColor,
				size: Math.max(2, shapeThickness),
				type: activeMode,
				id: lineIdCounter,
				center: center,
				width: width,
				height: height
			};

			setLineIdCounter(prev => prev + 1);
			const newLines = [...lines, newLine];
			setLines(newLines);
			setSelectedArrowId(newLine.id);
			saveAction(newLine);
			setCurrentLine(null);
		}

		setIsDrawing(false);
		setIsDraggingCrop(false);
		setResizingCropHandle(null);
		setIsDraggingArrow(false);
		setIsMovingShape(false);
		setMoveOffset({ x: 0, y: 0 });
		setDragStartPoint(null);
		setHasDragged(false);
		setArrowTipPosition(null);
	};

	const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
		e.preventDefault();
		if (!annotationCanvasRef.current) return;
		
		const rect = annotationCanvasRef.current.getBoundingClientRect();
		const touch = e.touches[0];
		const mouseX = touch.clientX - rect.left;
		const mouseY = touch.clientY - rect.top;
		
		const mockEvent = {
			clientX: touch.clientX,
			clientY: touch.clientY,
			preventDefault: () => e.preventDefault(),
		} as unknown as React.MouseEvent<HTMLCanvasElement>;
		
		handleMouseDown(mockEvent);
	};

	const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
		e.preventDefault();
		if (!annotationCanvasRef.current) return;
		
		const rect = annotationCanvasRef.current.getBoundingClientRect();
		const touch = e.touches[0];
		const mouseX = touch.clientX - rect.left;
		const mouseY = touch.clientY - rect.top;

		const mockEvent = {
			clientX: touch.clientX,
			clientY: touch.clientY,
			preventDefault: () => e.preventDefault(),
		} as unknown as React.MouseEvent<HTMLCanvasElement>;
		
		handleMouseMove(mockEvent);
	};

	const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
		e.preventDefault();
		handleMouseUp();
	};

	// Camera View
	const renderCameraView = () => {
		if (error) {
			return (
				<div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 p-4 max-w-2xl mx-auto">
					<Camera className="h-16 w-16 text-muted-foreground" />
					<div className="text-center space-y-2">
						<p className="text-lg font-semibold text-destructive">{error}</p>
						<div className="text-sm text-muted-foreground mt-4 space-y-2">
							<p className="font-semibold">How to grant camera permission on mobile:</p>
							<ul className="list-disc list-inside space-y-1 text-left">
								<li><strong>Chrome (Android):</strong> Tap the lock icon in the address bar → Permissions → Camera → Allow</li>
								<li><strong>Safari (iOS):</strong> Settings → Safari → Camera → Allow, then refresh the page</li>
								<li><strong>Firefox (Android):</strong> Tap the menu (☰) → Settings → Site Permissions → Camera → Allow</li>
							</ul>
							<p className="mt-4">After granting permission, tap "Try Again" below.</p>
						</div>
					</div>
					<Button onClick={startCamera} variant="default" size="lg">
						Try Again
					</Button>
				</div>
			);
		}

		return (
			<div className="flex flex-col items-center space-y-4">
				<div className="relative w-full max-w-4xl mx-auto bg-black rounded-lg overflow-hidden">
					{isLoading && (
						<div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
							<div className="text-white">Loading camera...</div>
						</div>
					)}
					<video
						ref={videoRef}
						autoPlay
						playsInline
						muted
						className="w-full h-auto max-h-[70vh] object-contain"
					/>
					<canvas ref={canvasRef} className="hidden" />
				</div>

				<div className="flex gap-4">
					<Button
						onClick={captureImage}
						disabled={!isCameraActive || isLoading}
						size="lg"
						className="px-8"
					>
						<Camera className="h-5 w-5 mr-2" />
						Capture Photo
					</Button>
				</div>
			</div>
		);
	};

	// Preview View
	const renderPreviewView = () => {
		if (!currentPreview) {
			return null;
		}

		return (
			<div className="flex flex-col items-center space-y-6">
				<div className="relative w-full max-w-4xl mx-auto bg-black rounded-lg overflow-hidden">
					<img
						src={currentPreview}
						alt="Preview"
						className="w-full h-auto max-h-[70vh] object-contain"
					/>
				</div>

				<div className="flex flex-wrap gap-4 justify-center">
					<Button
						onClick={handleDiscard}
						variant="destructive"
						size="lg"
						className="px-6"
					>
						<X className="h-5 w-5 mr-2" />
						Discard
					</Button>
					<Button
						onClick={handleContinue}
						variant="secondary"
						size="lg"
						className="px-6"
					>
						<Check className="h-5 w-5 mr-2" />
						Continue
					</Button>
					<Button
						onClick={handleContinueAndEdit}
						variant="default"
						size="lg"
						className="px-6"
					>
						<Grid3x3 className="h-5 w-5 mr-2" />
						Continue and Edit
					</Button>
				</div>
			</div>
		);
	};

	// Canvas resize and rendering effect
	useEffect(() => {
		const canvas = annotationCanvasRef.current;
		if (!canvas || viewMode !== 'gallery') return;
		
		const container = imageContainerRef.current;
		if (!container) return;
		
		const updateCanvasSize = () => {
			const containerWidth = container.clientWidth;
			const containerHeight = container.clientHeight;
			
			if (canvas.width !== containerWidth || canvas.height !== containerHeight) {
				canvas.width = containerWidth;
				canvas.height = containerHeight;
			}
		};
		
		updateCanvasSize();
		window.addEventListener('resize', updateCanvasSize);
		
		return () => {
			window.removeEventListener('resize', updateCanvasSize);
		};
	}, [viewMode]);

	// Canvas rendering effect
	useEffect(() => {
		const canvas = annotationCanvasRef.current;
		if (!canvas || !currentImage || viewMode !== 'gallery') return;
		
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		
		const container = imageContainerRef.current;
		if (!container) return;
		
		const containerWidth = container.clientWidth;
		const containerHeight = container.clientHeight;
		
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		const imgAspect = currentImage.width / currentImage.height;
		const canvasAspect = canvas.width / canvas.height;
		
		let drawWidth: number, drawHeight: number, offsetX: number, offsetY: number;
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

		renderMetricsRef.current = { offsetX, offsetY, drawWidth, drawHeight };

		// Draw image with rotation
		if (imageRotation !== 0) {
			ctx.save();
			ctx.translate(canvas.width / 2, canvas.height / 2);
			ctx.rotate((imageRotation * Math.PI) / 180);
			ctx.translate(-canvas.width / 2, -canvas.height / 2);
			ctx.drawImage(currentImage, offsetX, offsetY, drawWidth, drawHeight);
			ctx.restore();
		} else {
			ctx.drawImage(currentImage, offsetX, offsetY, drawWidth, drawHeight);
		}

		// Draw annotations
		lines.forEach((line) => {
			ctx.strokeStyle = line.color;
			ctx.lineWidth = line.size;
			ctx.lineCap = 'round';
			ctx.lineJoin = 'round';
			ctx.fillStyle = line.color;
			
			if (line.type === 'arrow' && line.points.length >= 2) {
				if (hoveredArrowId === line.id && selectedArrowId !== line.id) {
					ctx.strokeStyle = line.color;
					ctx.lineWidth = line.size + 4;
					ctx.globalAlpha = 0.3;
					drawTransformedArrow(ctx, line);
					ctx.globalAlpha = 1.0;
				}
				drawTransformedArrow(ctx, line);
				
				if (selectedArrowId === line.id) {
					ctx.strokeStyle = 'rgba(0, 123, 255, 0.5)';
					ctx.lineWidth = line.size + 2;
					ctx.globalAlpha = 0.3;
					drawTransformedArrow(ctx, line);
					ctx.globalAlpha = 1.0;
				}
			} else if (line.type === 'circle' && line.center && line.width !== undefined && line.height !== undefined) {
				if (hoveredArrowId === line.id && selectedArrowId !== line.id) {
					ctx.strokeStyle = line.color;
					ctx.lineWidth = (line.size || 3) + 4;
					ctx.globalAlpha = 0.3;
					drawCircle(ctx, line.center.x, line.center.y, line.width, line.height, line.color, line.size || shapeThickness);
					ctx.globalAlpha = 1.0;
				}
				drawCircle(ctx, line.center.x, line.center.y, line.width, line.height, line.color, line.size || shapeThickness);
				
				if (selectedArrowId === line.id) {
					ctx.strokeStyle = 'rgba(0, 123, 255, 0.8)';
					ctx.lineWidth = 2;
					ctx.setLineDash([5, 5]);
					ctx.beginPath();
					ctx.ellipse(line.center.x, line.center.y, line.width / 2, line.height / 2, 0, 0, 2 * Math.PI);
					ctx.stroke();
					ctx.setLineDash([]);
				}
			} else if (line.type === 'square' && line.center && line.width !== undefined && line.height !== undefined) {
				if (hoveredArrowId === line.id && selectedArrowId !== line.id) {
					ctx.strokeStyle = line.color;
					ctx.lineWidth = (line.size || 3) + 4;
					ctx.globalAlpha = 0.3;
					drawSquare(ctx, line.center.x, line.center.y, line.width, line.height, line.color, line.size || shapeThickness);
					ctx.globalAlpha = 1.0;
				}
				drawSquare(ctx, line.center.x, line.center.y, line.width, line.height, line.color, line.size || shapeThickness);
				
				if (selectedArrowId === line.id) {
					ctx.strokeStyle = 'rgba(0, 123, 255, 0.8)';
					ctx.lineWidth = 2;
					ctx.setLineDash([5, 5]);
					const left = line.center.x - line.width / 2;
					const top = line.center.y - line.height / 2;
					ctx.strokeRect(left, top, line.width, line.height);
					ctx.setLineDash([]);
				}
			}
		});

		// Draw current line if drawing
		if (isDrawing && currentLine && currentLine.length > 0) {
			ctx.strokeStyle = activeMode === 'circle' ? circleColor : activeMode === 'square' ? squareColor : drawingColor;
			ctx.lineWidth = shapeThickness;
			ctx.lineCap = 'round';
			ctx.lineJoin = 'round';
			ctx.fillStyle = activeMode === 'circle' ? circleColor : activeMode === 'square' ? squareColor : drawingColor;
			
			if (activeMode === 'arrow' && currentLine.length >= 2) {
				const from = currentLine[0];
				const to = currentLine[currentLine.length - 1];
				drawArrow(ctx, from.x, from.y, to.x, to.y, Math.max(2, shapeThickness), drawingColor);
			} else if (activeMode === 'circle' && currentLine.length >= 2 && hasDragged) {
				const startPoint = currentLine[0];
				const endPoint = currentLine[1];
				const center = {
					x: (startPoint.x + endPoint.x) / 2,
					y: (startPoint.y + endPoint.y) / 2
				};
				const width = Math.abs(endPoint.x - startPoint.x);
				const height = Math.abs(endPoint.y - startPoint.y);
				drawCircle(ctx, center.x, center.y, width, height, circleColor, Math.max(2, shapeThickness));
			} else if (activeMode === 'square' && currentLine.length >= 2 && hasDragged) {
				const startPoint = currentLine[0];
				const endPoint = currentLine[1];
				const center = {
					x: (startPoint.x + endPoint.x) / 2,
					y: (startPoint.y + endPoint.y) / 2
				};
				const width = Math.abs(endPoint.x - startPoint.x);
				const height = Math.abs(endPoint.y - startPoint.y);
				drawSquare(ctx, center.x, center.y, width, height, squareColor, Math.max(2, shapeThickness));
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
	}, [currentImage, imageRotation, lines, currentLine, isDrawing, drawingColor, shapeThickness, activeMode, cropFrame, selectedArrowId, hoveredArrowId, circleColor, squareColor, hasDragged, viewMode, selectedImageIndex]);


	// Zoom view rendering effect
	useEffect(() => {
		const zoomCanvas = zoomCanvasRef.current;
		const sourceCanvas = annotationCanvasRef.current;
		if (!zoomCanvas || !sourceCanvas || !currentImage || viewMode !== 'gallery') return;
		
		// Check if we should show zoom view (either dragging existing arrow or creating new arrow)
		const isDraggingExisting = isDraggingArrow && selectedArrowId !== null && arrowTipPosition;
		const isCreatingNew = activeMode === 'arrow' && isDrawing && currentLine && currentLine.length > 0 && arrowTipPosition;
		
		if (!isDraggingExisting && !isCreatingNew) return;

		const ctx = zoomCanvas.getContext("2d");
		if (!ctx) return;

		const zoomSize = 80; // 80px region
		const zoomFactor = 1.5; // 1.5x zoom
		const sourceSize = zoomSize / zoomFactor; // ~53.33px in original coordinates
		const halfSourceSize = sourceSize / 2;

		// Clear canvas
		ctx.clearRect(0, 0, zoomCanvas.width, zoomCanvas.height);

		// Calculate source region centered on arrow tip
		// When creating new arrow, use the last point from currentLine; otherwise use arrowTipPosition
		let tipX: number, tipY: number;
		if (isCreatingNew && currentLine && currentLine.length > 0) {
			const tip = currentLine[currentLine.length - 1];
			tipX = tip.x;
			tipY = tip.y;
		} else {
			tipX = arrowTipPosition!.x;
			tipY = arrowTipPosition!.y;
		}

		// Clamp source region to canvas bounds
		const sourceLeft = Math.max(0, tipX - halfSourceSize);
		const sourceRight = Math.min(sourceCanvas.width, tipX + halfSourceSize);
		const sourceTop = Math.max(0, tipY - halfSourceSize);
		const sourceBottom = Math.min(sourceCanvas.height, tipY + halfSourceSize);

		const sourceWidth = sourceRight - sourceLeft;
		const sourceHeight = sourceBottom - sourceTop;

		if (sourceWidth <= 0 || sourceHeight <= 0) return;

		// Calculate destination position in zoom canvas (centered)
		const destX = (zoomCanvas.width / 2) - (sourceWidth * zoomFactor / 2);
		const destY = (zoomCanvas.height / 2) - (sourceHeight * zoomFactor / 2);

		// Copy region from main annotation canvas (which already has image + annotations with rotation)
		// The main canvas rendering effect runs before this one, so the canvas should be ready
		ctx.drawImage(
			sourceCanvas,
			// Source coordinates (from main canvas)
			sourceLeft,
			sourceTop,
			sourceWidth,
			sourceHeight,
			// Destination coordinates (to zoom canvas, scaled)
			destX,
			destY,
			sourceWidth * zoomFactor,
			sourceHeight * zoomFactor
		);
	}, [isDraggingArrow, selectedArrowId, arrowTipPosition, currentImage, viewMode, lines, imageRotation, activeMode, isDrawing, currentLine]);

	// Submitted View
	const renderSubmittedView = () => {
		if (capturedImages.length === 0) {
			return (
				<div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 px-4">
					<Grid3x3 className="h-16 w-16 text-muted-foreground" />
					<p className="text-lg text-muted-foreground text-center">No images to display</p>
				</div>
			);
		}

		return (
			<div className="space-y-6">
				{/* Header */}
				<div className="px-2 sm:px-0">
					<h2 className="text-xl sm:text-2xl font-bold">
						Submitted Images
					</h2>
					<p className="text-sm sm:text-base text-muted-foreground mt-1">
						{capturedImages.length} {capturedImages.length === 1 ? 'image' : 'images'}
					</p>
				</div>

				{/* Single Card with Images Side by Side */}
				<div className="px-2 sm:px-0">
					<div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-lg border border-gray-200 dark:border-gray-700">
						{/* Header Section with Static Text */}
						<div className="p-6 border-b border-gray-200 dark:border-gray-700 relative">
							{/* Badge - Top Right */}
							<div className="absolute top-6 right-6">
								<span 
									className="px-3 py-1.5 rounded-full text-sm font-semibold text-white"
									style={{ backgroundColor: '#d63636' }}
								>
									Immediate Attention
								</span>
							</div>
							
							<div className="space-y-4 pr-32">
								{/* Title */}
								<div>
									<h3 
										className="text-xl font-bold mb-2"
										style={{ color: '#d63636' }}
									>
										Light bulb defect
									</h3>
								</div>
								
								{/* Description */}
								<div>
									<p className="text-base text-gray-700 dark:text-gray-300 leading-relaxed">
										The image shows the lights are not working. It shows broken lights, dirty lights.
									</p>
								</div>
								
								{/* Recommendation */}
								<div className="pt-2">
									<p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
										My recommendation is to have a licensed electrician replace this damaged outlet and cover plate, check the wiring in the box, and verify the circuit is safe before restoring use.
									</p>
								</div>
							</div>
						</div>
						
						{/* Images Section */}
						<div className="p-6">
							<div className="flex flex-row gap-4 overflow-x-auto">
								{capturedImages.map((imageData, index) => (
									<div
										key={index}
										className="flex flex-col flex-shrink-0 w-[200px] sm:w-[250px]"
									>
										{/* Image */}
										<div className="relative w-full bg-black aspect-video flex items-center justify-center rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
											<img
												src={imageData.url}
												alt={`Submitted image ${index + 1}`}
												className="w-full h-full object-contain"
											/>
										</div>
										
										{/* Location Text - only show if location exists and is not empty */}
										{imageData.location && imageData.location.trim() && (
											<div className="mt-3">
												<p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
													Location:
												</p>
												<p className="text-xs text-gray-600 dark:text-gray-400">
													{imageData.location}
												</p>
											</div>
										)}
									</div>
								))}
							</div>
						</div>
						
						{/* Price Section */}
						<div className="px-6 pb-6 border-t border-gray-200 dark:border-gray-700 pt-6">
							<div className="flex items-center justify-between bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-lg p-5 border border-gray-200 dark:border-gray-600">
								<div>
									<p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
										Estimated Cost
									</p>
									<p className="text-3xl font-bold text-gray-900 dark:text-white">
										$20
									</p>
								</div>
								<div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
									<svg className="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
									</svg>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		);
	};

	// Gallery View
	const renderGalleryView = () => {
		if (capturedImages.length === 0) {
			return (
				<div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 px-4">
					<Grid3x3 className="h-16 w-16 text-muted-foreground" />
					<p className="text-lg text-muted-foreground text-center">No images captured yet</p>
					<Button onClick={handleBackToCamera} variant="default" size="lg">
						<Camera className="h-5 w-5 mr-2" />
						Start Taking Photos
					</Button>
				</div>
			);
		}

		const selectedImage = capturedImages[selectedImageIndex];
		const canGoPrevious = selectedImageIndex > 0;
		const canGoNext = selectedImageIndex < capturedImages.length - 1;

		return (
			<div className="space-y-4 sm:space-y-6">


				{/* Header */}
				<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-2 sm:px-0">
					<div>
						<h2 className="text-xl sm:text-2xl font-bold">
							Rapid Images
						</h2>
						<p className="text-sm sm:text-base text-muted-foreground mt-1">
							{selectedImageIndex + 1} of {capturedImages.length} {capturedImages.length === 1 ? 'image' : 'images'}
						</p>
					</div>
					<div className="flex gap-2 w-full sm:w-auto">
						<Button 
							onClick={handleBackToCamera} 
							variant="outline" 
							size="sm"
							className="flex-1 sm:flex-none"
						>
							<Camera className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
							<span className="text-sm sm:text-base">Take More Photos</span>
						</Button>
						<Button 
							onClick={handleSubmit} 
							variant="default" 
							size="sm"
							className="flex-1 sm:flex-none"
						>
							<Check className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
							<span className="text-sm sm:text-base">Submit</span>
						</Button>
					</div>
				</div>

				{/* Annotation Toolbar */}
				<div className="w-full max-w-6xl mx-auto px-2 sm:px-0">
					<div className="action-bar bg-white dark:bg-gray-800 rounded-lg p-2 sm:p-3 shadow-md">
						<button className="action-btn undo-btn" onClick={handleUndo} title="Undo">
							<i className="fas fa-undo"></i>
						</button>
						<button className="action-btn redo-btn" onClick={handleRedo} title="Redo">
							<i className="fas fa-redo"></i>
						</button>
						<button className="action-btn rotate-btn" onClick={handleRotate} title="Rotate">
							<i className="fas fa-sync-alt"></i>
						</button>
						<button 
							className={`action-btn crop-btn ${activeMode === 'crop' ? 'active' : ''}`}
							onClick={() => handleActionClick('crop')}
							title="Crop"
						>
							<i className="fas fa-crop-alt"></i>
						</button>
						
						{/* Arrow button with dropdown */}
						<div className="arrow-button-container relative" ref={drawingDropdownRef}>
							<button 
								className={`action-btn arrow-btn ${activeMode === 'arrow' ? 'active' : ''}`}
								onClick={() => handleActionClick('arrow')}
								title="Arrow"
							>
								<i className="fas fa-arrow-right"></i>
							</button>
							{showDrawingDropdown && (
								<div className="arrow-dropdown">
									<div className="arrow-color-options">
										{toolColors.map(color => (
											<div 
												key={color}
												className={`arrow-color-option ${selectedColor === color ? 'selected' : ''}`}
												style={{ backgroundColor: color }}
												onClick={() => handleColorSelection(color)}
												title={`Select ${color}`}
											></div>
										))}
									</div>
								</div>
							)}
						</div>

						{/* Circle button with dropdown */}
						<div className="circle-button-container relative" ref={circleDropdownRef}>
							<button 
								className={`action-btn circle-btn ${activeMode === 'circle' ? 'active' : ''}`}
								onClick={() => handleActionClick('circle')}
								title="Circle"
							>
								<i className="far fa-circle thick-circle"></i>
							</button>
							{showCircleDropdown && (
								<div className="circle-dropdown">
									<div className="circle-color-options">
										{toolColors.map(color => (
											<div 
												key={color}
												className={`circle-color-option ${selectedColor === color ? 'selected' : ''}`}
												style={{ backgroundColor: color }}
												onClick={() => handleColorSelection(color)}
												title={`Select ${color}`}
											></div>
										))}
									</div>
								</div>
							)}
						</div>

						{/* Square button with dropdown */}
						<div className="square-button-container relative" ref={squareDropdownRef}>
							<button 
								className={`action-btn square-btn ${activeMode === 'square' ? 'active' : ''}`}
								onClick={() => handleActionClick('square')}
								title="Square"
							>
								<i className="far fa-square thick-square"></i>
							</button>
							{showSquareDropdown && (
								<div className="square-dropdown">
									<div className="square-color-options">
										{toolColors.map(color => (
											<div 
												key={color}
												className={`square-color-option ${selectedColor === color ? 'selected' : ''}`}
												style={{ backgroundColor: color }}
												onClick={() => handleColorSelection(color)}
												title={`Select ${color}`}
											></div>
										))}
									</div>
								</div>
							)}
						</div>

						<button
							className="action-btn delete-btn"
							onClick={deleteSelectedAnnotation}
							title="Delete selected annotation"
						>
							<i className="fas fa-trash"></i>
						</button>
					</div>
				</div>

				{/* Main Content Area with Sidebar */}
				<div className="w-full max-w-6xl mx-auto px-2 sm:px-0">
					<div className="flex flex-col lg:flex-row gap-4">
						{/* Large Main Image Container */}
						<div className="flex-1">
							<div className="relative w-full bg-gradient-to-br from-gray-900 to-black rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl">
						{/* Zoom View - shows 1.5x zoom of 80px region around arrow tip when dragging or creating arrow */}
						{((isDraggingArrow && selectedArrowId !== null && arrowTipPosition) ||
							(activeMode === 'arrow' && isDrawing && currentLine && currentLine.length > 0 && arrowTipPosition)) && (
								<div className="absolute top-4 left-4 z-50 w-[80px] h-[80px] bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg shadow-lg overflow-hidden pointer-events-none">
									<canvas
										ref={zoomCanvasRef}
										className="w-full h-full"
										width={80}
										height={80}
									/>
								</div>
							)}
						{/* Navigation Arrows - Desktop */}
						{canGoPrevious && (
							<button
								onClick={handlePreviousImage}
								className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-10 items-center justify-center w-12 h-12 bg-black/60 hover:bg-black/80 text-white rounded-full transition-all duration-200 hover:scale-110 backdrop-blur-sm"
								aria-label="Previous image"
							>
								<ChevronLeft className="h-6 w-6" />
							</button>
						)}
						{canGoNext && (
							<button
								onClick={handleNextImage}
								className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-10 items-center justify-center w-12 h-12 bg-black/60 hover:bg-black/80 text-white rounded-full transition-all duration-200 hover:scale-110 backdrop-blur-sm"
								aria-label="Next image"
							>
								<ChevronRight className="h-6 w-6" />
							</button>
						)}

						{/* Main Image with Annotation Canvas Overlay */}
						<div 
							ref={imageContainerRef}
							className="relative w-full bg-black aspect-video max-h-[50vh] sm:max-h-[60vh] md:max-h-[70vh] flex items-center justify-center"
						>
							<img
								src={selectedImage.url}
								alt={`Selected image ${selectedImageIndex + 1}`}
								className="w-full h-full object-contain transition-all duration-300 ease-in-out pointer-events-none"
								key={selectedImageIndex}
							/>
							<canvas
								ref={annotationCanvasRef}
								className="absolute inset-0 w-full h-full cursor-crosshair"
								onMouseDown={handleMouseDown}
								onMouseMove={handleMouseMove}
								onMouseUp={handleMouseUp}
								onTouchStart={handleTouchStart}
								onTouchMove={handleTouchMove}
								onTouchEnd={handleTouchEnd}
								style={{ touchAction: 'none' }}
							/>
						</div>

						{/* Image Counter Badge */}
						<div className="absolute top-3 sm:top-4 right-3 sm:right-4 bg-black/75 backdrop-blur-md text-white text-xs sm:text-sm font-medium px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border border-white/10">
							{selectedImageIndex + 1} / {capturedImages.length}
						</div>

						{/* Mobile Navigation Dots */}
						{capturedImages.length > 1 && (
							<div className="md:hidden absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
								{capturedImages.map((_, index) => (
									<button
										key={index}
										onClick={() => handleThumbnailClick(index)}
										className={`h-2 rounded-full transition-all duration-200 ${
											index === selectedImageIndex
												? 'w-8 bg-white'
												: 'w-2 bg-white/40 hover:bg-white/60'
										}`}
										aria-label={`Go to image ${index + 1}`}
									/>
								))}
							</div>
						)}
					</div>
						</div>

						{/* Location Input Sidebar */}
						<div className="w-full lg:w-80 flex-shrink-0">
							<div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md">
								<label htmlFor="location-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
									Location
								</label>
								<Input
									id="location-input"
									type="text"
									placeholder="Enter location..."
									value={selectedImage.location || ''}
									onChange={(e) => handleLocationChange(e.target.value)}
									className="w-full"
								/>
								<p className="text-xs text-muted-foreground mt-2">
									Image {selectedImageIndex + 1} of {capturedImages.length}
								</p>
							</div>
						</div>
					</div>
				</div>

				{/* Horizontal Thumbnail Strip */}
				<div className="w-full px-2 sm:px-0">
					<div className="max-w-6xl mx-auto">
						{capturedImages.length > 1 && (
							<div className="mb-3 px-1">
								<p className="text-xs sm:text-sm text-muted-foreground font-medium">
									Tap to view
								</p>
							</div>
						)}
						<div
							ref={thumbnailContainerRef}
							className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 sm:pb-6 px-1 scrollbar-hide"
							style={{
								scrollbarWidth: 'none',
								msOverflowStyle: 'none',
							}}
						>
							{capturedImages.map((imageData, index) => (
								<button
									key={index}
									onClick={() => handleThumbnailClick(index)}
									className={`group flex-shrink-0 relative bg-gray-100 dark:bg-gray-800 rounded-lg sm:rounded-xl overflow-hidden transition-all duration-300 ease-in-out ${
										index === selectedImageIndex
											? 'ring-3 sm:ring-4 ring-primary shadow-xl scale-105 z-10'
											: 'ring-2 ring-gray-200 dark:ring-gray-700 hover:ring-gray-300 dark:hover:ring-gray-600 opacity-70 hover:opacity-100 hover:scale-[1.03] hover:shadow-md'
									}`}
									aria-label={`Select image ${index + 1}`}
									aria-current={index === selectedImageIndex ? 'true' : 'false'}
								>
									<div className="relative w-24 h-24 sm:w-32 sm:h-32 md:w-36 md:h-36 bg-gray-200 dark:bg-gray-700">
										<img
											src={imageData.url}
											alt={`Thumbnail ${index + 1}`}
											className="w-full h-full object-contain"
										/>
										{/* Overlay for selected state */}
										{index === selectedImageIndex && (
											<div className="absolute inset-0 bg-primary/20 pointer-events-none" />
										)}
										{/* Hover overlay */}
										{index !== selectedImageIndex && (
											<div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-200 pointer-events-none" />
										)}
									</div>
									{/* Thumbnail Number Badge */}
									<div className={`absolute top-1.5 left-1.5 text-[10px] sm:text-xs font-semibold px-2 py-1 rounded-md shadow-sm backdrop-blur-sm ${
										index === selectedImageIndex
											? 'bg-primary text-white'
											: 'bg-white/90 dark:bg-gray-900/90 text-gray-700 dark:text-gray-300'
									}`}>
										{index + 1}
									</div>
									{/* Selected indicator */}
									{index === selectedImageIndex && (
										<div className="absolute bottom-0 left-0 right-0 h-1 bg-primary" />
									)}
								</button>
							))}
						</div>
					</div>
				</div>

				{/* Mobile Navigation Buttons */}
				{capturedImages.length > 1 && (
					<div className="md:hidden flex gap-3 px-2 sm:px-0 justify-center">
						<Button
							onClick={handlePreviousImage}
							disabled={!canGoPrevious}
							variant="outline"
							size="lg"
							className="flex-1 max-w-[150px]"
						>
							<ChevronLeft className="h-5 w-5 mr-2" />
							Previous
						</Button>
						<Button
							onClick={handleNextImage}
							disabled={!canGoNext}
							variant="outline"
							size="lg"
							className="flex-1 max-w-[150px]"
						>
							Next
							<ChevronRight className="h-5 w-5 ml-2" />
						</Button>
					</div>
				)}
			</div>
		);
	};

	return (
		<div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-7xl">

			{viewMode === 'camera' && renderCameraView()}
			{viewMode === 'preview' && renderPreviewView()}
			{viewMode === 'gallery' && renderGalleryView()}
			{viewMode === 'submitted' && renderSubmittedView()}
		</div>
	);
};

export default RapidImagesPage;
