# SageFPSOverlay — Portable Windows Game Framerate & Hardware Telemetry Overlay

**SageFPSOverlay** is a lightweight, portable Windows 10 & Windows 11 in-game framerate, frame-generation, and hardware utilization overlay (`SageFPSOverlay.exe`) paired with an interactive Web Configuration Studio and zero-dependency native `.exe` compiler.

Designed for minimal system resource overhead, the overlay updates strictly once every **1,000ms (1.0 second)**, renders as a compact single-line translucent pill bar, supports true mouse click-through (`WS_EX_TRANSPARENT`), remembers all settings in a portable `SageFPSOverlay.ini` file right next to the `.exe`, and is controlled from a native Windows System Tray icon.

---

## Key Features

- **Real Hardware Framerate & Frame Generation Telemetry**:
  - **Engine 1 (PresentMon-Style ETW Consumer)**: Subscribes to real-time Event Tracing for Windows (`Microsoft-Windows-DXGI`, `Microsoft-Windows-D3D9`, and `Microsoft-Windows-DxgKrnl`) to count per-process `Present_Start` events for the active foreground game PID.
  - **Engine 2 (DXGI Desktop Duplication Output1 Counter)**: Uses `D3D11CreateDevice` + `IDXGIOutput1::DuplicateOutput` (`AcquireNextFrame`) to track `DXGI_OUTDUPL_FRAME_INFO.AccumulatedFrames` directly from the GPU display output (works even without Administrator privileges and captures driver-level interpolated frames).
  - **Frame Generation Splitting (`FPS` vs `BASE` vs `+FG`)**: Inspects the foreground game process via Win32 `CreateToolhelp32Snapshot` for NVIDIA DLSS Frame Generation (`nvngx_dlssg.dll` / `sl.dlss_g.dll`), AMD FSR 3 Frame Generation (`ffx_frameinterpolation` / `amd_fidelityfx_framegeneration`), and driver-level Fluid Motion / Smooth Motion to display **Total Output FPS**, **Base Rendered FPS**, and **Generated Frames per second (`+FG`)**.
- **GPU, VRAM, CPU & System Memory (RAM) Utilization Percentages**:
  - **GPU %**: Reads Windows `GPU Engine` (3D / Graphics utilization) performance counters.
  - **VRAM %**: Queries 64-bit dedicated video memory capacity directly from `IDXGIAdapter::GetDesc` (`DedicatedVideoMemory`, bypassing the 32-bit 4GB registry limit) and compares against `GPU Adapter Memory\Dedicated Usage`.
  - **CPU %**: Reads Windows `Processor(_Total)\% Processor Time`.
  - **RAM %**: Queries physical system memory load directly via Win32 `GlobalMemoryStatusEx` (`dwMemoryLoad`).
  - *All 8 metrics can be toggled on or off individually from the Web Studio, the Windows System Tray menu, or `SageFPSOverlay.ini`.*
- **100% Portable Settings Persistence (`SageFPSOverlay.ini`)**:
  - Reads and saves all customizations automatically to `SageFPSOverlay.ini` in the same folder next to `SageFPSOverlay.exe` (`AppDomain.CurrentDomain.BaseDirectory`).
  - Move the folder or USB drive anywhere—no Registry keys or hidden `%APPDATA%` files are created.
- **Persistent Always-On-Top Enforcement**:
  - Automatically elevates via UAC (`runas`) to bypass Windows User Interface Privilege Isolation (UIPI) over elevated/anti-cheat games and asserts `SetWindowPos(HWND_TOPMOST)` without stealing window focus (`SWP_NOACTIVATE`).
- **True Click-Through Translucent Pill Bar & 1,000ms (1.0 Hz) Polling**:
  - Applies extended Win32 window styles (`WS_EX_TOPMOST | WS_EX_LAYERED | WS_EX_TRANSPARENT | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE`) and samples telemetry strictly once per second (`Timer.Interval = 1000`), keeping CPU usage under `0.05%`.

---

## Building & Running `SageFPSOverlay.exe` on Windows

No external SDKs, Visual Studio installations, or third-party runtimes are required. Every Windows 10 and Windows 11 installation includes the native 64-bit .NET Framework C# compiler (`csc.exe`).

### Method 1: One-Click Self-Compiling Builder (`.bat`)
1. Open the **SageFPSOverlay Web Studio** and configure your preferred default screen position, color palette, background opacity, and visible telemetry segments (`FPS`, `BASE`, `+FG`, `FG Status`, `GPU %`, `VRAM %`, `CPU %`, `RAM %`).
2. Click **Download SageFPSOverlay .EXE Builder** in the top bar to download `Build_SageFPSOverlay.bat`.
3. Double-click `Build_SageFPSOverlay.bat` on your Windows PC. The script automatically:
   - Extracts `SageFPSOverlay.cs`.
   - Writes your portable `SageFPSOverlay.ini` configuration file next to the executable.
   - Compiles `SageFPSOverlay.exe` using `%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe` with `/target:winexe /platform:x64 /optimize+`.
   - Launches `SageFPSOverlay.exe` (approve the UAC prompt so the `Microsoft-Windows-DXGI` ETW session and elevated Always-On-Top Z-order are enabled).

### Method 2: Manual Command-Line Compilation
If you download `SageFPSOverlay.cs` directly from the **Portable .EXE Compiler** tab, you can compile it from PowerShell or Command Prompt:

```powershell
C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe /nologo /target:winexe /platform:x64 /optimize+ /out:SageFPSOverlay.exe /r:System.dll /r:System.Core.dll /r:System.Drawing.dll /r:System.Windows.Forms.dll SageFPSOverlay.cs
```

---

## Portable Configuration File (`SageFPSOverlay.ini`)

`SageFPSOverlay.ini` is created automatically right next to `SageFPSOverlay.exe` and updates immediately whenever you change settings in the System Tray menu:

```ini
; SageFPSOverlay Portable Configuration File
[Overlay]
Position=top-right
MarginX=20
MarginY=16
ThemeId=emerald-tactical
AccentColor=#10B981
FgAccentColor=#F59E0B
TextColor=#F8FAFC
BgColor=#090D16
BgAlpha=173
FontSizePx=13
PadX=14
PadY=6
ShowBorder=True
ClickThrough=True
FgModeOverride=AUTO

[Metrics]
ShowTotalFps=True
ShowBaseFps=True
ShowGenFps=True
ShowFgStatus=True
ShowGpuLoad=True
ShowVramLoad=True
ShowCpuLoad=True
ShowRamLoad=True
```

---

## Controls & Shortcuts (`SageFPSOverlay.exe`)

| Action | Control / Shortcut |
| :--- | :--- |
| **Show / Hide Overlay HUD** | `Ctrl + Shift + O` (or double-click the System Tray icon) |
| **Toggle FPS / +FG / GPU / VRAM / CPU / RAM** | Right-click System Tray Icon → **Displayed Metrics** (Auto-saves to `.ini`) |
| **Change Position / Colors / Opacity** | Right-click the **SageFPSOverlay** icon in the Windows System Tray |
| **Override Frame Gen Multiplier (`2x` / `3x` / `4x`)** | Right-click System Tray Icon → **Frame Generation Mode** |
| **Edit Portable `.INI` in Notepad** | Right-click System Tray Icon → **Open Portable Config (SageFPSOverlay.ini)** |
| **Exit Application** | Right-click System Tray Icon → **Exit SageFPSOverlay** |
