/**
 * TrackSphere laptop health agent (Windows-focused, Node.js)
 *
 * Sends: deviceId, timestamp, CPU %, memory %, battery % / health when available.
 * Does NOT collect filenames, user activity, or process lists.
 *
 * Configure via agent/.env — see README.
 */
require('dotenv').config();
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const API_URL = (process.env.API_URL || 'http://localhost:4000').replace(/\/$/, '');
const AGENT_TOKEN = process.env.AGENT_TOKEN || '';
const DEVICE_ID = process.env.DEVICE_ID || os.hostname() || 'UNKNOWN-DEVICE';
const INTERVAL_MS = Math.max(15000, Number(process.env.INTERVAL_MS) || 60000);
const isDemoFlag = process.argv.includes('--demo');

function cpuUsagePercent() {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    for (const type of Object.keys(cpu.times)) total += cpu.times[type];
    idle += cpu.times.idle;
  }
  const usage = total ? 100 - (idle / total) * 100 : null;
  return usage === null ? null : Math.round(usage * 100) / 100;
}

function memoryPercent() {
  const total = os.totalmem();
  const free = os.freemem();
  if (!total) return null;
  return Math.round(((total - free) / total) * 10000) / 100;
}

async function readBatteryWindows() {
  if (process.platform !== 'win32') {
    return { batteryPercent: null, batteryHealth: 'Unavailable' };
  }
  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `(Get-CimInstance -ClassName Win32_Battery | Select-Object -First 1 EstimatedChargeRemaining).EstimatedChargeRemaining`,
      ],
      { timeout: 8000, windowsHide: true }
    );
    const pct = Number(String(stdout).trim());
    const batteryPercent = Number.isFinite(pct) ? pct : null;

    // Design capacity / full charged capacity are not reliably exposed via Win32_Battery.
    // Do not invent battery health — report Unavailable unless a clear capacity ratio exists.
    let batteryHealth = 'Unavailable';
    try {
      const { stdout: capOut } = await execFileAsync(
        'powershell.exe',
        [
          '-NoProfile',
          '-Command',
          `$b = Get-CimInstance -Namespace root\\wmi -ClassName BatteryFullChargedCapacity -ErrorAction SilentlyContinue | Select-Object -First 1; $d = Get-CimInstance -Namespace root\\wmi -ClassName BatteryStaticData -ErrorAction SilentlyContinue | Select-Object -First 1; if ($b -and $d -and $d.DesignedCapacity -gt 0) { [math]::Round(($b.FullChargedCapacity / $d.DesignedCapacity) * 100, 1) }`,
        ],
        { timeout: 8000, windowsHide: true }
      );
      const ratio = Number(String(capOut).trim());
      if (Number.isFinite(ratio) && ratio > 0 && ratio <= 150) {
        batteryHealth = `${ratio}%`;
      }
    } catch {
      batteryHealth = 'Unavailable';
    }

    return { batteryPercent, batteryHealth };
  } catch {
    return { batteryPercent: null, batteryHealth: 'Unavailable' };
  }
}

async function sendCheckin() {
  if (!AGENT_TOKEN) {
    console.error('AGENT_TOKEN is not set. Copy agent/.env.example to agent/.env');
    return;
  }

  const cpuPercent = isDemoFlag ? 68.5 : cpuUsagePercent();
  const memPercent = isDemoFlag ? 74.2 : memoryPercent();
  const battery = isDemoFlag
    ? { batteryPercent: 41, batteryHealth: 'Unavailable' }
    : await readBatteryWindows();

  const body = {
    deviceId: DEVICE_ID,
    cpuPercent,
    memoryPercent: memPercent,
    batteryPercent: battery.batteryPercent,
    batteryHealth: battery.batteryHealth,
    isDemo: isDemoFlag,
  };

  const res = await fetch(`${API_URL}/api/device-health/checkin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Agent-Token': AGENT_TOKEN,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`[${new Date().toISOString()}] check-in failed ${res.status}: ${text}`);
    return;
  }
  console.log(
    `[${new Date().toISOString()}] check-in ok device=${DEVICE_ID} cpu=${cpuPercent} mem=${memPercent} batt=${battery.batteryPercent} health=${battery.batteryHealth}${isDemoFlag ? ' [DEMO]' : ''}`
  );
}

async function loop() {
  console.log(`TrackSphere health agent → ${API_URL} every ${INTERVAL_MS}ms`);
  console.log(`deviceId=${DEVICE_ID}${isDemoFlag ? ' (demo mode)' : ''}`);
  await sendCheckin();
  setInterval(sendCheckin, INTERVAL_MS);
}

loop().catch((err) => {
  console.error(err);
  process.exit(1);
});
