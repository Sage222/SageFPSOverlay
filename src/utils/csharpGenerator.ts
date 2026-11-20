import { OverlayConfig, COLOR_THEMES } from '../types/overlay';

function hexToRgbTuple(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) || 0;
    const g = parseInt(clean[1] + clean[1], 16) || 0;
    const b = parseInt(clean[2] + clean[2], 16) || 0;
    return { r, g, b };
  }
  const r = parseInt(clean.substring(0, 2), 16) || 0;
  const g = parseInt(clean.substring(2, 4), 16) || 0;
  const b = parseInt(clean.substring(4, 6), 16) || 0;
  return { r, g, b };
}

/**
 * Generates a complete, standalone, self-compiling C# Win32/WinForms application (SageFPSOverlay.cs)
 * that compiles cleanly with Windows' built-in .NET Framework 4.x csc.exe without external NuGet dependencies.
 */
export function generateCSharpSource(config: OverlayConfig): string {
  const accent = hexToRgbTuple(config.accentColor);
  const fgAccent = hexToRgbTuple(config.fgAccentColor);
  const text = hexToRgbTuple(config.textColor);
  const bg = hexToRgbTuple(config.bgColor);
  const alphaByte = Math.round(Math.min(0.95, Math.max(0.15, config.bgOpacity)) * 255);

  const themesArrayCSharp = COLOR_THEMES.map((t) => {
    const a = hexToRgbTuple(t.accentColor);
    const f = hexToRgbTuple(t.fgAccentColor);
    const tx = hexToRgbTuple(t.textColor);
    const b = hexToRgbTuple(t.bgColor);
    return `new ThemePreset("${t.id}", "${t.name}", Color.FromArgb(${a.r}, ${a.g}, ${a.b}), Color.FromArgb(${f.r}, ${f.g}, ${f.b}), Color.FromArgb(${tx.r}, ${tx.g}, ${tx.b}), Color.FromArgb(${b.r}, ${b.g}, ${b.b}))`;
  }).join(',\n            ');

  return `// ============================================================================
// SageFPSOverlay — Portable Windows Game Framerate & Hardware Telemetry Overlay
// Target: .NET Framework 4.7.2 / 4.8 (64-bit built-in Windows 10/11 csc.exe)
//
// Features:
//  1. Dual Real-Time Game Framerate Engines:
//     - Primary: PresentMon-style ETW consumer (Microsoft-Windows-DXGI, D3D9, DxgKrnl)
//     - Secondary: DXGI Output1 Desktop Duplication (AcquireNextFrame)
//  2. Complete Hardware & Memory Telemetry (Toggleable On/Off):
//     - Total FPS, Base Rendered FPS, Generated Frames (+FG), Frame Gen Status
//     - GPU 3D Utilization %, CPU Utilization %
//     - VRAM Utilization % (Dedicated GPU Adapter Memory / DXGI Adapter Desc)
//     - System RAM Utilization % (Win32 GlobalMemoryStatusEx dwMemoryLoad)
//  3. Portable Settings Persistence:
//     - Reads and saves all customizations automatically to "SageFPSOverlay.ini"
//       stored in the same folder next to "SageFPSOverlay.exe"
//  4. Always-On-Top & 1.0s Low-Overhead Polling:
//     - Strict 1,000ms timer tick + persistent SetWindowPos(HWND_TOPMOST)
// ============================================================================

using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Threading;
using System.Windows.Forms;

namespace SageFPSOverlay
{
    public class ThemePreset
    {
        public string Id;
        public string Name;
        public Color Accent;
        public Color FgAccent;
        public Color Text;
        public Color Background;

        public ThemePreset(string id, string name, Color accent, Color fgAccent, Color text, Color bg)
        {
            Id = id;
            Name = name;
            Accent = accent;
            FgAccent = fgAccent;
            Text = text;
            Background = bg;
        }
    }

    // ========================================================================
    // ENGINE 1: Native Win32 ETW PresentMon-Style DXGI/D3D9/DxgKrnl Consumer
    // ========================================================================
    public static class EtwPresentCounter
    {
        private const string SESSION_NAME = "SageFPSOverlay_DXGI_Session";

        private static readonly Guid DXGI_PROVIDER = new Guid("CA11C036-0102-4A2D-A6AD-F03CFED5D3C9");
        private static readonly Guid D3D9_PROVIDER = new Guid("783ACA0A-790E-4D7F-8451-AA850511C6B9");
        private static readonly Guid DXGKRNL_PROVIDER = new Guid("802EC45A-1E99-4B83-9920-87C98277BA9D");

        private const uint WNODE_FLAG_TRACED_GUID = 0x00020000;
        private const uint EVENT_TRACE_REAL_TIME_MODE = 0x00000100;
        private const uint PROCESS_TRACE_MODE_REAL_TIME = 0x00000100;
        private const uint PROCESS_TRACE_MODE_EVENT_RECORD = 0x10000000;
        private const uint EVENT_CONTROL_CODE_ENABLE_PROVIDER = 1;
        private const uint EVENT_CONTROL_CODE_STOP_TRACE = 1;

        [StructLayout(LayoutKind.Sequential)]
        private struct EVENT_DESCRIPTOR
        {
            public ushort Id;
            public byte Version;
            public byte Channel;
            public byte Level;
            public byte Opcode;
            public ushort Task;
            public ulong Keyword;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct EVENT_HEADER
        {
            public ushort Size;
            public ushort HeaderType;
            public ushort Flags;
            public ushort EventProperty;
            public uint ThreadId;
            public uint ProcessId;
            public long TimeStamp;
            public Guid ProviderId;
            public EVENT_DESCRIPTOR EventDescriptor;
            public ulong ProcessorTime;
            public Guid ActivityId;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct ETW_BUFFER_CONTEXT
        {
            public byte ProcessorNumber;
            public byte Alignment;
            public ushort LoggerId;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct EVENT_RECORD
        {
            public EVENT_HEADER EventHeader;
            public ETW_BUFFER_CONTEXT BufferContext;
            public ushort ExtendedDataCount;
            public ushort UserDataLength;
            public IntPtr ExtendedData;
            public IntPtr UserData;
            public IntPtr UserContext;
        }

        [UnmanagedFunctionPointer(CallingConvention.StdCall)]
        private delegate void EventRecordCallback(ref EVENT_RECORD record);

        [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern uint StartTraceW(out ulong sessionHandle, string sessionName, IntPtr properties);

        [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern uint ControlTraceW(ulong sessionHandle, string sessionName, IntPtr properties, uint controlCode);

        [DllImport("advapi32.dll", SetLastError = true)]
        private static extern uint EnableTraceEx2(
            ulong sessionHandle,
            ref Guid providerId,
            uint controlCode,
            byte level,
            ulong matchAnyKeyword,
            ulong matchAllKeyword,
            uint timeout,
            IntPtr enableParameters
        );

        [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern ulong OpenTraceW(IntPtr logfile);

        [DllImport("advapi32.dll", SetLastError = true)]
        private static extern uint ProcessTrace(ulong[] handleArray, uint handleCount, IntPtr startTime, IntPtr endTime);

        [DllImport("advapi32.dll", SetLastError = true)]
        private static extern uint CloseTrace(ulong traceHandle);

        private static readonly ConcurrentDictionary<uint, int> dxgiPresentsByPid = new ConcurrentDictionary<uint, int>();
        private static readonly ConcurrentDictionary<uint, int> dxgkrnlPresentsByPid = new ConcurrentDictionary<uint, int>();

        private static EventRecordCallback callbackDelegate;
        private static Thread consumerThread;
        private static ulong activeSessionHandle = 0;
        private static ulong activeTraceHandle = 0;
        public static bool IsRunning = false;

        private static IntPtr AllocTraceProperties()
        {
            int totalSize = 1024;
            IntPtr ptr = Marshal.AllocHGlobal(totalSize);
            for (int i = 0; i < totalSize; i++) Marshal.WriteByte(ptr, i, 0);

            Marshal.WriteInt32(ptr, 0, totalSize);
            Marshal.WriteInt32(ptr, 44, (int)WNODE_FLAG_TRACED_GUID);
            Marshal.WriteInt32(ptr, 48, 64);
            Marshal.WriteInt32(ptr, 52, 4);
            Marshal.WriteInt32(ptr, 56, 32);
            Marshal.WriteInt32(ptr, 64, (int)EVENT_TRACE_REAL_TIME_MODE);
            Marshal.WriteInt32(ptr, 68, 1);
            Marshal.WriteInt32(ptr, 116, 120);

            return ptr;
        }

        public static void Start()
        {
            if (consumerThread != null) return;
            callbackDelegate = new EventRecordCallback(OnEtwEventRecord);

            consumerThread = new Thread(TraceWorkerLoop);
            consumerThread.IsBackground = true;
            consumerThread.Name = "SageFPS_ETW_PresentMon";
            consumerThread.Start();
        }

        private static void TraceWorkerLoop()
        {
            IntPtr propsPtr = AllocTraceProperties();
            IntPtr logfilePtr = IntPtr.Zero;
            IntPtr sessionNamePtr = IntPtr.Zero;

            try
            {
                ControlTraceW(0, SESSION_NAME, propsPtr, EVENT_CONTROL_CODE_STOP_TRACE);

                Marshal.FreeHGlobal(propsPtr);
                propsPtr = AllocTraceProperties();

                uint status = StartTraceW(out activeSessionHandle, SESSION_NAME, propsPtr);
                if (status != 0)
                {
                    IsRunning = false;
                    return;
                }

                Guid dxgi = DXGI_PROVIDER;
                Guid d3d9 = D3D9_PROVIDER;
                Guid dxgkrnl = DXGKRNL_PROVIDER;

                EnableTraceEx2(activeSessionHandle, ref dxgi, EVENT_CONTROL_CODE_ENABLE_PROVIDER, 5, 0, 0, 0, IntPtr.Zero);
                EnableTraceEx2(activeSessionHandle, ref d3d9, EVENT_CONTROL_CODE_ENABLE_PROVIDER, 5, 0, 0, 0, IntPtr.Zero);
                EnableTraceEx2(activeSessionHandle, ref dxgkrnl, EVENT_CONTROL_CODE_ENABLE_PROVIDER, 4, 0x1, 0, 0, IntPtr.Zero);

                logfilePtr = Marshal.AllocHGlobal(512);
                for (int i = 0; i < 512; i++) Marshal.WriteByte(logfilePtr, i, 0);

                sessionNamePtr = Marshal.StringToHGlobalUni(SESSION_NAME);
                IntPtr fnPtr = Marshal.GetFunctionPointerForDelegate(callbackDelegate);

                Marshal.WriteIntPtr(logfilePtr, 8, sessionNamePtr);
                Marshal.WriteInt32(logfilePtr, 32, unchecked((int)(PROCESS_TRACE_MODE_REAL_TIME | PROCESS_TRACE_MODE_EVENT_RECORD)));
                Marshal.WriteIntPtr(logfilePtr, 408, fnPtr);

                activeTraceHandle = OpenTraceW(logfilePtr);
                if (activeTraceHandle == 0 || activeTraceHandle == ulong.MaxValue)
                {
                    Marshal.WriteIntPtr(logfilePtr, 392, fnPtr);
                    Marshal.WriteIntPtr(logfilePtr, 400, fnPtr);
                    activeTraceHandle = OpenTraceW(logfilePtr);
                }

                if (activeTraceHandle != 0 && activeTraceHandle != ulong.MaxValue)
                {
                    IsRunning = true;
                    ProcessTrace(new ulong[] { activeTraceHandle }, 1, IntPtr.Zero, IntPtr.Zero);
                }
            }
            catch
            {
                IsRunning = false;
            }
            finally
            {
                if (sessionNamePtr != IntPtr.Zero) Marshal.FreeHGlobal(sessionNamePtr);
                if (logfilePtr != IntPtr.Zero) Marshal.FreeHGlobal(logfilePtr);
                if (propsPtr != IntPtr.Zero) Marshal.FreeHGlobal(propsPtr);
            }
        }

        private static void OnEtwEventRecord(ref EVENT_RECORD record)
        {
            uint pid = record.EventHeader.ProcessId;
            if (pid == 0) return;

            ushort id = record.EventHeader.EventDescriptor.Id;
            byte opcode = record.EventHeader.EventDescriptor.Opcode;
            Guid provider = record.EventHeader.ProviderId;

            if (provider == DXGI_PROVIDER)
            {
                if (id == 42 || (opcode == 1 && id >= 40 && id <= 55))
                {
                    dxgiPresentsByPid.AddOrUpdate(pid, 1, (k, v) => v + 1);
                }
            }
            else if (provider == D3D9_PROVIDER)
            {
                if (id == 1)
                {
                    dxgiPresentsByPid.AddOrUpdate(pid, 1, (k, v) => v + 1);
                }
            }
            else if (provider == DXGKRNL_PROVIDER)
            {
                if (id == 184 || id == 171 || id == 168)
                {
                    dxgkrnlPresentsByPid.AddOrUpdate(pid, 1, (k, v) => v + 1);
                }
            }
        }

        public static void ConsumeProcessFrames(uint targetPid, out int dxgiFrames, out int kernelFlips)
        {
            dxgiFrames = 0;
            kernelFlips = 0;

            if (targetPid > 0)
            {
                int val;
                if (dxgiPresentsByPid.TryRemove(targetPid, out val))
                    dxgiFrames = val;
                if (dxgkrnlPresentsByPid.TryRemove(targetPid, out val))
                    kernelFlips = val;
            }

            if (dxgiFrames == 0)
            {
                int maxFrames = 0;
                uint maxPid = 0;
                foreach (var kv in dxgiPresentsByPid)
                {
                    if (kv.Value > maxFrames)
                    {
                        maxFrames = kv.Value;
                        maxPid = kv.Key;
                    }
                }
                if (maxPid > 0)
                {
                    dxgiFrames = maxFrames;
                    int kVal;
                    if (dxgkrnlPresentsByPid.TryGetValue(maxPid, out kVal))
                        kernelFlips = kVal;
                }
            }

            dxgiPresentsByPid.Clear();
            dxgkrnlPresentsByPid.Clear();
        }

        public static void Stop()
        {
            try
            {
                if (activeTraceHandle != 0 && activeTraceHandle != ulong.MaxValue)
                    CloseTrace(activeTraceHandle);

                IntPtr propsPtr = AllocTraceProperties();
                ControlTraceW(activeSessionHandle, SESSION_NAME, propsPtr, EVENT_CONTROL_CODE_STOP_TRACE);
                Marshal.FreeHGlobal(propsPtr);
            }
            catch { }
        }
    }

    // ========================================================================
    // ENGINE 2: DXGI Desktop Duplication Output1 Frame Counter & Total VRAM Probe
    // ========================================================================
    public static class DxgiDuplicationCounter
    {
        private static readonly Guid IID_IDXGIDevice = new Guid("54ec77fa-1377-44e6-8c32-88fd5f44c84c");
        private static readonly Guid IID_IDXGIOutput1 = new Guid("00cddea8-939b-4b83-a340-a685226666cc");

        [DllImport("d3d11.dll", CallingConvention = CallingConvention.StdCall)]
        private static extern int D3D11CreateDevice(
            IntPtr pAdapter,
            int driverType,
            IntPtr software,
            uint flags,
            IntPtr pFeatureLevels,
            uint featureLevels,
            uint sdkVersion,
            out IntPtr ppDevice,
            out int pFeatureLevel,
            out IntPtr ppImmediateContext
        );

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        private struct DXGI_ADAPTER_DESC
        {
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)]
            public string Description;
            public uint VendorId;
            public uint DeviceId;
            public uint SubSysId;
            public uint Revision;
            public UIntPtr DedicatedVideoMemory;
            public UIntPtr DedicatedSystemMemory;
            public UIntPtr SharedSystemMemory;
            public uint AdapterLuidLow;
            public int AdapterLuidHigh;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct DXGI_OUTDUPL_POINTER_POSITION
        {
            public int X;
            public int Y;
            public int Visible;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct DXGI_OUTDUPL_FRAME_INFO
        {
            public long LastPresentTime;
            public long LastMouseUpdateTime;
            public uint AccumulatedFrames;
            public int RectsCoalesced;
            public int ProtectedContentMaskedOut;
            public int PointerPositionChanged;
            public DXGI_OUTDUPL_POINTER_POSITION PointerPosition;
            public uint TotalMetadataBufferSize;
            public uint PointerShapeBufferSize;
        }

        [UnmanagedFunctionPointer(CallingConvention.StdCall)]
        private delegate int GetAdapterDelegate(IntPtr thisPtr, out IntPtr ppAdapter);

        [UnmanagedFunctionPointer(CallingConvention.StdCall)]
        private delegate int GetAdapterDescDelegate(IntPtr thisPtr, out DXGI_ADAPTER_DESC pDesc);

        [UnmanagedFunctionPointer(CallingConvention.StdCall)]
        private delegate int EnumOutputsDelegate(IntPtr thisPtr, uint outputIndex, out IntPtr ppOutput);

        [UnmanagedFunctionPointer(CallingConvention.StdCall)]
        private delegate int DuplicateOutputDelegate(IntPtr thisPtr, IntPtr pDevice, out IntPtr ppOutputDuplication);

        [UnmanagedFunctionPointer(CallingConvention.StdCall)]
        private delegate int AcquireNextFrameDelegate(IntPtr thisPtr, uint timeoutMs, out DXGI_OUTDUPL_FRAME_INFO pFrameInfo, out IntPtr ppDesktopResource);

        [UnmanagedFunctionPointer(CallingConvention.StdCall)]
        private delegate int ReleaseFrameDelegate(IntPtr thisPtr);

        private static IntPtr d3dDevice = IntPtr.Zero;
        private static IntPtr d3dContext = IntPtr.Zero;
        private static IntPtr outputDupl = IntPtr.Zero;
        private static AcquireNextFrameDelegate acquireNextFrameFn;
        private static ReleaseFrameDelegate releaseFrameFn;

        private static Thread duplThread;
        private static volatile int accumulatedFramesInWindow = 0;
        private static volatile bool running = false;

        // Total Dedicated VRAM in bytes queried directly from DXGI_ADAPTER_DESC (64-bit safe, bypasses 4GB registry cap)
        public static ulong TotalDedicatedVramBytes = 0;

        private static IntPtr GetVTableMethod(IntPtr comObj, int slotIndex)
        {
            IntPtr vtable = Marshal.ReadIntPtr(comObj);
            return Marshal.ReadIntPtr(vtable, slotIndex * IntPtr.Size);
        }

        public static void Start()
        {
            if (duplThread != null) return;
            running = true;
            duplThread = new Thread(DuplicationLoop);
            duplThread.IsBackground = true;
            duplThread.Name = "SageFPS_DXGI_Dupl";
            duplThread.Start();
        }

        private static bool InitDuplication()
        {
            CleanupDuplication();
            try
            {
                int featureLevel;
                int hr = D3D11CreateDevice(IntPtr.Zero, 1, IntPtr.Zero, 0x20, IntPtr.Zero, 0, 7, out d3dDevice, out featureLevel, out d3dContext);
                if (hr < 0 || d3dDevice == IntPtr.Zero) return false;

                IntPtr dxgiDevice = IntPtr.Zero;
                Guid iidDxgiDevice = IID_IDXGIDevice;
                hr = Marshal.QueryInterface(d3dDevice, ref iidDxgiDevice, out dxgiDevice);
                if (hr < 0 || dxgiDevice == IntPtr.Zero) return false;

                var getAdapter = (GetAdapterDelegate)Marshal.GetDelegateForFunctionPointer(GetVTableMethod(dxgiDevice, 7), typeof(GetAdapterDelegate));
                IntPtr dxgiAdapter = IntPtr.Zero;
                hr = getAdapter(dxgiDevice, out dxgiAdapter);
                Marshal.Release(dxgiDevice);
                if (hr < 0 || dxgiAdapter == IntPtr.Zero) return false;

                // Query 64-bit DedicatedVideoMemory from IDXGIAdapter::GetDesc (VTable slot 8)
                try
                {
                    var getDesc = (GetAdapterDescDelegate)Marshal.GetDelegateForFunctionPointer(GetVTableMethod(dxgiAdapter, 8), typeof(GetAdapterDescDelegate));
                    DXGI_ADAPTER_DESC adapterDesc;
                    if (getDesc(dxgiAdapter, out adapterDesc) >= 0)
                    {
                        ulong vram = adapterDesc.DedicatedVideoMemory.ToUInt64();
                        if (vram > TotalDedicatedVramBytes)
                            TotalDedicatedVramBytes = vram;
                    }
                }
                catch { }

                var enumOutputs = (EnumOutputsDelegate)Marshal.GetDelegateForFunctionPointer(GetVTableMethod(dxgiAdapter, 7), typeof(EnumOutputsDelegate));
                IntPtr dxgiOutput = IntPtr.Zero;
                hr = enumOutputs(dxgiAdapter, 0, out dxgiOutput);
                Marshal.Release(dxgiAdapter);
                if (hr < 0 || dxgiOutput == IntPtr.Zero) return false;

                IntPtr dxgiOutput1 = IntPtr.Zero;
                Guid iidOutput1 = IID_IDXGIOutput1;
                hr = Marshal.QueryInterface(dxgiOutput, ref iidOutput1, out dxgiOutput1);
                Marshal.Release(dxgiOutput);
                if (hr < 0 || dxgiOutput1 == IntPtr.Zero) return false;

                var duplicateOutput = (DuplicateOutputDelegate)Marshal.GetDelegateForFunctionPointer(GetVTableMethod(dxgiOutput1, 22), typeof(DuplicateOutputDelegate));
                hr = duplicateOutput(dxgiOutput1, d3dDevice, out outputDupl);
                Marshal.Release(dxgiOutput1);
                if (hr < 0 || outputDupl == IntPtr.Zero) return false;

                acquireNextFrameFn = (AcquireNextFrameDelegate)Marshal.GetDelegateForFunctionPointer(GetVTableMethod(outputDupl, 8), typeof(AcquireNextFrameDelegate));
                releaseFrameFn = (ReleaseFrameDelegate)Marshal.GetDelegateForFunctionPointer(GetVTableMethod(outputDupl, 14), typeof(ReleaseFrameDelegate));
                return true;
            }
            catch
            {
                return false;
            }
        }

        private static void DuplicationLoop()
        {
            while (running)
            {
                if (outputDupl == IntPtr.Zero)
                {
                    if (!InitDuplication())
                    {
                        Thread.Sleep(1000);
                        continue;
                    }
                }

                try
                {
                    DXGI_OUTDUPL_FRAME_INFO info;
                    IntPtr desktopRes = IntPtr.Zero;
                    int hr = acquireNextFrameFn(outputDupl, 100, out info, out desktopRes);

                    if (hr == 0)
                    {
                        if (desktopRes != IntPtr.Zero) Marshal.Release(desktopRes);
                        if (info.LastPresentTime > 0)
                        {
                            int frames = (int)Math.Max(1u, info.AccumulatedFrames);
                            Interlocked.Add(ref accumulatedFramesInWindow, frames);
                        }
                        releaseFrameFn(outputDupl);
                    }
                    else if (hr == unchecked((int)0x887A0027))
                    {
                        // Timeout
                    }
                    else
                    {
                        CleanupDuplication();
                        Thread.Sleep(250);
                    }
                }
                catch
                {
                    CleanupDuplication();
                    Thread.Sleep(500);
                }
            }
        }

        public static int ConsumeAccumulatedFrames()
        {
            return Interlocked.Exchange(ref accumulatedFramesInWindow, 0);
        }

        private static void CleanupDuplication()
        {
            if (outputDupl != IntPtr.Zero) { try { Marshal.Release(outputDupl); } catch { } outputDupl = IntPtr.Zero; }
            if (d3dContext != IntPtr.Zero) { try { Marshal.Release(d3dContext); } catch { } d3dContext = IntPtr.Zero; }
            if (d3dDevice != IntPtr.Zero) { try { Marshal.Release(d3dDevice); } catch { } d3dDevice = IntPtr.Zero; }
        }

        public static void Stop()
        {
            running = false;
            CleanupDuplication();
        }
    }

    // ========================================================================
    // MAIN OVERLAY WINDOW, PORTABLE CONFIG (.INI) & 1-SECOND TELEMETRY CONTROLLER
    // ========================================================================
    public class OverlayForm : Form
    {
        private const int WS_EX_LAYERED = 0x00080000;
        private const int WS_EX_TRANSPARENT = 0x00000020;
        private const int WS_EX_TOPMOST = 0x00000008;
        private const int WS_EX_TOOLWINDOW = 0x00000080;
        private const int WS_EX_NOACTIVATE = 0x08000000;

        private static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
        private const uint SWP_NOSIZE = 0x0001;
        private const uint SWP_NOMOVE = 0x0002;
        private const uint SWP_NOACTIVATE = 0x0010;
        private const uint SWP_SHOWWINDOW = 0x0040;
        private const uint SWP_NOOWNERZORDER = 0x0200;
        private const uint SWP_NOSENDCHANGING = 0x0400;

        private const int WM_HOTKEY = 0x0312;
        private const int HOTKEY_ID_TOGGLE = 9001;
        private const uint MOD_CONTROL = 0x0002;
        private const uint MOD_SHIFT = 0x0004;

        [DllImport("user32.dll")]
        private static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);

        [DllImport("user32.dll")]
        private static extern bool UnregisterHotKey(IntPtr hWnd, int id);

        [DllImport("user32.dll")]
        private static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll")]
        private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

        [DllImport("user32.dll")]
        private static extern int GetWindowLong(IntPtr hwnd, int index);

        [DllImport("user32.dll")]
        private static extern int SetWindowLong(IntPtr hwnd, int index, int newStyle);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

        // Win32 System Memory Utilization % (GlobalMemoryStatusEx)
        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
        private struct MEMORYSTATUSEX
        {
            public uint dwLength;
            public uint dwMemoryLoad;
            public ulong ullTotalPhys;
            public ulong ullAvailPhys;
            public ulong ullTotalPageFile;
            public ulong ullAvailPageFile;
            public ulong ullTotalVirtual;
            public ulong ullAvailVirtual;
            public ulong ullAvailExtendedVirtual;
        }

        [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool GlobalMemoryStatusEx(ref MEMORYSTATUSEX lpBuffer);

        // Process inspection via Win32 Toolhelp32 Snapshot for Frame Generation DLLs
        private const uint TH32CS_SNAPMODULE = 0x00000008;
        private const uint TH32CS_SNAPMODULE32 = 0x00000010;

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
        private struct MODULEENTRY32
        {
            public uint dwSize;
            public uint th32ModuleID;
            public uint th32ProcessID;
            public uint GlblcntUsage;
            public uint ProccntUsage;
            public IntPtr modBaseAddr;
            public uint modBaseSize;
            public IntPtr hModule;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)]
            public string szModule;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)]
            public string szExePath;
        }

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern IntPtr CreateToolhelp32Snapshot(uint dwFlags, uint th32ProcessID);

        [DllImport("kernel32.dll", CharSet = CharSet.Auto)]
        private static extern bool Module32First(IntPtr hSnapshot, ref MODULEENTRY32 lpme);

        [DllImport("kernel32.dll", CharSet = CharSet.Auto)]
        private static extern bool Module32Next(IntPtr hSnapshot, ref MODULEENTRY32 lpme);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool CloseHandle(IntPtr hObject);

        // Portable configuration file path stored directly beside SageFPSOverlay.exe
        private readonly string portableIniPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "SageFPSOverlay.ini");

        // User Configuration State (Defaults set by Web Studio, overridden by SageFPSOverlay.ini if present)
        private string currentPosition = "${config.position}";
        private int marginX = ${config.marginX};
        private int marginY = ${config.marginY};
        private string currentThemeId = "${config.themeId}";
        private Color accentColor = Color.FromArgb(${accent.r}, ${accent.g}, ${accent.b});
        private Color fgAccentColor = Color.FromArgb(${fgAccent.r}, ${fgAccent.g}, ${fgAccent.b});
        private Color textColor = Color.FromArgb(${text.r}, ${text.g}, ${text.b});
        private Color bgColor = Color.FromArgb(${bg.r}, ${bg.g}, ${bg.b});
        private int bgAlpha = ${alphaByte};
        private int fontSizePx = ${config.fontSize};
        private int padX = ${config.pillPaddingX};
        private int padY = ${config.pillPaddingY};
        private bool showBorder = ${config.showBorder ? 'true' : 'false'};
        private bool clickThrough = ${config.clickThrough ? 'true' : 'false'};
        private int pollIntervalMs = ${config.updateIntervalMs};

        // Metric Toggles
        private bool showTotalFps = ${config.showTotalFps ? 'true' : 'false'};
        private bool showBaseFps = ${config.showBaseFps ? 'true' : 'false'};
        private bool showGenFps = ${config.showGenFps ? 'true' : 'false'};
        private bool showFgStatus = ${config.showFgStatus ? 'true' : 'false'};
        private bool showGpuLoad = ${config.showGpuLoad ? 'true' : 'false'};
        private bool showCpuLoad = ${config.showCpuLoad ? 'true' : 'false'};
        private bool showVramLoad = ${config.showVramLoad ? 'true' : 'false'};
        private bool showRamLoad = ${config.showRamLoad ? 'true' : 'false'};

        private string fgModeOverride = "AUTO";

        // Live Telemetry State (Updated strictly once every 1000ms)
        private int currentTotalFps = 0;
        private int currentBaseFps = 0;
        private int currentGenFps = 0;
        private bool isFgActive = false;
        private string fgTechName = "OFF";
        private int currentGpuLoad = 0;
        private int currentCpuLoad = 0;
        private int currentVramLoad = 0;
        private int currentRamLoad = 0;

        // Timers & Counters
        private System.Windows.Forms.Timer telemetryTimer;
        private Stopwatch sampleWatch = new Stopwatch();
        private PerformanceCounter cpuCounter;
        private List<PerformanceCounter> gpu3DCounters = new List<PerformanceCounter>();
        private List<PerformanceCounter> vramUsageCounters = new List<PerformanceCounter>();
        private DateTime lastGpuCounterRefresh = DateTime.MinValue;
        private uint lastTrackedPid = 0;
        private bool lastDetectedFgDll = false;
        private string lastDetectedFgTech = "OFF";

        // System Tray UI
        private NotifyIcon trayIcon;
        private ContextMenuStrip trayMenu;

        private readonly ThemePreset[] themes = new ThemePreset[]
        {
            ${themesArrayCSharp}
        };

        public OverlayForm()
        {
            // Load saved portable settings from SageFPSOverlay.ini next to the .exe (or create it on first run)
            LoadPortableSettings();

            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.Manual;
            TopMost = true;
            ShowInTaskbar = false;
            DoubleBuffered = true;

            BackColor = Color.FromArgb(1, 2, 3);
            TransparencyKey = Color.FromArgb(1, 2, 3);
            Opacity = Math.Min(0.98, Math.Max(0.15, bgAlpha / 255.0));

            Width = 640;
            Height = 44;

            // Start both real-time frame capture engines
            EtwPresentCounter.Start();
            DxgiDuplicationCounter.Start();

            InitializeCounters();
            InitializeSystemTray();
            UpdateWindowPosition();
            EnforceTopMostZOrder();

            RegisterHotKey(this.Handle, HOTKEY_ID_TOGGLE, MOD_CONTROL | MOD_SHIFT, (uint)Keys.O);

            sampleWatch.Start();

            // Strict 1-second (1000ms) low-overhead telemetry update timer
            telemetryTimer = new System.Windows.Forms.Timer();
            telemetryTimer.Interval = pollIntervalMs;
            telemetryTimer.Tick += (s, e) => SampleTelemetryOnce();
            telemetryTimer.Start();
        }

        private static string ColorToHex(Color c)
        {
            return string.Format("#{0:X2}{1:X2}{2:X2}", c.R, c.G, c.B);
        }

        private static Color ParseHexColor(string hex, Color fallback)
        {
            if (string.IsNullOrEmpty(hex)) return fallback;
            string clean = hex.Trim().TrimStart('#');
            if (clean.Length != 6) return fallback;
            int r, g, b;
            if (int.TryParse(clean.Substring(0, 2), NumberStyles.HexNumber, CultureInfo.InvariantCulture, out r) &&
                int.TryParse(clean.Substring(2, 2), NumberStyles.HexNumber, CultureInfo.InvariantCulture, out g) &&
                int.TryParse(clean.Substring(4, 2), NumberStyles.HexNumber, CultureInfo.InvariantCulture, out b))
            {
                return Color.FromArgb(r, g, b);
            }
            return fallback;
        }

        private void LoadPortableSettings()
        {
            try
            {
                if (!File.Exists(portableIniPath))
                {
                    SavePortableSettings();
                    return;
                }

                string[] lines = File.ReadAllLines(portableIniPath);
                foreach (string rawLine in lines)
                {
                    string line = rawLine.Trim();
                    if (line.Length == 0 || line.StartsWith("#") || line.StartsWith(";") || line.StartsWith("["))
                        continue;

                    int eq = line.IndexOf('=');
                    if (eq <= 0) continue;

                    string key = line.Substring(0, eq).Trim();
                    string val = line.Substring(eq + 1).Trim();

                    int intVal;
                    bool boolVal;

                    switch (key)
                    {
                        case "Position":
                            currentPosition = val;
                            break;
                        case "MarginX":
                            if (int.TryParse(val, out intVal)) marginX = Math.Max(0, Math.Min(200, intVal));
                            break;
                        case "MarginY":
                            if (int.TryParse(val, out intVal)) marginY = Math.Max(0, Math.Min(200, intVal));
                            break;
                        case "ThemeId":
                            currentThemeId = val;
                            break;
                        case "AccentColor":
                            accentColor = ParseHexColor(val, accentColor);
                            break;
                        case "FgAccentColor":
                            fgAccentColor = ParseHexColor(val, fgAccentColor);
                            break;
                        case "TextColor":
                            textColor = ParseHexColor(val, textColor);
                            break;
                        case "BgColor":
                            bgColor = ParseHexColor(val, bgColor);
                            break;
                        case "BgAlpha":
                            if (int.TryParse(val, out intVal)) bgAlpha = Math.Max(38, Math.Min(250, intVal));
                            break;
                        case "FontSizePx":
                            if (int.TryParse(val, out intVal)) fontSizePx = Math.Max(10, Math.Min(24, intVal));
                            break;
                        case "PadX":
                            if (int.TryParse(val, out intVal)) padX = Math.Max(6, Math.Min(32, intVal));
                            break;
                        case "PadY":
                            if (int.TryParse(val, out intVal)) padY = Math.Max(2, Math.Min(20, intVal));
                            break;
                        case "ShowBorder":
                            if (bool.TryParse(val, out boolVal)) showBorder = boolVal;
                            break;
                        case "ClickThrough":
                            if (bool.TryParse(val, out boolVal)) clickThrough = boolVal;
                            break;
                        case "FgModeOverride":
                            fgModeOverride = val;
                            break;
                        case "ShowTotalFps":
                            if (bool.TryParse(val, out boolVal)) showTotalFps = boolVal;
                            break;
                        case "ShowBaseFps":
                            if (bool.TryParse(val, out boolVal)) showBaseFps = boolVal;
                            break;
                        case "ShowGenFps":
                            if (bool.TryParse(val, out boolVal)) showGenFps = boolVal;
                            break;
                        case "ShowFgStatus":
                            if (bool.TryParse(val, out boolVal)) showFgStatus = boolVal;
                            break;
                        case "ShowGpuLoad":
                            if (bool.TryParse(val, out boolVal)) showGpuLoad = boolVal;
                            break;
                        case "ShowCpuLoad":
                            if (bool.TryParse(val, out boolVal)) showCpuLoad = boolVal;
                            break;
                        case "ShowVramLoad":
                            if (bool.TryParse(val, out boolVal)) showVramLoad = boolVal;
                            break;
                        case "ShowRamLoad":
                            if (bool.TryParse(val, out boolVal)) showRamLoad = boolVal;
                            break;
                    }
                }
            }
            catch { }
        }

        private void SavePortableSettings()
        {
            try
            {
                List<string> lines = new List<string>
                {
                    "; SageFPSOverlay Portable Configuration File",
                    "; Stored next to SageFPSOverlay.exe so your settings travel with the executable.",
                    "[Overlay]",
                    "Position=" + currentPosition,
                    "MarginX=" + marginX,
                    "MarginY=" + marginY,
                    "ThemeId=" + currentThemeId,
                    "AccentColor=" + ColorToHex(accentColor),
                    "FgAccentColor=" + ColorToHex(fgAccentColor),
                    "TextColor=" + ColorToHex(textColor),
                    "BgColor=" + ColorToHex(bgColor),
                    "BgAlpha=" + bgAlpha,
                    "FontSizePx=" + fontSizePx,
                    "PadX=" + padX,
                    "PadY=" + padY,
                    "ShowBorder=" + showBorder.ToString(),
                    "ClickThrough=" + clickThrough.ToString(),
                    "FgModeOverride=" + fgModeOverride,
                    "",
                    "[Metrics]",
                    "ShowTotalFps=" + showTotalFps.ToString(),
                    "ShowBaseFps=" + showBaseFps.ToString(),
                    "ShowGenFps=" + showGenFps.ToString(),
                    "ShowFgStatus=" + showFgStatus.ToString(),
                    "ShowGpuLoad=" + showGpuLoad.ToString(),
                    "ShowCpuLoad=" + showCpuLoad.ToString(),
                    "ShowVramLoad=" + showVramLoad.ToString(),
                    "ShowRamLoad=" + showRamLoad.ToString()
                };
                File.WriteAllLines(portableIniPath, lines.ToArray());
            }
            catch { }
        }

        protected override CreateParams CreateParams
        {
            get
            {
                CreateParams cp = base.CreateParams;
                cp.ExStyle |= WS_EX_TOPMOST | WS_EX_LAYERED | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE;
                if (clickThrough)
                {
                    cp.ExStyle |= WS_EX_TRANSPARENT;
                }
                return cp;
            }
        }

        protected override bool ShowWithoutActivation
        {
            get { return true; }
        }

        private void EnforceTopMostZOrder()
        {
            if (!this.Visible || this.IsDisposed) return;
            try
            {
                SetWindowPos(
                    this.Handle,
                    HWND_TOPMOST,
                    0, 0, 0, 0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW | SWP_NOOWNERZORDER | SWP_NOSENDCHANGING
                );
            }
            catch { }
        }

        private void ApplyClickThroughState()
        {
            int exStyle = GetWindowLong(this.Handle, -20);
            int targetStyle = exStyle | WS_EX_TOPMOST | WS_EX_LAYERED | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE;
            if (clickThrough)
                targetStyle |= WS_EX_TRANSPARENT;
            else
                targetStyle &= ~WS_EX_TRANSPARENT;

            SetWindowLong(this.Handle, -20, targetStyle);
            EnforceTopMostZOrder();
        }

        private void InitializeCounters()
        {
            try
            {
                cpuCounter = new PerformanceCounter("Processor", "% Processor Time", "_Total", true);
                cpuCounter.NextValue();
            }
            catch { }

            RefreshGpuAndVramCounters();
        }

        private void RefreshGpuAndVramCounters()
        {
            if ((DateTime.UtcNow - lastGpuCounterRefresh).TotalSeconds < 25 && gpu3DCounters.Count > 0)
                return;

            lastGpuCounterRefresh = DateTime.UtcNow;

            foreach (var c in gpu3DCounters) { try { c.Dispose(); } catch { } }
            gpu3DCounters.Clear();

            try
            {
                PerformanceCounterCategory cat = new PerformanceCounterCategory("GPU Engine");
                string[] instances = cat.GetInstanceNames();
                foreach (string inst in instances)
                {
                    if (inst.IndexOf("engtype_3D", StringComparison.OrdinalIgnoreCase) >= 0 ||
                        inst.IndexOf("engtype_Graphics", StringComparison.OrdinalIgnoreCase) >= 0)
                    {
                        PerformanceCounter pc = new PerformanceCounter("GPU Engine", "Utilization Percentage", inst, true);
                        pc.NextValue();
                        gpu3DCounters.Add(pc);
                    }
                }
            }
            catch { }

            if (vramUsageCounters.Count == 0)
            {
                try
                {
                    PerformanceCounterCategory memCat = new PerformanceCounterCategory("GPU Adapter Memory");
                    string[] memInstances = memCat.GetInstanceNames();
                    foreach (string inst in memInstances)
                    {
                        PerformanceCounter pc = new PerformanceCounter("GPU Adapter Memory", "Dedicated Usage", inst, true);
                        pc.NextValue();
                        vramUsageCounters.Add(pc);
                    }
                }
                catch { }
            }
        }

        private void InspectProcessForFrameGenModules(uint pid)
        {
            if (pid == lastTrackedPid && pid != 0) return;
            lastTrackedPid = pid;
            lastDetectedFgDll = false;
            lastDetectedFgTech = "OFF";

            if (pid == 0) return;

            IntPtr snap = IntPtr.Zero;
            try
            {
                snap = CreateToolhelp32Snapshot(TH32CS_SNAPMODULE | TH32CS_SNAPMODULE32, pid);
                if (snap != IntPtr.Zero && snap != new IntPtr(-1))
                {
                    MODULEENTRY32 me = new MODULEENTRY32();
                    me.dwSize = (uint)Marshal.SizeOf(typeof(MODULEENTRY32));
                    if (Module32First(snap, ref me))
                    {
                        do
                        {
                            string mod = (me.szModule ?? "").ToLowerInvariant();
                            if (mod.Contains("nvngx_dlssg") || mod.Contains("dlssg") || mod.Contains("sl.dlss_g"))
                            {
                                lastDetectedFgDll = true;
                                lastDetectedFgTech = "DLSS-G";
                                break;
                            }
                            if (mod.Contains("fsr3") || mod.Contains("framegeneration") || mod.Contains("ffx_frameinterpolation") || mod.Contains("amd_fidelityfx_framegeneration"))
                            {
                                lastDetectedFgDll = true;
                                lastDetectedFgTech = "FSR-FG";
                                break;
                            }
                            if (mod.Contains("afmf") || mod.Contains("fluidmotion") || mod.Contains("smoothmotion"))
                            {
                                lastDetectedFgDll = true;
                                lastDetectedFgTech = "AFMF";
                                break;
                            }
                        } while (Module32Next(snap, ref me));
                    }
                }
            }
            catch { }
            finally
            {
                if (snap != IntPtr.Zero && snap != new IntPtr(-1))
                    CloseHandle(snap);
            }
        }

        private void SampleTelemetryOnce()
        {
            double elapsedSec = sampleWatch.Elapsed.TotalSeconds;
            if (elapsedSec < 0.25) elapsedSec = 1.0;
            sampleWatch.Restart();

            // 1. Sample CPU Load %
            try
            {
                if (cpuCounter != null)
                {
                    currentCpuLoad = (int)Math.Round(Math.Min(100f, Math.Max(0f, cpuCounter.NextValue())));
                }
            }
            catch { }

            // 2. Sample System Memory (RAM) Utilization % via GlobalMemoryStatusEx
            try
            {
                MEMORYSTATUSEX memStatus = new MEMORYSTATUSEX();
                memStatus.dwLength = (uint)Marshal.SizeOf(typeof(MEMORYSTATUSEX));
                if (GlobalMemoryStatusEx(ref memStatus))
                {
                    currentRamLoad = (int)Math.Min(100u, Math.Max(0u, memStatus.dwMemoryLoad));
                }
            }
            catch { }

            // 3. Identify Foreground Game PID & Sample 3D GPU Engine + VRAM Utilization %
            uint fgPid = 0;
            try
            {
                IntPtr fgHwnd = GetForegroundWindow();
                if (fgHwnd != IntPtr.Zero && fgHwnd != this.Handle)
                {
                    GetWindowThreadProcessId(fgHwnd, out fgPid);
                    if (fgPid > 0)
                    {
                        InspectProcessForFrameGenModules(fgPid);
                    }
                }
            }
            catch { }

            float fgProcessGpuLoad = 0f;
            try
            {
                RefreshGpuAndVramCounters();
                float totalGpu = 0f;
                string pidToken = fgPid > 0 ? ("pid_" + fgPid + "_") : "";

                for (int i = gpu3DCounters.Count - 1; i >= 0; i--)
                {
                    try
                    {
                        float val = gpu3DCounters[i].NextValue();
                        totalGpu += val;
                        if (pidToken.Length > 0 &&
                            gpu3DCounters[i].InstanceName.IndexOf(pidToken, StringComparison.OrdinalIgnoreCase) >= 0)
                        {
                            fgProcessGpuLoad += val;
                        }
                    }
                    catch
                    {
                        gpu3DCounters.RemoveAt(i);
                    }
                }
                currentGpuLoad = (int)Math.Round(Math.Min(100f, Math.Max(0f, totalGpu)));

                // Sample Dedicated VRAM Usage across GPU Adapter Memory instances
                ulong maxAdapterVramUsed = 0;
                for (int i = vramUsageCounters.Count - 1; i >= 0; i--)
                {
                    try
                    {
                        ulong usedBytes = (ulong)Math.Max(0f, vramUsageCounters[i].NextValue());
                        if (usedBytes > maxAdapterVramUsed)
                            maxAdapterVramUsed = usedBytes;
                    }
                    catch
                    {
                        vramUsageCounters.RemoveAt(i);
                    }
                }

                ulong totalVramBytes = DxgiDuplicationCounter.TotalDedicatedVramBytes;
                if (totalVramBytes > 0 && maxAdapterVramUsed > 0)
                {
                    currentVramLoad = (int)Math.Round(Math.Min(100.0, (maxAdapterVramUsed * 100.0) / totalVramBytes));
                }
            }
            catch { }

            // 4. Consume Real Frame Counts from Engine 1 (ETW DXGI/DxgKrnl) and Engine 2 (DXGI Output1 Duplication)
            int etwDxgiFrames = 0;
            int etwKernelFlips = 0;
            EtwPresentCounter.ConsumeProcessFrames(fgPid, out etwDxgiFrames, out etwKernelFlips);

            int duplFrames = DxgiDuplicationCounter.ConsumeAccumulatedFrames();

            int etwFps = (int)Math.Round(etwDxgiFrames / elapsedSec);
            int kernelFps = (int)Math.Round(etwKernelFlips / elapsedSec);
            int duplFps = (int)Math.Round(duplFrames / elapsedSec);

            int measuredTotalFps = 0;
            if (etwFps > 0)
            {
                measuredTotalFps = etwFps;
            }
            else if (duplFps > 0)
            {
                measuredTotalFps = duplFps;
            }
            else if (kernelFps > 0)
            {
                measuredTotalFps = kernelFps;
            }

            currentTotalFps = Math.Min(999, Math.Max(0, measuredTotalFps));

            // 5. Split Base Rendered FPS vs Generated Frames (+FG)
            int fgMult = 1;
            if (fgModeOverride == "2X")
            {
                isFgActive = true;
                fgTechName = lastDetectedFgDll ? lastDetectedFgTech : "FG-2X";
                fgMult = 2;
            }
            else if (fgModeOverride == "3X")
            {
                isFgActive = true;
                fgTechName = lastDetectedFgDll ? lastDetectedFgTech : "FG-3X";
                fgMult = 3;
            }
            else if (fgModeOverride == "4X")
            {
                isFgActive = true;
                fgTechName = lastDetectedFgDll ? lastDetectedFgTech : "FG-4X";
                fgMult = 4;
            }
            else if (fgModeOverride == "OFF")
            {
                isFgActive = false;
                fgTechName = "OFF";
                fgMult = 1;
            }
            else
            {
                if (etwFps > 15 && duplFps >= (int)(etwFps * 1.45))
                {
                    isFgActive = true;
                    fgTechName = lastDetectedFgDll ? lastDetectedFgTech : "FG-2X";
                    currentTotalFps = duplFps;
                    currentBaseFps = etwFps;
                    currentGenFps = Math.Max(0, currentTotalFps - currentBaseFps);
                    fgMult = 0;
                }
                else if (lastDetectedFgDll && currentTotalFps > 20 && (fgProcessGpuLoad > 10f || currentGpuLoad > 20))
                {
                    isFgActive = true;
                    fgTechName = lastDetectedFgTech;
                    fgMult = 2;
                }
                else
                {
                    isFgActive = false;
                    fgTechName = "OFF";
                    fgMult = 1;
                }
            }

            if (fgMult > 1)
            {
                currentBaseFps = currentTotalFps > 0 ? Math.Max(1, (int)Math.Round((double)currentTotalFps / fgMult)) : 0;
                currentGenFps = Math.Max(0, currentTotalFps - currentBaseFps);
            }
            else if (fgMult == 1)
            {
                currentBaseFps = currentTotalFps;
                currentGenFps = 0;
            }

            EnforceTopMostZOrder();
            Invalidate();
        }

        private List<KeyValuePair<string, Color>> BuildSegments()
        {
            var segments = new List<KeyValuePair<string, Color>>();

            if (showTotalFps)
                segments.Add(new KeyValuePair<string, Color>("FPS " + currentTotalFps, accentColor));

            if (showBaseFps)
                segments.Add(new KeyValuePair<string, Color>("BASE " + currentBaseFps, textColor));

            if (showGenFps)
            {
                string genText = isFgActive ? ("+" + currentGenFps + " FG") : "+0 FG";
                segments.Add(new KeyValuePair<string, Color>(genText, isFgActive ? fgAccentColor : Color.FromArgb(148, 163, 184)));
            }

            if (showFgStatus)
            {
                string statusText = isFgActive ? ("FG: " + fgTechName) : "FG: OFF";
                segments.Add(new KeyValuePair<string, Color>(statusText, isFgActive ? fgAccentColor : Color.FromArgb(148, 163, 184)));
            }

            if (showGpuLoad)
                segments.Add(new KeyValuePair<string, Color>("GPU " + currentGpuLoad + "%", textColor));

            if (showVramLoad)
                segments.Add(new KeyValuePair<string, Color>("VRAM " + currentVramLoad + "%", textColor));

            if (showCpuLoad)
                segments.Add(new KeyValuePair<string, Color>("CPU " + currentCpuLoad + "%", textColor));

            if (showRamLoad)
                segments.Add(new KeyValuePair<string, Color>("RAM " + currentRamLoad + "%", textColor));

            if (segments.Count == 0)
                segments.Add(new KeyValuePair<string, Color>("FPS " + currentTotalFps, accentColor));

            return segments;
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            Graphics g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;

            var segments = BuildSegments();

            using (Font font = new Font("Consolas", fontSizePx * 0.78f, FontStyle.Bold))
            {
                string sep = "  ·  ";
                SizeF sepSize = g.MeasureString(sep, font);

                float totalTextWidth = 0f;
                float maxHeight = 0f;

                for (int i = 0; i < segments.Count; i++)
                {
                    SizeF sz = g.MeasureString(segments[i].Key, font);
                    totalTextWidth += sz.Width;
                    if (sz.Height > maxHeight) maxHeight = sz.Height;
                    if (i < segments.Count - 1) totalTextWidth += sepSize.Width * 0.65f;
                }

                int pillWidth = (int)Math.Ceiling(totalTextWidth + (padX * 2) + 8);
                int pillHeight = (int)Math.Ceiling(maxHeight + (padY * 2));

                if (this.Width != pillWidth + 4 || this.Height != pillHeight + 4)
                {
                    this.Width = pillWidth + 4;
                    this.Height = pillHeight + 4;
                    UpdateWindowPosition();
                }

                Rectangle pillRect = new Rectangle(1, 1, pillWidth, pillHeight);
                int radius = pillHeight / 2;

                using (GraphicsPath path = CreateRoundedPillPath(pillRect, radius))
                {
                    using (SolidBrush bgBrush = new SolidBrush(bgColor))
                    {
                        g.FillPath(bgBrush, path);
                    }

                    if (showBorder)
                    {
                        using (Pen borderPen = new Pen(Color.FromArgb(90, accentColor), 1.2f))
                        {
                            g.DrawPath(borderPen, path);
                        }
                    }
                }

                float curX = 1 + padX;
                float curY = 1 + (pillHeight - maxHeight) / 2f;

                using (SolidBrush sepBrush = new SolidBrush(Color.FromArgb(130, 148, 163, 184)))
                {
                    for (int i = 0; i < segments.Count; i++)
                    {
                        using (SolidBrush segBrush = new SolidBrush(segments[i].Value))
                        {
                            g.DrawString(segments[i].Key, font, segBrush, curX, curY);
                        }
                        SizeF sz = g.MeasureString(segments[i].Key, font);
                        curX += sz.Width - 2f;

                        if (i < segments.Count - 1)
                        {
                            g.DrawString("·", font, sepBrush, curX + 2f, curY);
                            curX += sepSize.Width * 0.65f;
                        }
                    }
                }
            }
        }

        private GraphicsPath CreateRoundedPillPath(Rectangle rect, int radius)
        {
            GraphicsPath path = new GraphicsPath();
            int d = Math.Max(4, Math.Min(radius * 2, rect.Height));
            path.AddArc(rect.X, rect.Y, d, d, 180, 90);
            path.AddArc(rect.Right - d, rect.Y, d, d, 270, 90);
            path.AddArc(rect.Right - d, rect.Bottom - d, d, d, 0, 90);
            path.AddArc(rect.X, rect.Bottom - d, d, d, 90, 90);
            path.CloseFigure();
            return path;
        }

        private void UpdateWindowPosition()
        {
            Rectangle screen = Screen.PrimaryScreen.Bounds;
            int x = marginX;
            int y = marginY;

            switch (currentPosition)
            {
                case "top-left":
                    x = screen.Left + marginX;
                    y = screen.Top + marginY;
                    break;
                case "top-center":
                    x = screen.Left + (screen.Width - this.Width) / 2;
                    y = screen.Top + marginY;
                    break;
                case "top-right":
                    x = screen.Right - this.Width - marginX;
                    y = screen.Top + marginY;
                    break;
                case "bottom-left":
                    x = screen.Left + marginX;
                    y = screen.Bottom - this.Height - marginY;
                    break;
                case "bottom-center":
                    x = screen.Left + (screen.Width - this.Width) / 2;
                    y = screen.Bottom - this.Height - marginY;
                    break;
                case "bottom-right":
                    x = screen.Right - this.Width - marginX;
                    y = screen.Bottom - this.Height - marginY;
                    break;
            }

            this.Location = new Point(x, y);
            EnforceTopMostZOrder();
        }

        private Icon CreateTrayIconGraphic()
        {
            Bitmap bmp = new Bitmap(16, 16);
            using (Graphics g = Graphics.FromImage(bmp))
            {
                g.SmoothingMode = SmoothingMode.AntiAlias;
                g.Clear(Color.Transparent);
                using (SolidBrush b = new SolidBrush(Color.FromArgb(15, 23, 42)))
                {
                    g.FillRectangle(b, 1, 2, 14, 12);
                }
                using (Pen p = new Pen(accentColor, 1.5f))
                {
                    g.DrawRectangle(p, 1, 2, 13, 11);
                }
                using (SolidBrush dot = new SolidBrush(accentColor))
                {
                    g.FillEllipse(dot, 5, 5, 6, 6);
                }
            }
            return Icon.FromHandle(bmp.GetHicon());
        }

        private void InitializeSystemTray()
        {
            trayMenu = new ContextMenuStrip();

            ToolStripMenuItem headerItem = new ToolStripMenuItem("SageFPSOverlay (Portable · 1.0s Poll)");
            headerItem.Enabled = false;
            trayMenu.Items.Add(headerItem);
            trayMenu.Items.Add(new ToolStripSeparator());

            // 1. Position Submenu
            ToolStripMenuItem posMenu = new ToolStripMenuItem("Screen Position");
            string[,] positions = new string[,] {
                { "top-left", "Top Left" },
                { "top-center", "Top Center" },
                { "top-right", "Top Right" },
                { "bottom-left", "Bottom Left" },
                { "bottom-center", "Bottom Center" },
                { "bottom-right", "Bottom Right" }
            };
            for (int i = 0; i < positions.GetLength(0); i++)
            {
                string posKey = positions[i, 0];
                string posLabel = positions[i, 1];
                ToolStripMenuItem item = new ToolStripMenuItem(posLabel);
                item.Checked = (currentPosition == posKey);
                item.Click += (s, e) =>
                {
                    currentPosition = posKey;
                    foreach (ToolStripMenuItem child in posMenu.DropDownItems)
                        child.Checked = (child == item);
                    SavePortableSettings();
                    UpdateWindowPosition();
                };
                posMenu.DropDownItems.Add(item);
            }
            trayMenu.Items.Add(posMenu);

            // 2. Frame Generation Mode Submenu
            ToolStripMenuItem fgMenu = new ToolStripMenuItem("Frame Generation Mode");
            string[,] fgModes = new string[,] {
                { "AUTO", "Auto-Detect (DLSS-G / FSR-FG / AFMF)" },
                { "2X", "Force 2x Frame Gen (DLSS 3 / FSR 3 / AFMF)" },
                { "3X", "Force 3x Multi Frame Gen (DLSS 4 3x)" },
                { "4X", "Force 4x Multi Frame Gen (DLSS 4 4x)" },
                { "OFF", "Native Only (FG Off)" }
            };
            for (int i = 0; i < fgModes.GetLength(0); i++)
            {
                string mKey = fgModes[i, 0];
                string mLabel = fgModes[i, 1];
                ToolStripMenuItem item = new ToolStripMenuItem(mLabel);
                item.Checked = (fgModeOverride == mKey);
                item.Click += (s, e) =>
                {
                    fgModeOverride = mKey;
                    foreach (ToolStripMenuItem child in fgMenu.DropDownItems)
                        child.Checked = (child == item);
                    SavePortableSettings();
                    SampleTelemetryOnce();
                };
                fgMenu.DropDownItems.Add(item);
            }
            trayMenu.Items.Add(fgMenu);

            // 3. Color Theme Submenu
            ToolStripMenuItem themeMenu = new ToolStripMenuItem("Color Theme");
            foreach (var preset in themes)
            {
                ThemePreset p = preset;
                ToolStripMenuItem item = new ToolStripMenuItem(p.Name);
                item.Checked = (currentThemeId == p.Id);
                item.Click += (s, e) =>
                {
                    currentThemeId = p.Id;
                    accentColor = p.Accent;
                    fgAccentColor = p.FgAccent;
                    textColor = p.Text;
                    bgColor = p.Background;
                    foreach (ToolStripMenuItem child in themeMenu.DropDownItems)
                        child.Checked = (child == item);
                    trayIcon.Icon = CreateTrayIconGraphic();
                    SavePortableSettings();
                    Invalidate();
                };
                themeMenu.DropDownItems.Add(item);
            }
            trayMenu.Items.Add(themeMenu);

            // 4. Background Opacity Submenu
            ToolStripMenuItem opacityMenu = new ToolStripMenuItem("Background Opacity");
            int[] opacities = new int[] { 35, 50, 68, 80, 92 };
            foreach (int pct in opacities)
            {
                int val = pct;
                ToolStripMenuItem item = new ToolStripMenuItem(val + "% Translucent");
                item.Click += (s, e) =>
                {
                    bgAlpha = (int)Math.Round((val / 100.0) * 255.0);
                    Opacity = val / 100.0;
                    SavePortableSettings();
                    Invalidate();
                };
                opacityMenu.DropDownItems.Add(item);
            }
            trayMenu.Items.Add(opacityMenu);

            // 5. Visible Metrics Submenu (Includes VRAM % and System Memory RAM %)
            ToolStripMenuItem metricsMenu = new ToolStripMenuItem("Displayed Metrics");

            ToolStripMenuItem mTotal = new ToolStripMenuItem("Total FPS") { Checked = showTotalFps, CheckOnClick = true };
            mTotal.Click += (s, e) => { showTotalFps = mTotal.Checked; SavePortableSettings(); Invalidate(); };

            ToolStripMenuItem mBase = new ToolStripMenuItem("Base Rendered FPS") { Checked = showBaseFps, CheckOnClick = true };
            mBase.Click += (s, e) => { showBaseFps = mBase.Checked; SavePortableSettings(); Invalidate(); };

            ToolStripMenuItem mGen = new ToolStripMenuItem("Generated Frames (+FG)") { Checked = showGenFps, CheckOnClick = true };
            mGen.Click += (s, e) => { showGenFps = mGen.Checked; SavePortableSettings(); Invalidate(); };

            ToolStripMenuItem mStatus = new ToolStripMenuItem("Frame Gen Active Status") { Checked = showFgStatus, CheckOnClick = true };
            mStatus.Click += (s, e) => { showFgStatus = mStatus.Checked; SavePortableSettings(); Invalidate(); };

            ToolStripMenuItem mGpu = new ToolStripMenuItem("GPU Utilization %") { Checked = showGpuLoad, CheckOnClick = true };
            mGpu.Click += (s, e) => { showGpuLoad = mGpu.Checked; SavePortableSettings(); Invalidate(); };

            ToolStripMenuItem mVram = new ToolStripMenuItem("VRAM Utilization %") { Checked = showVramLoad, CheckOnClick = true };
            mVram.Click += (s, e) => { showVramLoad = mVram.Checked; SavePortableSettings(); Invalidate(); };

            ToolStripMenuItem mCpu = new ToolStripMenuItem("CPU Utilization %") { Checked = showCpuLoad, CheckOnClick = true };
            mCpu.Click += (s, e) => { showCpuLoad = mCpu.Checked; SavePortableSettings(); Invalidate(); };

            ToolStripMenuItem mRam = new ToolStripMenuItem("System Memory (RAM) %") { Checked = showRamLoad, CheckOnClick = true };
            mRam.Click += (s, e) => { showRamLoad = mRam.Checked; SavePortableSettings(); Invalidate(); };

            metricsMenu.DropDownItems.AddRange(new ToolStripItem[] { mTotal, mBase, mGen, mStatus, mGpu, mVram, mCpu, mRam });
            trayMenu.Items.Add(metricsMenu);

            // 6. Click-Through Lock
            ToolStripMenuItem clickItem = new ToolStripMenuItem("Click-Through Lock (Pass Mouse to Game)")
            {
                Checked = clickThrough,
                CheckOnClick = true
            };
            clickItem.Click += (s, e) =>
            {
                clickThrough = clickItem.Checked;
                SavePortableSettings();
                ApplyClickThroughState();
            };
            trayMenu.Items.Add(clickItem);

            // 7. Open Portable Config File (SageFPSOverlay.ini)
            ToolStripMenuItem openIniItem = new ToolStripMenuItem("Open Portable Config (SageFPSOverlay.ini)");
            openIniItem.Click += (s, e) =>
            {
                SavePortableSettings();
                try { Process.Start("notepad.exe", portableIniPath); } catch { }
            };
            trayMenu.Items.Add(openIniItem);

            // 8. Toggle Overlay Visibility
            ToolStripMenuItem toggleVis = new ToolStripMenuItem("Show / Hide Overlay (Ctrl+Shift+O)");
            toggleVis.Click += (s, e) =>
            {
                this.Visible = !this.Visible;
                if (this.Visible) EnforceTopMostZOrder();
            };
            trayMenu.Items.Add(toggleVis);

            trayMenu.Items.Add(new ToolStripSeparator());

            ToolStripMenuItem exitItem = new ToolStripMenuItem("Exit SageFPSOverlay");
            exitItem.Click += (s, e) =>
            {
                SavePortableSettings();
                telemetryTimer.Stop();
                EtwPresentCounter.Stop();
                DxgiDuplicationCounter.Stop();
                trayIcon.Visible = false;
                Application.Exit();
            };
            trayMenu.Items.Add(exitItem);

            trayIcon = new NotifyIcon();
            trayIcon.Text = "SageFPSOverlay — Portable 1.0s Game Framerate Overlay";
            trayIcon.Icon = CreateTrayIconGraphic();
            trayIcon.ContextMenuStrip = trayMenu;
            trayIcon.Visible = true;
            trayIcon.DoubleClick += (s, e) =>
            {
                this.Visible = !this.Visible;
                if (this.Visible) EnforceTopMostZOrder();
            };
        }

        protected override void WndProc(ref Message m)
        {
            if (m.Msg == WM_HOTKEY && m.WParam.ToInt32() == HOTKEY_ID_TOGGLE)
            {
                this.Visible = !this.Visible;
                if (this.Visible) EnforceTopMostZOrder();
            }
            base.WndProc(ref m);
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            SavePortableSettings();
            UnregisterHotKey(this.Handle, HOTKEY_ID_TOGGLE);
            EtwPresentCounter.Stop();
            DxgiDuplicationCounter.Stop();
            if (trayIcon != null) trayIcon.Visible = false;
            base.OnFormClosing(e);
        }

        private static bool IsRunningAsAdmin()
        {
            try
            {
                using (WindowsIdentity identity = WindowsIdentity.GetCurrent())
                {
                    WindowsPrincipal principal = new WindowsPrincipal(identity);
                    return principal.IsInRole(WindowsBuiltInRole.Administrator);
                }
            }
            catch
            {
                return false;
            }
        }

        [STAThread]
        public static void Main(string[] args)
        {
            bool skipElevate = (args != null && args.Length > 0 && args[0] == "--no-elevate");
            if (!skipElevate && !IsRunningAsAdmin())
            {
                try
                {
                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = Application.ExecutablePath;
                    psi.WorkingDirectory = AppDomain.CurrentDomain.BaseDirectory;
                    psi.Arguments = "--no-elevate";
                    psi.Verb = "runas";
                    psi.UseShellExecute = true;
                    Process.Start(psi);
                    return;
                }
                catch
                {
                    // Continue in non-admin mode if UAC is declined
                }
            }

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new OverlayForm());
        }
    }
}
`;
}

/**
 * Generates a portable INI configuration file (`SageFPSOverlay.ini`) matching the user's studio settings.
 */
export function generatePortableIniConfig(config: OverlayConfig): string {
  const alphaByte = Math.round(Math.min(0.95, Math.max(0.15, config.bgOpacity)) * 255);
  return [
    '; SageFPSOverlay Portable Configuration File',
    '; Stored in the same folder next to SageFPSOverlay.exe so your settings travel with the app.',
    '[Overlay]',
    `Position=${config.position}`,
    `MarginX=${config.marginX}`,
    `MarginY=${config.marginY}`,
    `ThemeId=${config.themeId}`,
    `AccentColor=${config.accentColor.toUpperCase()}`,
    `FgAccentColor=${config.fgAccentColor.toUpperCase()}`,
    `TextColor=${config.textColor.toUpperCase()}`,
    `BgColor=${config.bgColor.toUpperCase()}`,
    `BgAlpha=${alphaByte}`,
    `FontSizePx=${config.fontSize}`,
    `PadX=${config.pillPaddingX}`,
    `PadY=${config.pillPaddingY}`,
    `ShowBorder=${config.showBorder ? 'True' : 'False'}`,
    `ClickThrough=${config.clickThrough ? 'True' : 'False'}`,
    'FgModeOverride=AUTO',
    '',
    '[Metrics]',
    `ShowTotalFps=${config.showTotalFps ? 'True' : 'False'}`,
    `ShowBaseFps=${config.showBaseFps ? 'True' : 'False'}`,
    `ShowGenFps=${config.showGenFps ? 'True' : 'False'}`,
    `ShowFgStatus=${config.showFgStatus ? 'True' : 'False'}`,
    `ShowGpuLoad=${config.showGpuLoad ? 'True' : 'False'}`,
    `ShowVramLoad=${config.showVramLoad ? 'True' : 'False'}`,
    `ShowCpuLoad=${config.showCpuLoad ? 'True' : 'False'}`,
    `ShowRamLoad=${config.showRamLoad ? 'True' : 'False'}`,
  ].join('\r\n');
}

/**
 * Generates a zero-dependency self-compiling Windows Batch file (`Build_SageFPSOverlay.bat`)
 * that extracts `SageFPSOverlay.cs`, writes `SageFPSOverlay.ini` next to the executable if not already present
 * (or updates it with the studio settings), compiles `SageFPSOverlay.exe`, and launches it.
 */
export function generateSelfCompilingBatchScript(config: OverlayConfig): string {
  const csSource = generateCSharpSource(config);
  const csLines = csSource.split('\n');
  const base64CsPayload = btoa(unescape(encodeURIComponent(csLines.join('\r\n'))));
  const chunkedCsBase64 = base64CsPayload.match(/.{1,76}/g) || [base64CsPayload];

  const iniSource = generatePortableIniConfig(config);
  const base64IniPayload = btoa(unescape(encodeURIComponent(iniSource)));
  const chunkedIniBase64 = base64IniPayload.match(/.{1,76}/g) || [base64IniPayload];

  const batchLines: string[] = [
    '@echo off',
    'setlocal EnableDelayedExpansion',
    'title SageFPSOverlay - Portable Native Windows .EXE Compiler',
    'echo ============================================================================',
    'echo   SageFPSOverlay - Portable Windows Game Framerate ^& Telemetry Overlay',
    'echo   Real-Time ETW DXGI + VRAM %% + System RAM %% + Portable .INI Config',
    'echo ============================================================================',
    'echo.',
    'cd /d "%~dp0"',
    '',
    'echo [0/4] Stopping any running instance of SageFPSOverlay.exe...',
    'taskkill /f /im SageFPSOverlay.exe >nul 2>&1',
    'taskkill /f /im FramePulseHUD.exe >nul 2>&1',
    '',
    'echo [1/4] Extracting C# Win32 Overlay source (SageFPSOverlay.cs)...',
    'del /q "SageFPSOverlay.b64" 2>nul',
    'del /q "SageFPSOverlay.cs" 2>nul',
    '(',
    ...chunkedCsBase64.map((chunk) => `  echo ${chunk}`),
    ') > "SageFPSOverlay.b64"',
    '',
    'certutil -decode -f "SageFPSOverlay.b64" "SageFPSOverlay.cs" >nul',
    'del /q "SageFPSOverlay.b64" 2>nul',
    '',
    'if not exist "SageFPSOverlay.cs" (',
    '  echo [ERROR] Failed to extract SageFPSOverlay.cs.',
    '  pause',
    '  exit /b 1',
    ')',
    '',
    'echo [2/4] Writing portable settings file (SageFPSOverlay.ini) next to .exe...',
    'del /q "SageFPSOverlay_ini.b64" 2>nul',
    '(',
    ...chunkedIniBase64.map((chunk) => `  echo ${chunk}`),
    ') > "SageFPSOverlay_ini.b64"',
    'certutil -decode -f "SageFPSOverlay_ini.b64" "SageFPSOverlay.ini" >nul',
    'del /q "SageFPSOverlay_ini.b64" 2>nul',
    '',
    'echo [3/4] Locating built-in 64-bit Windows .NET Framework C# Compiler (csc.exe)...',
    'set "CSC_PATH=%WINDIR%\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe"',
    'if not exist "%CSC_PATH%" (',
    '  set "CSC_PATH=%WINDIR%\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe"',
    ')',
    '',
    'if not exist "%CSC_PATH%" (',
    '  echo [ERROR] Built-in .NET Framework 4.0 compiler not found at %CSC_PATH%.',
    '  pause',
    '  exit /b 1',
    ')',
    '',
    'echo [4/4] Compiling standalone 64-bit portable executable: SageFPSOverlay.exe ...',
    '"%CSC_PATH%" /nologo /target:winexe /platform:x64 /optimize+ /out:"SageFPSOverlay.exe" /r:System.dll /r:System.Core.dll /r:System.Drawing.dll /r:System.Windows.Forms.dll "SageFPSOverlay.cs"',
    '',
    'if %ERRORLEVEL% NEQ 0 (',
    '  echo.',
    '  echo [ERROR] Compilation failed. Inspect output above.',
    '  pause',
    '  exit /b 1',
    ')',
    '',
    'echo.',
    'echo [SUCCESS] Built portable executable: "%~dp0SageFPSOverlay.exe"',
    'echo   - Portable Config  : "%~dp0SageFPSOverlay.ini" (Auto-saves all Tray changes)',
    'echo   - Telemetry        : FPS, Base FPS, +FG, GPU %%, VRAM %%, CPU %%, RAM %%',
    'echo   - Always-On-Top    : Elevated UIPI + SetWindowPos(HWND_TOPMOST)',
    'echo   - Refresh Interval : ' + config.updateIntervalMs + 'ms (1.0s Low-Overhead Mode)',
    'echo.',
    'echo Launching SageFPSOverlay.exe now...',
    'start "" "%~dp0SageFPSOverlay.exe"',
    'timeout /t 3 >nul',
    'exit /b 0',
  ];

  return batchLines.join('\r\n');
}
