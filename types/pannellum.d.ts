declare module 'pannellum' {
  export interface PannellumConfig {
    type: 'equirectangular' | 'cubemap' | 'multires';
    panorama: string;
    autoLoad?: boolean;
    showControls?: boolean;
    showFullscreenCtrl?: boolean;
    showZoomCtrl?: boolean;
    mouseZoom?: boolean;
    draggable?: boolean;
    keyboardZoom?: boolean;
    disableKeyboardCtrl?: boolean;
    hotSpotDebug?: boolean;
    hfov?: number;
    pitch?: number;
    yaw?: number;
    minHfov?: number;
    maxHfov?: number;
    friction?: number;
    strings?: {
      loadButtonLabel?: string;
      loadingLabel?: string;
      bylineLabel?: string;
    };
    onload?: () => void;
    onerror?: (error: string) => void;
  }

  export interface PannellumViewer {
    destroy: () => void;
    setPitch: (pitch: number) => void;
    setYaw: (yaw: number) => void;
    setHfov: (hfov: number) => void;
    getPitch: () => number;
    getYaw: () => number;
    getHfov: () => number;
    lookAt: (pitch: number, yaw: number, hfov: number, animated?: boolean) => void;
    startAutoRotate: (speed?: number) => void;
    stopAutoRotate: () => void;
    toggleFullscreen: () => void;
  }

  export default {
    viewer: (container: HTMLElement, config: PannellumConfig) => PannellumViewer
  };
}
