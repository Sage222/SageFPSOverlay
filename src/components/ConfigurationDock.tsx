import React from 'react';
import {
  COLOR_THEMES,
  DEFAULT_OVERLAY_CONFIG,
  OverlayConfig,
  OverlayPosition,
} from '../types/overlay';
import {
  RotateCcw,
  Eye,
  Lock,
  Palette,
  LayoutGrid,
  Sliders,
  Cpu,
  Clock,
} from 'lucide-react';

interface ConfigurationDockProps {
  config: OverlayConfig;
  onChange: (updated: Partial<OverlayConfig>) => void;
  onReset: () => void;
  overlayVisible: boolean;
  onToggleOverlayVisible: () => void;
}

const POSITIONS: { id: OverlayPosition; label: string; short: string }[] = [
  { id: 'top-left', label: 'Top Left', short: 'TL' },
  { id: 'top-center', label: 'Top Center', short: 'TC' },
  { id: 'top-right', label: 'Top Right', short: 'TR' },
  { id: 'bottom-left', label: 'Bottom Left', short: 'BL' },
  { id: 'bottom-center', label: 'Bottom Center', short: 'BC' },
  { id: 'bottom-right', label: 'Bottom Right', short: 'BR' },
];

export const ConfigurationDock: React.FC<ConfigurationDockProps> = ({
  config,
  onChange,
  onReset,
  overlayVisible,
  onToggleOverlayVisible,
}) => {
  const handleThemeSelect = (themeId: string) => {
    const preset = COLOR_THEMES.find((t) => t.id === themeId);
    if (!preset) return;
    onChange({
      themeId: preset.id,
      accentColor: preset.accentColor,
      fgAccentColor: preset.fgAccentColor,
      textColor: preset.textColor,
      bgColor: preset.bgColor,
    });
  };

  return (
    <aside className="w-full lg:w-[390px] shrink-0 bg-[#111827] border-r border-slate-800/90 flex flex-col h-full overflow-y-auto">
      {/* Header Toolbar */}
      <div className="px-5 py-4 border-b border-slate-800/90 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-100 tracking-tight">
            Overlay Parameters
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Synced directly into compiled Windows .exe
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleOverlayVisible}
            title="Toggle HUD Visibility in Preview (Ctrl+Shift+O)"
            className={`px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              overlayVisible
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20'
                : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{overlayVisible ? 'HUD On' : 'Hidden'}</span>
          </button>
          <button
            type="button"
            onClick={onReset}
            title="Reset to default settings"
            className="p-1.5 rounded-md text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="p-5 space-y-6 flex-1">
        {/* 1. Screen Anchor Position */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-200 flex items-center gap-2">
              <LayoutGrid className="w-3.5 h-3.5 text-emerald-400" />
              <span>Screen Anchor Position</span>
            </label>
            <span className="text-xs text-slate-400 font-mono">
              {POSITIONS.find((p) => p.id === config.position)?.label}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 p-2.5 bg-[#0B0F17] rounded-lg border border-slate-800/90">
            {POSITIONS.map((pos) => {
              const active = config.position === pos.id;
              return (
                <button
                  key={pos.id}
                  type="button"
                  onClick={() => onChange({ position: pos.id })}
                  className={`py-2 px-3 rounded-md text-xs font-medium transition-all flex items-center justify-between whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/50 shadow-sm'
                      : 'bg-slate-900/70 text-slate-400 border border-slate-800/80 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <span>{pos.label}</span>
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      active ? 'bg-emerald-400' : 'bg-slate-700'
                    }`}
                  />
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Horizontal Edge Offset</span>
                <span className="font-mono text-slate-200 tabular-nums">
                  {config.marginX}px
                </span>
              </div>
              <input
                type="range"
                min={4}
                max={64}
                value={config.marginX}
                onChange={(e) => onChange({ marginX: Number(e.target.value) })}
                className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Vertical Edge Offset</span>
                <span className="font-mono text-slate-200 tabular-nums">
                  {config.marginY}px
                </span>
              </div>
              <input
                type="range"
                min={4}
                max={64}
                value={config.marginY}
                onChange={(e) => onChange({ marginY: Number(e.target.value) })}
                className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>
          </div>
        </section>

        <hr className="border-slate-800/80" />

        {/* 2. Color Theme & Translucent Background */}
        <section className="space-y-3.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-200 flex items-center gap-2">
              <Palette className="w-3.5 h-3.5 text-emerald-400" />
              <span>Color Palette & Transparency</span>
            </label>
            <span className="text-xs text-slate-400 font-mono tabular-nums">
              {Math.round(config.bgOpacity * 100)}% Alpha
            </span>
          </div>

          {/* Preset Swatches */}
          <div className="grid grid-cols-1 gap-1.5">
            {COLOR_THEMES.map((theme) => {
              const isSelected = config.themeId === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => handleThemeSelect(theme.id)}
                  className={`px-3 py-2 rounded-md border text-xs flex items-center justify-between transition-colors ${
                    isSelected
                      ? 'bg-slate-800/90 border-emerald-500/50 text-slate-100'
                      : 'bg-[#0B0F17]/70 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <span className="font-medium">{theme.name}</span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-3.5 h-3.5 rounded-sm border border-white/15"
                      style={{ backgroundColor: theme.accentColor }}
                      title="Primary FPS Color"
                    />
                    <span
                      className="w-3.5 h-3.5 rounded-sm border border-white/15"
                      style={{ backgroundColor: theme.fgAccentColor }}
                      title="Generated Frames (+FG) Color"
                    />
                    <span
                      className="w-3.5 h-3.5 rounded-sm border border-white/15"
                      style={{ backgroundColor: theme.bgColor }}
                      title="Backdrop Tint"
                    />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Custom Color Pickers */}
          <div className="grid grid-cols-4 gap-2 pt-1">
            <div className="bg-[#0B0F17] p-2 rounded-md border border-slate-800/80 flex flex-col gap-1">
              <span className="text-[11px] text-slate-400">FPS Accent</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={config.accentColor}
                  onChange={(e) =>
                    onChange({ themeId: 'custom', accentColor: e.target.value })
                  }
                  className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                />
                <span className="text-[11px] font-mono text-slate-300 uppercase">
                  {config.accentColor}
                </span>
              </div>
            </div>

            <div className="bg-[#0B0F17] p-2 rounded-md border border-slate-800/80 flex flex-col gap-1">
              <span className="text-[11px] text-slate-400">FG Accent</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={config.fgAccentColor}
                  onChange={(e) =>
                    onChange({
                      themeId: 'custom',
                      fgAccentColor: e.target.value,
                    })
                  }
                  className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                />
                <span className="text-[11px] font-mono text-slate-300 uppercase">
                  {config.fgAccentColor}
                </span>
              </div>
            </div>

            <div className="bg-[#0B0F17] p-2 rounded-md border border-slate-800/80 flex flex-col gap-1">
              <span className="text-[11px] text-slate-400">Metrics Text</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={config.textColor}
                  onChange={(e) =>
                    onChange({ themeId: 'custom', textColor: e.target.value })
                  }
                  className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                />
                <span className="text-[11px] font-mono text-slate-300 uppercase">
                  {config.textColor}
                </span>
              </div>
            </div>

            <div className="bg-[#0B0F17] p-2 rounded-md border border-slate-800/80 flex flex-col gap-1">
              <span className="text-[11px] text-slate-400">Pill Surface</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={config.bgColor}
                  onChange={(e) =>
                    onChange({ themeId: 'custom', bgColor: e.target.value })
                  }
                  className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                />
                <span className="text-[11px] font-mono text-slate-300 uppercase">
                  {config.bgColor}
                </span>
              </div>
            </div>
          </div>

          {/* Background Opacity & Typography Size */}
          <div className="space-y-3 pt-1">
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Background Opacity (Lightly Transparent)</span>
                <span className="font-mono text-emerald-400 tabular-nums">
                  {Math.round(config.bgOpacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0.15}
                max={0.95}
                step={0.01}
                value={config.bgOpacity}
                onChange={(e) =>
                  onChange({ bgOpacity: parseFloat(e.target.value) })
                }
                className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Font Scale</span>
                  <span className="font-mono text-slate-200 tabular-nums">
                    {config.fontSize}px
                  </span>
                </div>
                <input
                  type="range"
                  min={11}
                  max={18}
                  value={config.fontSize}
                  onChange={(e) =>
                    onChange({ fontSize: Number(e.target.value) })
                  }
                  className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Pill Horizontal Pad</span>
                  <span className="font-mono text-slate-200 tabular-nums">
                    {config.pillPaddingX}px
                  </span>
                </div>
                <input
                  type="range"
                  min={8}
                  max={24}
                  value={config.pillPaddingX}
                  onChange={(e) =>
                    onChange({ pillPaddingX: Number(e.target.value) })
                  }
                  className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          </div>
        </section>

        <hr className="border-slate-800/80" />

        {/* 3. Telemetry Segments in Single-Line Pill Bar */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-200 flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 text-emerald-400" />
              <span>Pill Bar Telemetry Segments</span>
            </label>
            <span className="text-xs text-slate-400">Single-Line Layout</span>
          </div>

          <div className="space-y-1.5">
            {[
              {
                key: 'showTotalFps' as const,
                label: 'Total Output Framerate (FPS)',
                desc: 'Combined base + generated frames presented to display',
              },
              {
                key: 'showBaseFps' as const,
                label: 'Base Rendered Framerate',
                desc: 'True native engine frames before interpolation',
              },
              {
                key: 'showGenFps' as const,
                label: 'Generated Frames per Second (+FG)',
                desc: 'Interpolated frames added by DLSS-G / FSR-FG / AFMF',
              },
              {
                key: 'showFgStatus' as const,
                label: 'Frame Generation Active State',
                desc: 'Displays active FG runtime (DLSS-G, FSR-FG, or OFF)',
              },
              {
                key: 'showGpuLoad' as const,
                label: 'GPU 3D Engine Utilization (%)',
                desc: 'Sampled via Windows GPU Engine performance counter',
              },
              {
                key: 'showVramLoad' as const,
                label: 'GPU Dedicated VRAM Utilization (%)',
                desc: 'Dedicated GPU Adapter Memory usage vs. 64-bit DXGI VRAM capacity',
              },
              {
                key: 'showCpuLoad' as const,
                label: 'CPU Total Processor Load (%)',
                desc: 'Sampled via Windows Processor(_Total) counter',
              },
              {
                key: 'showRamLoad' as const,
                label: 'System Memory (RAM) Utilization (%)',
                desc: 'Physical RAM usage percentage via Win32 GlobalMemoryStatusEx',
              },
            ].map((item) => {
              const checked = config[item.key];
              return (
                <label
                  key={item.key}
                  className={`flex items-start justify-between gap-3 p-2.5 rounded-md border cursor-pointer transition-colors ${
                    checked
                      ? 'bg-[#0B0F17] border-slate-700/90 text-slate-100'
                      : 'bg-[#0B0F17]/40 border-slate-800/60 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="text-xs font-medium">{item.label}</div>
                    <div className="text-[11px] text-slate-400 leading-tight">
                      {item.desc}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onChange({ [item.key]: e.target.checked })}
                    className="mt-0.5 h-4 w-4 rounded border-slate-700 accent-emerald-500 cursor-pointer"
                  />
                </label>
              );
            })}
          </div>
        </section>

        <hr className="border-slate-800/80" />

        {/* 4. Low-Overhead Resource & Portable .INI Governance */}
        <section className="space-y-2.5">
          <label className="text-xs font-semibold text-slate-200 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Portable Config &amp; Resource Governance</span>
          </label>

          <div className="p-3 rounded-lg bg-[#0B0F17] border border-slate-800/90 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">
                Portable Config File
              </span>
              <span className="font-mono text-emerald-400 font-semibold">
                SageFPSOverlay.ini
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Stored in the exact same directory next to{' '}
              <code className="text-slate-300">SageFPSOverlay.exe</code>. All
              system tray changes auto-save to this portable file and reload on
              startup.
            </p>

            <div className="pt-1 flex items-center justify-between gap-2 border-t border-slate-800/80">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.showBorder}
                  onChange={(e) => onChange({ showBorder: e.target.checked })}
                  className="h-3.5 w-3.5 rounded accent-emerald-500"
                />
                <span>Subtle Pill Hairline Border</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.clickThrough}
                  onChange={(e) => onChange({ clickThrough: e.target.checked })}
                  className="h-3.5 w-3.5 rounded accent-emerald-500"
                />
                <span className="flex items-center gap-1">
                  <Lock className="w-3 h-3 text-emerald-400" />
                  Click-Through
                </span>
              </label>
            </div>
          </div>
        </section>
      </div>
    </aside>
  );
};
