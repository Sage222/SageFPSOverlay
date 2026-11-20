/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  DEFAULT_OVERLAY_CONFIG,
  FrameGenTech,
  GAME_SCENES,
  GameScenePreset,
  OverlayConfig,
  TelemetrySnapshot,
} from './types/overlay';
import { ConfigurationDock } from './components/ConfigurationDock';
import { GameViewportSimulator } from './components/GameViewportSimulator';
import { NativeExeBuilderView } from './components/NativeExeBuilderView';
import { generateSelfCompilingBatchScript } from './utils/csharpGenerator';
import { Download } from 'lucide-react';

type ActiveWorkspaceTab = 'simulator' | 'compiler' | 'architecture';

export default function App() {
  const [config, setConfig] = useState<OverlayConfig>(() => {
    try {
      const saved =
        localStorage.getItem('sage_fps_overlay_config_v1') ||
        localStorage.getItem('framepulse_hud_config_v1');
      if (saved) {
        return { ...DEFAULT_OVERLAY_CONFIG, ...JSON.parse(saved) };
      }
    } catch {
      // Fallback to default
    }
    return DEFAULT_OVERLAY_CONFIG;
  });

  const [activeTab, setActiveTab] = useState<ActiveWorkspaceTab>('simulator');
  const [activeScene, setActiveScene] = useState<GameScenePreset>(GAME_SCENES[0]);
  const [fgOverride, setFgOverride] = useState<FrameGenTech | 'AUTO'>('AUTO');
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [pollingPaused, setPollingPaused] = useState(false);

  const [telemetry, setTelemetry] = useState<TelemetrySnapshot>({
    totalFps: 144,
    baseFps: 72,
    genFps: 72,
    fgActive: true,
    fgTech: 'DLSS-G',
    fgMultiplier: '2.0×',
    gpuLoad: 96,
    cpuLoad: 44,
    vramLoad: 82,
    ramLoad: 64,
    processName: GAME_SCENES[0].processName,
    lastUpdated: new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    tickCount: 1,
  });

  // Persist user configuration changes
  useEffect(() => {
    try {
      localStorage.setItem('sage_fps_overlay_config_v1', JSON.stringify(config));
    } catch {
      // Ignore storage errors
    }
  }, [config]);

  // Global Hotkey Simulation: Ctrl + Shift + O toggles overlay visibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        setOverlayVisible((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Strict 1,000ms (1.0 second) low-overhead telemetry update interval
  useEffect(() => {
    if (pollingPaused) return;

    const sampleOnce = () => {
      const effectiveFgTech: FrameGenTech =
        fgOverride === 'AUTO' ? activeScene.defaultFgTech : fgOverride;
      const isFgOn = effectiveFgTech !== 'OFF';

      const jitter = Math.floor(Math.random() * 5) - 2;
      const baseFps = Math.max(24, activeScene.targetBaseFps + jitter);
      const genFps = isFgOn ? baseFps : 0;
      const totalFps = baseFps + genFps;

      const gpuJitter = Math.floor(Math.random() * 3) - 1;
      const cpuJitter = Math.floor(Math.random() * 5) - 2;
      const vramJitter = Math.floor(Math.random() * 3) - 1;

      const gpuLoad = Math.min(99, Math.max(15, activeScene.baseGpuLoad + gpuJitter));
      const cpuLoad = Math.min(99, Math.max(8, activeScene.baseCpuLoad + cpuJitter));
      const vramLoad = Math.min(
        98,
        Math.max(12, activeScene.baseVramLoad + (isFgOn ? 4 : 0) + vramJitter)
      );
      const ramLoad = Math.min(98, Math.max(15, activeScene.baseRamLoad));

      setTelemetry((prev) => ({
        totalFps,
        baseFps,
        genFps,
        fgActive: isFgOn,
        fgTech: effectiveFgTech,
        fgMultiplier: isFgOn ? '2.0× FG' : '1.0× Native',
        gpuLoad,
        cpuLoad,
        vramLoad,
        ramLoad,
        processName: activeScene.processName,
        lastUpdated: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        tickCount: prev.tickCount + 1,
      }));
    };

    sampleOnce();
    const timerId = window.setInterval(sampleOnce, 1000);
    return () => window.clearInterval(timerId);
  }, [activeScene, fgOverride, pollingPaused]);

  const handleUpdateConfig = (updated: Partial<OverlayConfig>) => {
    setConfig((prev) => ({ ...prev, ...updated }));
  };

  const handleResetConfig = () => {
    setConfig(DEFAULT_OVERLAY_CONFIG);
  };

  const handleQuickDownloadExeBuilder = () => {
    const batchScript = generateSelfCompilingBatchScript(config);
    const blob = new Blob([batchScript], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Build_SageFPSOverlay.bat';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0B0F17] text-slate-100">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="flex items-center justify-between gap-8 px-6 py-3.5 bg-[#111827] border-b border-slate-800/90">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('simulator');
          }}
          className="text-lg font-bold tracking-tight text-slate-100 font-display whitespace-nowrap shrink-0"
        >
          SageFPSOverlay
        </a>

        {/* Zone 2: Clean single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
          <a
            href="#simulator"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('simulator');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 py-1 ${
              activeTab === 'simulator'
                ? 'text-slate-100 underline underline-offset-8 decoration-emerald-500 decoration-2'
                : 'hover:text-slate-200'
            }`}
          >
            Overlay Studio
          </a>
          <a
            href="#compiler"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('compiler');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 py-1 ${
              activeTab === 'compiler'
                ? 'text-slate-100 underline underline-offset-8 decoration-emerald-500 decoration-2'
                : 'hover:text-slate-200'
            }`}
          >
            Portable .EXE Compiler
          </a>
          <a
            href="#architecture"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('architecture');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 py-1 ${
              activeTab === 'architecture'
                ? 'text-slate-100 underline underline-offset-8 decoration-emerald-500 decoration-2'
                : 'hover:text-slate-200'
            }`}
          >
            Win32 Telemetry Guide
          </a>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleQuickDownloadExeBuilder}
            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-500 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download SageFPSOverlay .EXE Builder</span>
          </button>
        </div>
      </header>

      {/* Workspace Body: Left Configuration Dock + Main Interactive Viewport */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <ConfigurationDock
          config={config}
          onChange={handleUpdateConfig}
          onReset={handleResetConfig}
          overlayVisible={overlayVisible}
          onToggleOverlayVisible={() => setOverlayVisible((v) => !v)}
        />

        {activeTab === 'simulator' && (
          <GameViewportSimulator
            config={config}
            onChangeConfig={handleUpdateConfig}
            telemetry={telemetry}
            activeScene={activeScene}
            onSelectScene={setActiveScene}
            fgOverride={fgOverride}
            onChangeFgOverride={setFgOverride}
            overlayVisible={overlayVisible}
            onToggleOverlayVisible={() => setOverlayVisible((v) => !v)}
            pollingPaused={pollingPaused}
            onTogglePollingPaused={() => setPollingPaused((p) => !p)}
            onOpenCompilerModal={() => setActiveTab('compiler')}
          />
        )}

        {activeTab === 'compiler' && <NativeExeBuilderView config={config} />}

        {activeTab === 'architecture' && (
          <div className="flex-1 bg-[#0B0F17] p-6 lg:p-8 overflow-y-auto">
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="border-b border-slate-800 pb-4">
                <h1 className="text-2xl font-bold text-slate-100 font-display">
                  SageFPSOverlay — Win32 Telemetry &amp; Portable Architecture
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                  How <code className="font-mono text-slate-200">SageFPSOverlay.exe</code> captures
                  accurate framerate, frame generation, GPU, VRAM, CPU, and RAM metrics on Windows
                  10 &amp; 11 while staying 100% portable.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-2">
                  <h3 className="text-base font-semibold text-slate-100">
                    01. Dual ETW DXGI &amp; Desktop Duplication FPS Engines
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    <code className="font-mono text-slate-200">SageFPSOverlay.exe</code> combines a
                    real-time <code className="font-mono text-emerald-300">Microsoft-Windows-DXGI</code>{' '}
                    ETW <code className="font-mono text-slate-200">Present_Start</code> consumer
                    with a <code className="font-mono text-emerald-300">IDXGIOutput1::DuplicateOutput</code>{' '}
                    frame counter and Win32 <code className="font-mono text-slate-200">CreateToolhelp32Snapshot</code>{' '}
                    module inspection (<code className="font-mono text-slate-200">nvngx_dlssg.dll</code>,{' '}
                    <code className="font-mono text-slate-200">ffx_frameinterpolation</code>) to
                    separate total displayed frames (<code className="font-mono text-emerald-300">FPS</code>)
                    from native engine frames (<code className="font-mono text-slate-200">BASE</code>)
                    and generated frames (<code className="font-mono text-amber-300">+FG</code>).
                  </p>
                </div>

                <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-2">
                  <h3 className="text-base font-semibold text-slate-100">
                    02. 64-Bit VRAM % &amp; System RAM % Telemetry
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Queries total 64-bit dedicated video memory directly from{' '}
                    <code className="font-mono text-emerald-300">
                      IDXGIAdapter::GetDesc (DedicatedVideoMemory)
                    </code>{' '}
                    (bypassing legacy 32-bit 4GB registry caps) and pairs it with Windows{' '}
                    <code className="font-mono text-slate-200">GPU Adapter Memory\Dedicated Usage</code>{' '}
                    counters to calculate <code className="font-mono text-emerald-300">VRAM %</code>.
                    System memory (<code className="font-mono text-emerald-300">RAM %</code>) is
                    sampled directly via Win32{' '}
                    <code className="font-mono text-slate-200">GlobalMemoryStatusEx</code>.
                  </p>
                </div>

                <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-2">
                  <h3 className="text-base font-semibold text-slate-100">
                    03. Portable Configuration File (SageFPSOverlay.ini)
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Instead of writing to the Windows Registry or hidden{' '}
                    <code className="font-mono text-slate-200">%APPDATA%</code> folders,{' '}
                    <code className="font-mono text-slate-200">SageFPSOverlay.exe</code> reads and
                    writes <code className="font-mono text-emerald-300">SageFPSOverlay.ini</code>{' '}
                    in <code className="font-mono text-slate-200">AppDomain.CurrentDomain.BaseDirectory</code>{' '}
                    (the same folder as the <code className="font-mono text-slate-200">.exe</code>).
                    Every toggle in the System Tray immediately updates this file.
                  </p>
                </div>

                <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-2">
                  <h3 className="text-base font-semibold text-slate-100">
                    04. Always-On-Top &amp; 1,000ms Low-Overhead Polling
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    The overlay elevates via UAC on launch so it can overlap elevated/anti-cheat
                    games, asserts <code className="font-mono text-emerald-300">SetWindowPos(HWND_TOPMOST)</code>{' '}
                    without stealing focus, and refreshes all counters strictly once every{' '}
                    <code className="font-mono text-emerald-300">1,000ms</code> for &lt;0.05% CPU
                    overhead.
                  </p>
                </div>
              </div>

              <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-100">
                    Ready to compile your portable SageFPSOverlay executable?
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Inspect the generated C# source, portable .INI config, or download the 1-click
                    Windows compiler script.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('compiler')}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Open Portable .EXE Compiler
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
