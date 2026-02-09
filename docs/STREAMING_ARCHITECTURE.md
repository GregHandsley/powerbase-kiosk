# Streaming Service Architecture & Implementation Plan

## Purpose

This document defines the architecture, technology stack, and sprint plan for building a streaming service that captures the Powerbase Kiosk wayfinding page and delivers it as HLS/RTMP streams to Yodeck players.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Pages                         │
│  (Static React App - https://facilityos.co.uk/kiosk)       │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │ HTTP (rendered in browser)
                            │
┌─────────────────────────────────────────────────────────────┐
│              Hetzner CPX41 Server (€26/month)                │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         Stream Manager API (Node.js/Fastify)        │   │
│  │  - Start/stop streams                                │   │
│  │  - Health monitoring                                 │   │
│  │  - Production-only guards                            │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │     Docker Compose (12 containers, one per stream)  │   │
│  │                                                       │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │   │
│  │  │ Stream 1     │  │ Stream 2     │  │ Stream 12│ │   │
│  │  │              │  │              │  │          │ │   │
│  │  │ Playwright   │  │ Playwright   │  │ Playwright│ │   │
│  │  │ + Chromium   │  │ + Chromium   │  │ + Chromium│ │   │
│  │  │ + FFmpeg     │  │ + FFmpeg     │  │ + FFmpeg  │ │   │
│  │  │              │  │              │  │          │ │   │
│  │  │ → HLS        │  │ → HLS        │  │ → HLS    │ │   │
│  │  └──────────────┘  └──────────────┘  └──────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Nginx (HLS File Server)                  │   │
│  │  Serves .m3u8 playlists + .ts segments             │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HLS URLs
                            │
┌─────────────────────────────────────────────────────────────┐
│                    Yodeck Players (12x)                      │
│  Display streams on physical screens                        │
└─────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Infrastructure

- **Hosting**: Hetzner Cloud CPX41 (8 vCPU, 16GB RAM) - €26/month
- **Containerization**: Docker + Docker Compose
- **Web Server**: Nginx (serves HLS files)

### Streaming Service

- **Runtime**: Node.js 20+ (LTS)
- **Framework**: Fastify (lightweight, fast API server)
- **Browser Automation**: Playwright (more stable than Puppeteer in containers)
- **Video Encoding**: FFmpeg (CPU encoding, no GPU needed)
- **Display**: Xvfb (virtual framebuffer for headless browser)

### Data Storage

- **Stream Registry**: SQLite (lightweight, sufficient for 12 streams)
- **HLS Segments**: Local filesystem (auto-cleanup old segments)

### Frontend Integration

- **React App**: Add `window.__KIOSK_READY__` flag
- **Stream Mode**: Query param `?streamMode=true` for optimizations
- **Production Guards**: Validate stream keys server-side

## Key Design Decisions

### Why Low-FPS Streaming (2-3 fps)?

- Content is 95% static (floorplan, platform cards, text)
- Updates every 15 minutes (snapshot-based)
- Only animation: pulsating "you are here" icon (2.6s cycle)
- **Result**: 90% less CPU usage vs 30fps, can run 12 streams on single server

### Why Docker Containers?

- **Isolation**: One stream crash doesn't affect others
- **Auto-restart**: Docker health checks handle recovery
- **Scalability**: Easy to add more servers/streams
- **Simplicity**: No Kubernetes complexity needed

### Why Hetzner vs AWS?

- **Cost**: €26/month vs $200-500/month on AWS
- **Simplicity**: Single server, no managed services
- **Performance**: More than sufficient for 12 low-FPS streams
- **Control**: Full control over environment

### Why HLS over RTMP?

- **Yodeck Support**: Yodeck supports HLS natively
- **Reliability**: File-based segments are more resilient
- **Simplicity**: No RTMP server needed, just nginx
- **Latency**: 10-30s delay is acceptable for signage

## Sprint Breakdown

### Sprint 0 — Foundation & Production Guards

**Goal**: Establish structure + "production-only" rules so you can't accidentally stream preview/dev builds.

**Tasks**:

1. Create `streaming-service/` directory structure
2. Initialize Node.js project with Fastify
3. Add environment validation:
   - `NODE_ENV=production` required for stream operations
   - `KIOSK_PROD_URL` (hardcoded, no caller-provided URLs)
   - `ALLOWED_KIOSK_ORIGINS` allowlist
   - `BLOCK_PREVIEW_URLS=true` (reject `*.pages.dev`, `-preview-`, etc.)
4. Create SQLite database schema:
   - `streams` table (id, key, status, createdAt, lastHeartbeat, profileId)
   - `stream_events` table (id, streamId, type, message, timestamp)
5. Add `/health` endpoint
6. Add config validation on startup

**Acceptance Criteria**:

- ✅ Running locally prints: "Streaming disabled in non-production"
- ✅ `POST /streams/start` in dev returns 403 with clear message
- ✅ Any attempt to stream preview URLs is rejected
- ✅ Config validates on startup

**Deliverables**:

- `streaming-service/package.json`
- `streaming-service/src/server.ts`
- `streaming-service/src/config.ts`
- `streaming-service/src/db/schema.sql`
- `streaming-service/.env.example`

---

### Sprint 1 — Single Stream Worker (HLS Output)

**Goal**: Get one stable stream end-to-end using Playwright + Xvfb + FFmpeg → HLS.

**Tasks**:

1. Create `StreamWorker` class:
   - Boots Xvfb display `:99`
   - Launches Chromium via Playwright
   - Opens `${KIOSK_PROD_URL}/kiosk/wayfinding?streamMode=true&streamId=...&key=...`
   - Waits for `window.__KIOSK_READY__ === true` (with 30s timeout)
   - Starts FFmpeg capture → writes HLS segments
2. FFmpeg configuration:
   - Capture: `x11grab` from display `:99`
   - Resolution: 1920x1080 (or configurable)
   - FPS: 3 (low-FPS for static content)
   - Codec: `libx264` (CPU encoding)
   - Bitrate: 800 kbps
   - Keyframe interval: 15 seconds (aligns with snapshot updates)
   - HLS segment duration: 10 seconds
   - Output: `segments/{streamId}/index.m3u8` + `seg_*.ts`
3. Basic API endpoints:
   - `POST /streams/start` → returns playback URL
   - `POST /streams/stop/:streamId` → kills worker + FFmpeg safely
   - `GET /streams` → list active streams + status
   - `GET /streams/:streamId` → stream details
4. Logging:
   - Worker start/stop events
   - Chromium launch status
   - FFmpeg stderr (errors only)
   - Last segment timestamp

**Acceptance Criteria**:

- ✅ A stream can be started and produces `.m3u8` + segments reliably
- ✅ Playback works from browser/VLC using the returned `.m3u8` URL
- ✅ Restarting the worker self-heals (stop → start again cleanly)
- ✅ Stream stops cleanly (no zombie processes)

**Deliverables**:

- `streaming-service/src/worker/StreamWorker.ts`
- `streaming-service/src/worker/ffmpeg.ts`
- `streaming-service/src/api/streams.ts`
- `streaming-service/Dockerfile.worker` (for containerization later)

---

### Sprint 2 — React App: Readiness Flag & Stream Mode

**Goal**: Make rendering predictable and stable. No more "half-loaded UI" streams.

**Tasks**:

1. Add readiness detection in `KioskWayfinding.tsx`:
   - Wait for data loaded (`displaySnapshot !== null`)
   - Wait for fonts applied (document.fonts.ready)
   - Wait for images ready (if any)
   - Set `window.__KIOSK_READY__ = { ui: true, snapshotLoaded: true, realtimeConnected: true }`
2. Add `streamMode` query param handling:
   - Disable any interactive elements (if added later)
   - Optionally disable pulsating animation (reduce CPU)
   - Ensure no auth redirects (kiosk route is already public)
3. Add stream key validation (server-side):
   - Kiosk route checks `streamKey` query param
   - Validates against stream registry (API call or JWT)
   - Rejects invalid keys with clear error

**Acceptance Criteria**:

- ✅ Streams never begin until kiosk declares ready
- ✅ No random logins/redirects captured on stream
- ✅ Invalid stream keys are rejected
- ✅ Stream mode optimizations are applied

**Deliverables**:

- Modified `src/pages/KioskWayfinding.tsx`
- New `src/utils/streamReady.ts` (helper)
- API endpoint for stream key validation

---

### Sprint 3 — Docker Containerization & Multi-Stream

**Goal**: Run 12 streams safely in isolated containers with auto-restart.

**Tasks**:

1. Create `Dockerfile.worker`:
   - Base: Ubuntu 22.04 or Debian
   - Install: Node.js, Playwright, Chromium, FFmpeg, Xvfb
   - Copy worker code
   - Set up Xvfb in entrypoint
2. Create `docker-compose.yml`:
   - 12 worker services (one per stream)
   - Shared volumes for HLS segments
   - Health checks (restart on failure)
   - Resource limits (CPU/memory per container)
3. Update `StreamWorker` for container environment:
   - Use `--ipc=host` for Chromium stability (Playwright requirement)
   - Handle container signals (SIGTERM for graceful shutdown)
   - Log to stdout/stderr (Docker captures)
4. Add concurrency management:
   - `MAX_CONCURRENT_STREAMS=12` config
   - Queue or reject if exceeded
5. Test multi-stream stability:
   - Start 12 streams simultaneously
   - Verify no resource contention
   - Verify auto-restart on failure

**Acceptance Criteria**:

- ✅ 12 streams can run simultaneously without conflicts
- ✅ One stream crash doesn't affect others
- ✅ Containers auto-restart on failure
- ✅ Resource usage is within limits

**Deliverables**:

- `streaming-service/Dockerfile.worker`
- `streaming-service/docker-compose.yml`
- `streaming-service/src/worker/container.ts` (container-specific logic)

---

### Sprint 4 — Nginx HLS Server & Admin UI

**Goal**: Serve HLS files reliably and provide a control panel.

**Tasks**:

1. Set up Nginx:
   - Serve HLS files from `segments/` directory
   - CORS headers for cross-origin (if needed)
   - Cache control headers
   - Auto-index for `.m3u8` files
2. Create admin UI (simple React page or HTML):
   - Stream list with status (running/starting/error)
   - Uptime display
   - Last segment timestamp
   - Start/stop buttons
   - Playback URL copy button
   - Health indicators
3. Add stream health monitoring:
   - Worker sends heartbeat every 30 seconds
   - API marks stream "degraded" if heartbeat stale (>60s)
   - Auto-restart degraded streams
4. Add metrics endpoint:
   - CPU/memory per stream (from Docker stats)
   - FPS (approx from FFmpeg logs)
   - Dropped frames (if detectable)

**Acceptance Criteria**:

- ✅ HLS files are served correctly via nginx
- ✅ Admin UI shows accurate stream states
- ✅ Health monitoring detects and recovers from failures
- ✅ Playback URLs work from Yodeck players

**Deliverables**:

- `streaming-service/nginx.conf`
- `streaming-service/src/admin/ui.html` (or React component)
- `streaming-service/src/api/health.ts`
- `streaming-service/src/api/metrics.ts`

---

### Sprint 5 — Calibration Overlay (Optional)

**Goal**: Build calibration tool for fitting streams to different screen sizes.

**Tasks**:

1. Create display profiles in database:
   - `profiles` table (id, name, paddingTop/Right/Bottom/Left, scale, translateX/Y)
   - Default profile: no adjustments
2. Add calibration mode in kiosk:
   - Admin toggle: "Calibration ON"
   - Render overlay: 4 arrows at edges, safe-area rectangle
   - Controls: arrow keys adjust padding, shift = faster steps, reset button
3. Persist profile via API:
   - Save profile in DB
   - Kiosk reads `profileId` from stream config
   - Apply transforms via CSS/React
4. Per-screen mapping:
   - Map `streamId` → `profileId`
   - Apply profile when starting stream

**Acceptance Criteria**:

- ✅ You can tune a profile live until it perfectly fits a given TV/screen
- ✅ Streams reflect the adjustments immediately
- ✅ Profiles are saved and reusable

**Deliverables**:

- `streaming-service/src/db/profiles.sql`
- `streaming-service/src/api/profiles.ts`
- Modified kiosk route with calibration mode
- Calibration UI component

---

### Sprint 6 — Hardening & Production Readiness

**Goal**: Operational stability, security, and deployment automation.

**Tasks**:

1. Security:
   - Admin panel authentication (simple password + session cookie)
   - Rate limiting on stream start/stop endpoints
   - Rotate stream keys periodically
   - Validate all inputs
2. Observability:
   - Structured logging (JSON format)
   - Error tracking (optional: Sentry integration)
   - Stream event history (stored in DB)
3. Deployment:
   - Docker Compose production config
   - Systemd service (optional: auto-start on boot)
   - Health check script
   - Backup/restore procedures
4. Documentation:
   - Deployment guide
   - Troubleshooting guide
   - API documentation
   - Architecture diagram

**Acceptance Criteria**:

- ✅ Streams survive host restarts (recover to last desired state)
- ✅ Admin panel is secured
- ✅ Logs are structured and searchable
- ✅ Deployment is documented and repeatable

**Deliverables**:

- `streaming-service/src/auth/middleware.ts`
- `streaming-service/src/logging/logger.ts`
- `streaming-service/deploy.sh`
- `streaming-service/docs/DEPLOYMENT.md`
- `streaming-service/docs/TROUBLESHOOTING.md`

---

## Cost Estimates

### Infrastructure (Monthly)

- **Hetzner CPX41**: €26/month (8 vCPU, 16GB RAM)
- **Domain/SSL**: €0 (use existing Cloudflare)
- **Bandwidth**: Included (20TB/month)
- **Total**: **€26/month** (~$28/month)

### Development Time

- Sprint 0: 2-3 days
- Sprint 1: 3-4 days
- Sprint 2: 1-2 days
- Sprint 3: 2-3 days
- Sprint 4: 2-3 days
- Sprint 5: 2-3 days (optional)
- Sprint 6: 2-3 days
- **Total**: 14-21 days (2-3 weeks)

## Performance Targets

### Per Stream

- **CPU**: 0.5-1 core (with 3fps encoding)
- **RAM**: 500MB-1GB (Chromium + FFmpeg)
- **Disk**: ~100MB (HLS segments, auto-cleanup)
- **Network**: ~1 Mbps (800 kbps bitrate)

### Total (12 Streams)

- **CPU**: 6-12 cores (fits in 8-core server)
- **RAM**: 6-12GB (fits in 16GB server)
- **Disk**: ~1.2GB (segments)
- **Network**: ~12 Mbps (well within limits)

## Risk Mitigation

### Single Point of Failure

- **Risk**: One server hosts all 12 streams
- **Mitigation**:
  - Monitor health closely
  - Keep backup server ready (can spin up in minutes)
  - Consider splitting across 2 servers (6 streams each) for redundancy

### Resource Exhaustion

- **Risk**: 12 streams exceed server capacity
- **Mitigation**:
  - Start with 6 streams, monitor, scale up
  - Use resource limits in Docker Compose
  - Implement queue system if needed

### Stream Stability

- **Risk**: Streams crash or freeze
- **Mitigation**:
  - Docker health checks auto-restart
  - Heartbeat monitoring detects failures
  - Watchdog process restarts stuck streams

## Next Steps

1. **Review this architecture** with team/stakeholders
2. **Set up Hetzner server** (can be done in parallel with Sprint 0)
3. **Begin Sprint 0** (foundation & guards)
4. **Test with 1-2 streams** before scaling to 12

## Questions to Resolve

- [ ] Exact Yodeck requirements (resolution, codec, latency tolerance)
- [ ] Stream naming convention (per-location? per-screen?)
- [ ] Admin panel access (internal only? VPN required?)
- [ ] Monitoring/alerting preferences (email? Slack? PagerDuty?)
- [ ] Backup/restore requirements (stream configs, profiles)

---

**Last Updated**: 2024-12-19  
**Status**: Planning Phase  
**Owner**: TBD
