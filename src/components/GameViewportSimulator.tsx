import React, { useState } from 'react';
import {
  COLOR_THEMES,
  FrameGenTech,
  GameScenePreset,
  GAME_SCENES,
  OverlayConfig,
  OverlayPosition,
  TelemetrySnapshot,
} from '../types/overlay';
import {
  Monitor,
  ChevronUp,
  Check,
  Volume2,
  Wifi,
  ShieldCheck,
  Sliders,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Pause,
  Play,
  Sparkles,
  Layers,
} from 'lucide-react';

interface GameViewportSimulatorProps {
  config: OverlayConfig;
  onChangeConfig: (updated: Partial<OverlayConfig>) => void;
  telemetry: TelemetrySnapshot;
  activeScene: GameScenePreset;
  onSelectScene: (scene: GameScenePreset) => void;
  fgOverride: FrameGenTech | 'AUTO';
  onChangeFgOverride: (tech: FrameGenTech | 'AUTO') => void;
  overlayVisible: boolean;
  onToggleOverlayVisible: () => void;
  pollingPaused: boolean;
  onTogglePollingPaused: () => void;
  onOpenCompilerModal: () => void;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '').trim();
  const r = parseInt(clean.substring(0, 2), 16) || 9;
  const g = parseInt(clean.substring(2, 4), 16) || 13;
  const b = parseInt(clean.substring(4, 6), 16) || 22;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const GameViewportSimulator: React.FC<GameViewportSimulatorProps> = ({
  config,
  onChangeConfig,
  telemetry,
  activeScene,
  onSelectScene,
  fgOverride,
  onChangeFgOverride,
  overlayVisible,
  onToggleOverlayVisible,
  pollingPaused,
  onTogglePollingPaused,
  onOpenCompilerModal,
}) => {
  const [trayMenuOpen, setTrayMenuOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<
    'position' | 'theme' | 'opacity' | 'metrics' | null
  >(null);
  const [imageBroken, setImageBroken] = useState<Record<string, boolean>>({});

  // Compute CSS positioning inside the 16:9 game monitor canvas
  const getOverlayPositionStyle = (): React.CSSProperties => {
    const mx = `${config.marginX}px`;
    const my = `${config.marginY}px`;
    switch (config.position) {
      case 'top-left':
        return { top: my, left: mx };
      case 'top-center':
        return { top: my, left: '50%', transform: 'translateX(-50%)' };
      case 'top-right':
        return { top: my, right: mx };
      case 'bottom-left':
        return { bottom: `calc(40px + ${my})`, left: mx };
      case 'bottom-center':
        return {
          bottom: `calc(40px + ${my})`,
          left: '50%',
          transform: 'translateX(-50%)',
        };
      case 'bottom-right':
        return { bottom: `calc(40px + ${my})`, right: mx };
    }
  };

  // Build visible segments for the compact single-line pill bar
  const segments: { id: string; text: string; color: string }[] = [];

  if (config.showTotalFps) {
    segments.push({
      id: 'total',
      text: `FPS ${telemetry.totalFps}`,
      color: config.accentColor,
    });
  }
  if (config.showBaseFps) {
    segments.push({
      id: 'base',
      text: `BASE ${telemetry.baseFps}`,
      color: config.textColor,
    });
  }
  if (config.showGenFps) {
    segments.push({
      id: 'gen',
      text: telemetry.fgActive ? `+${telemetry.genFps} FG` : '+0 FG',
      color: telemetry.fgActive ? config.fgAccentColor : '#94A3B8',
    });
  }
  if (config.showFgStatus) {
    segments.push({
      id: 'status',
      text: telemetry.fgActive ? `FG: ${telemetry.fgTech}` : 'FG: OFF',
      color: telemetry.fgActive ? config.fgAccentColor : '#94A3B8',
    });
  }
  if (config.showGpuLoad) {
    segments.push({
      id: 'gpu',
      text: `GPU ${telemetry.gpuLoad}%`,
      color: config.textColor,
    });
  }
  if (config.showCpuLoad) {
    segments.push({
      id: 'cpu',
      text: `CPU ${telemetry.cpuLoad}%`,
      color: config.textColor,
    });
  }

  if (segments.length === 0) {
    segments.push({
      id: 'fallback',
      text: `FPS ${telemetry.totalFps}`,
      color: config.accentColor,
    });
  }

  return (
    <div className="flex-1 flex flex-col bg-[#0B0F17] p-5 lg:p-6 overflow-y-auto">
      {/* Top Simulation Control Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-800/90">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-300 mr-1">
            Test Game Process:
          </span>
          <div className="flex items-center gap-1 p-1 bg-[#111827] rounded-lg border border-slate-800">
            {GAME_SCENES.map((scene) => {
              const active = activeScene.id === scene.id;
              return (
                <button
                  key={scene.id}
                  type="button"
                  onClick={() => onSelectScene(scene)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {scene.title}
                </button>
              );
            })}
          </div>
        </div>

        {/* Frame Generation Mode Switcher & 1.0s Polling Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 bg-[#111827] px-2.5 py-1 rounded-lg border border-slate-800">
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs text-slate-400">Frame Gen Hook:</span>
            {(['AUTO', 'DLSS-G', 'FSR-FG', 'AFMF', 'OFF'] as const).map(
              (tech) => (
                <button
                  key={tech}
                  type="button"
                  onClick={() => onChangeFgOverride(tech)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors whitespace-nowrap shrink-0 ${
                    fgOverride === tech
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tech}
                </button>
              )
            )}
          </div>

          <button
            type="button"
            onClick={onTogglePollingPaused}
            className="px-3 py-1.5 rounded-lg bg-[#111827] border border-slate-800 hover:border-slate-700 text-xs text-slate-300 flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
          >
            {pollingPaused ? (
              <>
                <Play className="w-3.5 h-3.5 text-emerald-400" />
                <span>Resume 1.0s Timer</span>
              </>
            ) : (
              <>
                <Pause className="w-3.5 h-3.5 text-slate-400" />
                <span>1.0s Tick #{telemetry.tickCount}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main 16:9 Windows Desktop & Game Viewport Frame */}
      <div className="relative w-full max-w-[1160px] mx-auto aspect-video rounded-xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-950 select-none flex flex-col justify-between">
        {/* Game Render Backdrop Image with Fallback */}
        {!imageBroken[activeScene.id] ? (
          <img
            src={activeScene.imagePath}
            alt={activeScene.title}
            referrerPolicy="no-referrer"
            onError={() =>
              setImageBroken((prev) => ({ ...prev, [activeScene.id]: true }))
            }
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950/40 flex items-center justify-center">
            <div className="text-center space-y-1">
              <Monitor className="w-10 h-10 text-slate-600 mx-auto" />
              <div className="text-sm font-medium text-slate-400">
                {activeScene.title} — DirectX 12 Viewport
              </div>
            </div>
          </div>
        )}

        {/* Subtle Vignette for authentic monitor feel */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/25 pointer-events-none" />

        {/* THE TRANSLUCENT SINGLE-LINE PILL OVERLAY */}
        {overlayVisible && (
          <div
            style={{
              ...getOverlayPositionStyle(),
              backgroundColor: hexToRgba(config.bgColor, config.bgOpacity),
              paddingLeft: `${config.pillPaddingX}px`,
              paddingRight: `${config.pillPaddingX}px`,
              paddingTop: `${config.pillPaddingY}px`,
              paddingBottom: `${config.pillPaddingY}px`,
              fontSize: `${config.fontSize}px`,
              borderColor: config.showBorder
                ? hexToRgba(config.accentColor, 0.38)
                : 'transparent',
              borderWidth: config.showBorder ? '1px' : '0px',
              borderStyle: 'solid',
              backdropFilter: 'blur(6px)',
            }}
            className="absolute z-20 rounded-full flex items-center gap-2.5 font-mono font-semibold tracking-tight tabular-nums shadow-lg transition-all duration-150"
          >
            {segments.map((seg, idx) => (
              <React.Fragment key={seg.id}>
                <span
                  style={{ color: seg.color }}
                  className="whitespace-nowrap shrink-0 leading-none"
                >
                  {seg.text}
                </span>
                {idx < segments.length - 1 && (
                  <span
                    className="text-slate-400/60 select-none leading-none"
                    aria-hidden="true"
                  >
                    ·
                  </span>
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Interactive Windows System Tray Popup Context Menu */}
        {trayMenuOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-12 right-3 z-30 w-72 rounded-lg bg-[#181F2C]/95 backdrop-blur-md border border-slate-700/90 shadow-2xl text-xs text-slate-200 py-1.5 font-sans"
          >
            <div className="px-3 py-1.5 border-b border-slate-700/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: config.accentColor }}
                />
                <span className="font-semibold text-slate-100">
                  FramePulseHUD.exe
                </span>
              </div>
              <span className="text-[11px] font-mono text-emerald-400">
                1.0s Poll
              </span>
            </div>

            {/* Position Submenu Trigger */}
            <div className="py-1">
              <button
                type="button"
                onClick={() =>
                  setActiveSubmenu(
                    activeSubmenu === 'position' ? null : 'position'
                  )
                }
                className="w-full px-3 py-1.5 hover:bg-slate-700/60 flex items-center justify-between text-left"
              >
                <span>Screen Position</span>
                <span className="text-[11px] font-mono text-slate-400">
                  {config.position} ▸
                </span>
              </button>
              {activeSubmenu === 'position' && (
                <div className="bg-[#0F1520] px-2 py-1.5 border-y border-slate-800 grid grid-cols-2 gap-1">
                  {(
                    [
                      ['top-left', 'Top Left'],
                      ['top-center', 'Top Center'],
                      ['top-right', 'Top Right'],
                      ['bottom-left', 'Bottom Left'],
                      ['bottom-center', 'Bottom Center'],
                      ['bottom-right', 'Bottom Right'],
                    ] as [OverlayPosition, string][]
                  ).map(([posKey, posLabel]) => (
                    <button
                      key={posKey}
                      type="button"
                      onClick={() => onChangeConfig({ position: posKey })}
                      className={`px-2 py-1 rounded text-left text-[11px] flex items-center justify-between ${
                        config.position === posKey
                          ? 'bg-emerald-500/20 text-emerald-300 font-medium'
                          : 'text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <span>{posLabel}</span>
                      {config.position === posKey && (
                        <Check className="w-3 h-3" />
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Theme Submenu Trigger */}
              <button
                type="button"
                onClick={() =>
                  setActiveSubmenu(activeSubmenu === 'theme' ? null : 'theme')
                }
                className="w-full px-3 py-1.5 hover:bg-slate-700/60 flex items-center justify-between text-left"
              >
                <span>Color Theme</span>
                <span className="text-[11px] text-slate-400">
                  {COLOR_THEMES.find((t) => t.id === config.themeId)?.name ||
                    'Custom'}{' '}
                  ▸
                </span>
              </button>
              {activeSubmenu === 'theme' && (
                <div className="bg-[#0F1520] px-2 py-1.5 border-y border-slate-800 space-y-1">
                  {COLOR_THEMES.map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() =>
                        onChangeConfig({
                          themeId: theme.id,
                          accentColor: theme.accentColor,
                          fgAccentColor: theme.fgAccentColor,
                          textColor: theme.textColor,
                          bgColor: theme.bgColor,
                        })
                      }
                      className={`w-full px-2 py-1 rounded text-left text-[11px] flex items-center justify-between ${
                        config.themeId === theme.id
                          ? 'bg-emerald-500/20 text-emerald-300 font-medium'
                          : 'text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <span>{theme.name}</span>
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: theme.accentColor }}
                      />
                    </button>
                  ))}
                </div>
              )}

              {/* Opacity Submenu Trigger */}
              <button
                type="button"
                onClick={() =>
                  setActiveSubmenu(
                    activeSubmenu === 'opacity' ? null : 'opacity'
                  )
                }
                className="w-full px-3 py-1.5 hover:bg-slate-700/60 flex items-center justify-between text-left"
              >
                <span>Background Opacity</span>
                <span className="text-[11px] font-mono text-slate-400">
                  {Math.round(config.bgOpacity * 100)}% ▸
                </span>
              </button>
              {activeSubmenu === 'opacity' && (
                <div className="bg-[#0F1520] px-2 py-1.5 border-y border-slate-800 flex items-center justify-between gap-1">
                  {[0.35, 0.5, 0.68, 0.8, 0.92].map((op) => (
                    <button
                      key={op}
                      type="button"
                      onClick={() => onChangeConfig({ bgOpacity: op })}
                      className={`px-2 py-1 rounded text-[11px] font-mono ${
                        Math.abs(config.bgOpacity - op) < 0.03
                          ? 'bg-emerald-500/20 text-emerald-300 font-semibold'
                          : 'text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      {Math.round(op * 100)}%
                    </button>
                  ))}
                </div>
              )}

              {/* Displayed Metrics Trigger */}
              <button
                type="button"
                onClick={() =>
                  setActiveSubmenu(
                    activeSubmenu === 'metrics' ? null : 'metrics'
                  )
                }
                className="w-full px-3 py-1.5 hover:bg-slate-700/60 flex items-center justify-between text-left"
              >
                <span>Displayed Metrics</span>
                <span className="text-[11px] text-slate-400">
                  {segments.length} active ▸
                </span>
              </button>
              {activeSubmenu === 'metrics' && (
                <div className="bg-[#0F1520] px-2.5 py-1.5 border-y border-slate-800 space-y-1">
                  {(
                    [
                      ['showTotalFps', 'Total FPS'],
                      ['showBaseFps', 'Base Rendered FPS'],
                      ['showGenFps', 'Generated Frames (+FG)'],
                      ['showFgStatus', 'Frame Gen Status'],
                      ['showGpuLoad', 'GPU Utilization %'],
                      ['showCpuLoad', 'CPU Utilization %'],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onChangeConfig({ [key]: !config[key] })}
                      className="w-full py-1 text-left text-[11px] flex items-center justify-between text-slate-300 hover:text-white"
                    >
                      <span>{label}</span>
                      {config[key] && (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-slate-700/80 py-1">
              <button
                type="button"
                onClick={() =>
                  onChangeConfig({ clickThrough: !config.clickThrough })
                }
                className="w-full px-3 py-1.5 hover:bg-slate-700/60 flex items-center justify-between text-left"
              >
                <span className="flex items-center gap-1.5">
                  {config.clickThrough ? (
                    <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Unlock className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  <span>Click-Through Lock</span>
                </span>
                {config.clickThrough && (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                )}
              </button>

              <button
                type="button"
                onClick={onToggleOverlayVisible}
                className="w-full px-3 py-1.5 hover:bg-slate-700/60 flex items-center justify-between text-left"
              >
                <span className="flex items-center gap-1.5">
                  {overlayVisible ? (
                    <Eye className="w-3.5 h-3.5 text-slate-300" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                  )}
                  <span>{overlayVisible ? 'Hide Overlay' : 'Show Overlay'}</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  Ctrl+Shift+O
                </span>
              </button>
            </div>

            <div className="border-t border-slate-700/80 pt-1 px-2">
              <button
                type="button"
                onClick={() => {
                  setTrayMenuOpen(false);
                  onOpenCompilerModal();
                }}
                className="w-full py-1.5 px-2.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-center transition-colors"
              >
                Compile This Configuration (.EXE)
              </button>
            </div>
          </div>
        )}

        {/* Top-left subtle process watermark inside viewport */}
        <div className="relative z-10 pointer-events-none p-3 flex items-center justify-between">
          <div />
        </div>

        {/* Simulated Windows 11 Taskbar & System Tray at bottom of monitor */}
        <div className="relative z-20 h-10 bg-[#0B0F17]/90 backdrop-blur-md border-t border-slate-800/90 px-4 flex items-center justify-between text-xs text-slate-300">
          {/* Left: Active Fullscreen Game Process Info */}
          <div className="flex items-center gap-2.5 text-[11px] text-slate-400">
            <span className="font-mono text-slate-200 font-medium">
              {activeScene.processName}
            </span>
            <span aria-hidden="true">·</span>
            <span>{activeScene.resolution}</span>
            <span aria-hidden="true">·</span>
            <span className="text-slate-300">
              {config.clickThrough
                ? 'WS_EX_TRANSPARENT (Mouse Click-Through Active)'
                : 'Interactive Window Mode'}
            </span>
          </div>

          {/* Right: Interactive System Tray Notification Area */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTrayMenuOpen((prev) => !prev)}
              className={`px-2.5 py-1 rounded flex items-center gap-2 text-xs font-medium transition-all cursor-pointer border ${
                trayMenuOpen
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200'
                  : 'bg-slate-800/90 hover:bg-slate-700/90 border-slate-700 text-slate-200'
              }`}
              title="Click to test the Windows System Tray configuration menu"
            >
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: config.accentColor }}
              />
              <span className="whitespace-nowrap">
                FramePulse Tray Config
              </span>
              <ChevronUp
                className={`w-3.5 h-3.5 transition-transform ${
                  trayMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            <div className="hidden sm:flex items-center gap-2.5 pl-2 border-l border-slate-800 text-slate-400">
              <Wifi className="w-3.5 h-3.5" />
              <Volume2 className="w-3.5 h-3.5" />
              <span className="font-mono text-[11px] tabular-nums">
                {telemetry.lastUpdated}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Telemetry Breakdown Bar (Explains exact math & 1.0s polling) */}
      <div className="w-full max-w-[1160px] mx-auto mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-[#111827] border border-slate-800/90 rounded-lg p-3.5 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">Total Output FPS</div>
            <div className="text-xl font-bold font-mono tabular-nums text-slate-100 mt-0.5">
              {telemetry.totalFps} <span className="text-xs font-normal text-slate-400">fps</span>
            </div>
          </div>
          <div className="text-right font-mono text-xs text-slate-400">
            <div>Base: {telemetry.baseFps}</div>
            <div className="text-amber-400">Gen: +{telemetry.genFps}</div>
          </div>
        </div>

        <div className="bg-[#111827] border border-slate-800/90 rounded-lg p-3.5 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">Frame Generation</div>
            <div className="text-sm font-semibold font-mono text-slate-100 mt-1">
              {telemetry.fgActive ? `${telemetry.fgTech} Active` : 'Native Render Only'}
            </div>
          </div>
          <span className="text-xs font-mono text-amber-400 tabular-nums">
            {telemetry.fgMultiplier}
          </span>
        </div>

        <div className="bg-[#111827] border border-slate-800/90 rounded-lg p-3.5 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">Hardware Telemetry</div>
            <div className="text-sm font-semibold font-mono tabular-nums text-slate-100 mt-1">
              GPU {telemetry.gpuLoad}% · CPU {telemetry.cpuLoad}%
            </div>
          </div>
          <span className="text-xs text-slate-400 font-mono">Win32 Counters</span>
        </div>

        <div className="bg-[#111827] border border-slate-800/90 rounded-lg p-3.5 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">Update Overhead</div>
            <div className="text-sm font-semibold font-mono tabular-nums text-emerald-400 mt-1">
              1,000 ms (1.0 Hz)
            </div>
          </div>
          <span className="text-xs text-slate-400 font-mono">&lt;0.05% CPU</span>
        </div>
      </div>
    </div>
  );
};
