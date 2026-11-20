export type OverlayPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export type FrameGenTech = 'DLSS-G' | 'FSR-FG' | 'AFMF' | 'OFF';

export interface ColorThemePreset {
  id: string;
  name: string;
  accentColor: string;
  fgAccentColor: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
}

export interface OverlayConfig {
  position: OverlayPosition;
  marginX: number;
  marginY: number;
  themeId: string;
  accentColor: string;
  fgAccentColor: string;
  textColor: string;
  bgColor: string;
  bgOpacity: number; // 0.15 to 0.95
  fontSize: number; // 12 to 18
  pillPaddingX: number; // 10 to 24
  pillPaddingY: number; // 4 to 12
  showBorder: boolean;
  clickThrough: boolean;
  updateIntervalMs: number; // Default 1000ms (1.0s)
  hotkey: string;
  // Metrics visibility
  showTotalFps: boolean;
  showBaseFps: boolean;
  showGenFps: boolean;
  showFgStatus: boolean;
  showGpuLoad: boolean;
  showCpuLoad: boolean;
  showVramLoad: boolean;
  showRamLoad: boolean;
}

export interface TelemetrySnapshot {
  totalFps: number;
  baseFps: number;
  genFps: number;
  fgActive: boolean;
  fgTech: FrameGenTech;
  fgMultiplier: string;
  gpuLoad: number;
  cpuLoad: number;
  vramLoad: number;
  ramLoad: number;
  processName: string;
  lastUpdated: string;
  tickCount: number;
}

export interface GameScenePreset {
  id: string;
  title: string;
  processName: string;
  resolution: string;
  imagePath: string;
  defaultFgTech: FrameGenTech;
  targetBaseFps: number;
  fgMultiplierNum: number;
  baseGpuLoad: number;
  baseCpuLoad: number;
  baseVramLoad: number;
  baseRamLoad: number;
}

export const COLOR_THEMES: ColorThemePreset[] = [
  {
    id: 'emerald-tactical',
    name: 'Emerald Tactical',
    accentColor: '#10B981',
    fgAccentColor: '#F59E0B',
    textColor: '#F8FAFC',
    bgColor: '#090D16',
    borderColor: '#1E293B',
  },
  {
    id: 'amber-chronos',
    name: 'Amber Gold',
    accentColor: '#F59E0B',
    fgAccentColor: '#38BDF8',
    textColor: '#FFFBEB',
    bgColor: '#0F0D0A',
    borderColor: '#292524',
  },
  {
    id: 'cyan-telemetry',
    name: 'Cyan Telemetry',
    accentColor: '#06B6D4',
    fgAccentColor: '#A855F7',
    textColor: '#F0FDFA',
    bgColor: '#081018',
    borderColor: '#164E63',
  },
  {
    id: 'crimson-stealth',
    name: 'Crimson Stealth',
    accentColor: '#F43F5E',
    fgAccentColor: '#FBBF24',
    textColor: '#FFE4E6',
    bgColor: '#12080C',
    borderColor: '#3F1D28',
  },
  {
    id: 'frost-minimal',
    name: 'Frost Monochrome',
    accentColor: '#E2E8F0',
    fgAccentColor: '#10B981',
    textColor: '#FFFFFF',
    bgColor: '#0A0A0C',
    borderColor: '#27272A',
  },
];

export const GAME_SCENES: GameScenePreset[] = [
  {
    id: 'cyberpunk-night',
    title: 'Neo-Tokyo 2099 (Path Tracing)',
    processName: 'NeoTokyo2099_DX12.exe',
    resolution: '3840 × 2160 (4K)',
    imagePath: '/src/assets/images/game_scene_cyberpunk_night_1795148172746.jpg',
    defaultFgTech: 'DLSS-G',
    targetBaseFps: 72,
    fgMultiplierNum: 2,
    baseGpuLoad: 96,
    baseCpuLoad: 44,
    baseVramLoad: 82,
    baseRamLoad: 64,
  },
  {
    id: 'alpine-horizon',
    title: 'Alpine Frontier (Ultra Native + FSR 3)',
    processName: 'AlpineFrontier.exe',
    resolution: '2560 × 1440 (QHD)',
    imagePath: '/src/assets/images/game_scene_alpine_horizon_1795148172007.jpg',
    defaultFgTech: 'FSR-FG',
    targetBaseFps: 88,
    fgMultiplierNum: 2,
    baseGpuLoad: 91,
    baseCpuLoad: 52,
    baseVramLoad: 71,
    baseRamLoad: 58,
  },
  {
    id: 'motorsport-track',
    title: 'Apex GT Motorsport (Competitive Native)',
    processName: 'ApexGT_Sim.exe',
    resolution: '3440 × 1440 (UWQHD)',
    imagePath: '/src/assets/images/game_scene_motorsport_track_1795148172118.jpg',
    defaultFgTech: 'OFF',
    targetBaseFps: 138,
    fgMultiplierNum: 1,
    baseGpuLoad: 84,
    baseCpuLoad: 38,
    baseVramLoad: 54,
    baseRamLoad: 47,
  },
];

export const DEFAULT_OVERLAY_CONFIG: OverlayConfig = {
  position: 'top-right',
  marginX: 20,
  marginY: 16,
  themeId: 'emerald-tactical',
  accentColor: '#10B981',
  fgAccentColor: '#F59E0B',
  textColor: '#F8FAFC',
  bgColor: '#090D16',
  bgOpacity: 0.68,
  fontSize: 13,
  pillPaddingX: 14,
  pillPaddingY: 6,
  showBorder: true,
  clickThrough: true,
  updateIntervalMs: 1000,
  hotkey: 'Ctrl+Shift+O',
  showTotalFps: true,
  showBaseFps: true,
  showGenFps: true,
  showFgStatus: true,
  showGpuLoad: true,
  showCpuLoad: true,
  showVramLoad: true,
  showRamLoad: true,
};
