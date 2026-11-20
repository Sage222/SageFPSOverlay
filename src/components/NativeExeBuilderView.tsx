import React, { useState, useMemo } from 'react';
import { OverlayConfig } from '../types/overlay';
import {
  generateCSharpSource,
  generatePortableIniConfig,
  generateSelfCompilingBatchScript,
} from '../utils/csharpGenerator';
import {
  Download,
  FileCode,
  FileText,
  Terminal,
  Copy,
  Check,
  ShieldCheck,
  Layers,
  Clock,
} from 'lucide-react';

interface NativeExeBuilderViewProps {
  config: OverlayConfig;
}

export const NativeExeBuilderView: React.FC<NativeExeBuilderViewProps> = ({
  config,
}) => {
  const [activeCodeTab, setActiveCodeTab] = useState<'csharp' | 'ini' | 'batch'>(
    'csharp'
  );
  const [copied, setCopied] = useState(false);
  const [downloadCount, setDownloadCount] = useState(0);

  const csharpCode = useMemo(() => generateCSharpSource(config), [config]);
  const iniCode = useMemo(() => generatePortableIniConfig(config), [config]);
  const batchCode = useMemo(
    () => generateSelfCompilingBatchScript(config),
    [config]
  );

  const displayedCode =
    activeCodeTab === 'csharp'
      ? csharpCode
      : activeCodeTab === 'ini'
      ? iniCode
      : batchCode;

  const triggerDownload = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloadCount((c) => c + 1);
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(displayedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback copy
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0B0F17] p-6 overflow-y-auto">
      <div className="max-w-5xl mx-auto w-full space-y-6">
        {/* Top Builder Banner */}
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
              <ShieldCheck className="w-4 h-4" />
              <span>
                Portable Zero-Install Native Windows 10 / 11 Executable Packager
              </span>
            </div>
            <h1 className="text-xl lg:text-2xl font-bold text-slate-100 tracking-tight font-display">
              Compile Portable{' '}
              <code className="text-emerald-400 font-mono">
                SageFPSOverlay.exe
              </code>
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Your custom overlay configuration (position{' '}
              <code className="text-slate-100 font-mono">{config.position}</code>
              ,{' '}
              <code className="text-slate-100 font-mono">
                {Math.round(config.bgOpacity * 100)}%
              </code>{' '}
              translucent pill background, VRAM &amp; System RAM %, and{' '}
              <code className="text-emerald-400 font-mono">1,000ms</code>{' '}
              hardware polling timer) is saved both inside the executable and to
              a portable{' '}
              <code className="text-emerald-300 font-mono">
                SageFPSOverlay.ini
              </code>{' '}
              file right next to{' '}
              <code className="text-slate-100 font-mono">
                SageFPSOverlay.exe
              </code>
              .
            </p>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0 w-full lg:w-auto">
            <button
              type="button"
              onClick={() =>
                triggerDownload('Build_SageFPSOverlay.bat', batchCode)
              }
              className="px-5 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>Download 1-Click .EXE Builder (.bat)</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  triggerDownload('SageFPSOverlay.cs', csharpCode)
                }
                className="flex-1 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                <span>SageFPSOverlay.cs</span>
              </button>

              <button
                type="button"
                onClick={() => triggerDownload('SageFPSOverlay.ini', iniCode)}
                className="flex-1 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <FileText className="w-3.5 h-3.5 text-amber-400" />
                <span>SageFPSOverlay.ini</span>
              </button>
            </div>
          </div>
        </div>

        {/* 3-Step Execution Guide & Hardware Telemetry Architecture */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#111827] border border-slate-800/90 rounded-lg p-4 space-y-1.5">
            <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5" />
              <span>01. Portable .EXE + .INI Bundle</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Double-click{' '}
              <code className="font-mono text-slate-100">
                Build_SageFPSOverlay.bat
              </code>
              . It compiles{' '}
              <code className="font-mono text-emerald-300">
                SageFPSOverlay.exe
              </code>{' '}
              and creates{' '}
              <code className="font-mono text-slate-100">
                SageFPSOverlay.ini
              </code>{' '}
              in the same folder so your settings stay 100% portable.
            </p>
          </div>

          <div className="bg-[#111827] border border-slate-800/90 rounded-lg p-4 space-y-1.5">
            <div className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              <span>02. FPS, +FG, GPU, VRAM, CPU &amp; RAM</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Tracks <code className="font-mono text-slate-100">Microsoft-Windows-DXGI</code>{' '}
              ETW &amp; Desktop Duplication frames, 64-bit DXGI Dedicated{' '}
              <code className="font-mono text-slate-100">VRAM %</code>, and{' '}
              <code className="font-mono text-slate-100">GlobalMemoryStatusEx</code>{' '}
              System <code className="font-mono text-slate-100">RAM %</code>.
            </p>
          </div>

          <div className="bg-[#111827] border border-slate-800/90 rounded-lg p-4 space-y-1.5">
            <div className="text-xs font-semibold text-sky-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>03. Auto-Saved System Tray Config</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Every change made in the Windows System Tray (position, theme,
              opacity, or toggling VRAM/RAM/FPS metrics) is immediately written
              to <code className="font-mono text-slate-100">SageFPSOverlay.ini</code>.
            </p>
          </div>
        </div>

        {/* Manual Command-Line Compilation Reference */}
        <div className="bg-[#111827] border border-slate-800/90 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="text-xs font-semibold text-slate-200">
              Prefer compiling manually from PowerShell or Command Prompt?
            </div>
            <code className="text-xs font-mono text-emerald-300 block">
              C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe /target:winexe /platform:x64 /optimize+ /out:SageFPSOverlay.exe SageFPSOverlay.cs
            </code>
          </div>
          {downloadCount > 0 && (
            <span className="text-xs text-emerald-400 font-medium whitespace-nowrap shrink-0">
              Package downloaded ({downloadCount})
            </span>
          )}
        </div>

        {/* Live Generated Source Code Inspector */}
        <div className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveCodeTab('csharp')}
                className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-colors whitespace-nowrap shrink-0 ${
                  activeCodeTab === 'csharp'
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                SageFPSOverlay.cs (Win32 C# Source)
              </button>
              <button
                type="button"
                onClick={() => setActiveCodeTab('ini')}
                className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-colors whitespace-nowrap shrink-0 ${
                  activeCodeTab === 'ini'
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                SageFPSOverlay.ini (Portable Config)
              </button>
              <button
                type="button"
                onClick={() => setActiveCodeTab('batch')}
                className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-colors whitespace-nowrap shrink-0 ${
                  activeCodeTab === 'batch'
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Build_SageFPSOverlay.bat (1-Click Builder)
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyCode}
                className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied to Clipboard</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>Copy Source</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto max-h-[540px] leading-relaxed bg-[#080B11]">
            <code>{displayedCode}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
