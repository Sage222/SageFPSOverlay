# FramePulse HUD — Windows Game Framerate & Frame Generation Overlay

**FramePulse HUD** is a lightweight, customizable Windows 10 & Windows 11 in-game framerate and frame-generation overlay (`FramePulseHUD.exe`) paired with an interactive Web Configuration Studio and zero-dependency native `.exe` compiler.

Designed for minimal system resource overhead, the overlay updates strictly once every **1,000ms (1.0 second)**, renders as a compact single-line translucent pill bar, supports true mouse click-through (`WS_EX_TRANSPARENT`), and is controlled from a native Windows System Tray icon.

---

## Key Features

- **Real Hardware Framerate & Frame Generation Telemetry**:
  - **Engine 1 (PresentMon-Style ETW Consumer)**: Subscribes to real-time Event Tracing for Windows (`Microsoft-Windows-DXGI`, `Microsoft-Windows-D3D9`, and `Microsoft-Windows-DxgKrnl`) to count per-process `Present_Start` events for the active foreground game PID.
  - **Engine 2 (DXGI Desktop Duplication Output1 Counter)**: Uses `D3D11CreateDevice` + `IDXGIOutput1::DuplicateOutput` (`AcquireNextFrame`) to track `DXGI_OUTDUPL_FRAME_INFO.AccumulatedFrames` directly from the GPU display output (works even without Administrator privileges and captures driver-level interpolated frames).
  - **Frame Generation Splitting (`FPS` vs `BASE` vs `+FG`)**: Inspects the foreground game process via Win32 `CreateToolhelp32Snapshot` for NVIDIA DLSS Frame Generation (`nvngx_dlssg.dll` / `sl.dlss_g.dll`), AMD FSR 3 Frame Generation (`ffx_frameinterpolation` / `amd_fidelityfx_framegeneration`), and driver-level Fluid Motion / Smooth Motion to display **Total Output FPS**, **Base Rendered FPS**, and **Generated Frames per second (`+FG`)**.
  - **GPU & CPU Utilization**: Reads Windows `GPU Engine` (3D / Graphics utilization) and `Processor(_Total)` performance counters once per second.
- **Persistent Always-On-Top Enforcement**:
  - Automatically elevates via UAC (`runas`) to bypass Windows User Interface Privilege Isolation (UIPI) over elevated/anti-cheat games and asserts `SetWindowPos(HWND_TOPMOST)` without stealing window focus (`SWP_NOACTIVATE`).
- **True Click-Through Translucent Pill Bar**:
  - Applies extended Win32 window styles (`WS_EX_TOPMOST | WS_EX_LAYERED | WS_EX_TRANSPARENT | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE`) so 100% of mouse clicks pass directly through to your game and the overlay never appears in `Alt+Tab`.
- **1,000ms (1.0 Hz) Low-Overhead Polling**:
  - Samples telemetry and redraws the GDI+ pill window strictly once per second (`Timer.Interval = 1000`), keeping CPU usage under `0.05%` and avoiding frame-pacing stutter.
- **Windows System Tray Configuration Menu**:
  - Right-click the tray icon in the Windows notification area to change **Screen Position** (Top-Left, Top-Center, Top-Right, Bottom-Left, Bottom-Center, Bottom-Right), **Frame Generation Mode** (`Auto-Detect`, `Force 2x`, `Force 3x`, `Force 4x`, `Native Only`), **Color Themes**, **Background Opacity** (`35%–92%`), **Displayed Metrics**, and **Click-Through Lock**, or toggle visibility with **`Ctrl + Shift + O`**.

---

## Building & Running `FramePulseHUD.exe` on Windows

No external SDKs, Visual Studio installations, or third-party runtimes are required. Every Windows 10 and Windows 11 installation includes the native 64-bit .NET Framework C# compiler (`csc.exe`).

### Method 1: One-Click Self-Compiling Builder (`.bat`)
1. Open the **FramePulse HUD Web Studio** and configure your preferred default screen position, color palette, background opacity, and visible telemetry segments.
2. Click **Download Windows .EXE Builder** in the top bar to download `Build_FramePulseHUD.bat`.
3. Double-click `Build_FramePulseHUD.bat` on your Windows PC. The script automatically:
   - Extracts your customized `FramePulseHUD.cs` source file.
   - Compiles `FramePulseHUD.exe` using `%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe` with `/target:winexe /platform:x64 /optimize+`.
   - Launches `FramePulseHUD.exe` (approve the UAC prompt so the `Microsoft-Windows-DXGI` ETW session and elevated Always-On-Top Z-order are enabled).

### Method 2: Manual Command-Line Compilation
If you download `FramePulseHUD.cs` directly from the **Native .EXE Compiler** tab, you can compile it from PowerShell or Command Prompt:

```powershell
C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe /nologo /target:winexe /platform:x64 /optimize+ /out:FramePulseHUD.exe /r:System.dll /r:System.Core.dll /r:System.Drawing.dll /r:System.Windows.Forms.dll FramePulseHUD.cs
```

---

## Web Configuration Studio Development

To run the interactive Web Configuration Studio locally:

```bash
# Install dependencies
npm install

# Start the development server on port 3000
npm run dev

# Build production bundle
npm run build
```

---

## Controls & Shortcuts (`FramePulseHUD.exe`)

| Action | Control / Shortcut |
| :--- | :--- |
| **Show / Hide Overlay HUD** | `Ctrl + Shift + O` (or double-click the System Tray icon) |
| **Change Position / Colors / Opacity** | Right-click the **FramePulse HUD** icon in the Windows System Tray |
| **Override Frame Gen Multiplier (`2x` / `3x` / `4x`)** | Right-click System Tray Icon → **Frame Generation Mode** |
| **Toggle Mouse Click-Through** | Right-click System Tray Icon → **Click-Through Lock** |
| **Exit Application** | Right-click System Tray Icon → **Exit FramePulse HUD** |
