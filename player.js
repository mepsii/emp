// Legacy Windows Media Player object model simulation for skins
// Exposes global objects: player, view, theme, mediacenter and WMP constants

// WMP OpenState constants
const osUndefined = 0;
const osPlaylistChanging = 1;
const osPlaylistLocating = 2;
const osPlaylistConnecting = 3;
const osPlaylistLoading = 4;
const osPlaylistOpening = 5;
const osPlaylistOpenNoMedia = 6;
const osPlaylistChanged = 7;
const osMediaChanging = 8;
const osMediaLocating = 9;
const osMediaConnecting = 10;
const osMediaLoading = 11;
const osMediaOpening = 12;
const osMediaOpen = 13;
const osMediaContentChanged = 14;
const osMediaClosed = 15;
const osPlaylistOpenFailed = 16;
const osMediaOpenFailed = 17;
const osMediaWaiting = 18;
const osMediaReceiving = 19;

// WMP PlayState constants
const wmppsUndefined = 0;
const wmppsStopped = 1;
const wmppsPaused = 2;
const wmppsPlaying = 3;
const wmppsScanForward = 4;
const wmppsScanReverse = 5;
const wmppsBuffering = 6;
const wmppsWaiting = 7;
const wmppsMediaEnded = 8;
const wmppsTransitioning = 9;
const wmppsReady = 10;
const wmppsReconnecting = 11;

// Expose constants to window
window.osMediaOpen = osMediaOpen;
window.osMediaClosed = osMediaClosed;
window.wmppsStopped = wmppsStopped;
window.wmppsPaused = wmppsPaused;
window.wmppsPlaying = wmppsPlaying;

class WMPPlayer {
  constructor(audioElement) {
    this.audio = audioElement;
    this._url = '';
    this._openState = osMediaClosed;
    this._playState = wmppsStopped;
    this._eventListeners = {};
    this.isSeeking = false;
    
    // Set up HTML5 Audio Event Listeners to drive state changes
    this.audio.addEventListener('loadstart', () => {
      this.setOpenState(osPlaylistOpening);
    });
    this.audio.addEventListener('durationchange', () => {
      this.setOpenState(osMediaOpen);
    });
    this.audio.addEventListener('play', () => {
      this.setPlayState(wmppsPlaying);
    });
    this.audio.addEventListener('pause', () => {
      this.setPlayState(wmppsPaused);
    });
    this.audio.addEventListener('ended', () => {
      this.setPlayState(wmppsMediaEnded);
      this.setPlayState(wmppsStopped);
    });
    this.audio.addEventListener('error', () => {
      this.setOpenState(osMediaOpenFailed);
    });
    this.audio.addEventListener('timeupdate', () => {
      this.triggerEvent('position_onchange');
    });
    this.audio.addEventListener('seeking', () => {
      this.isSeeking = true;
    });
    this.audio.addEventListener('seeked', () => {
      this.isSeeking = false;
    });

    // Sub-objects
    this.controls = new WMPControls(this);
    this.settings = new WMPSettings(this);
    this.currentMedia = new WMPMedia(this);
    
    // Case-insensitive aliases (common in skins)
    this.currentmedia = this.currentMedia;
  }

  // Event handler registration from WMS attributes
  addEventListener(event, callback) {
    const ev = event.toLowerCase();
    if (!this._eventListeners[ev]) {
      this._eventListeners[ev] = [];
    }
    this._eventListeners[ev].push(callback);
  }

  clearSkinListeners() {
    for (const ev in this._eventListeners) {
      this._eventListeners[ev] = this._eventListeners[ev].filter(cb => typeof cb !== 'string');
    }
  }

  triggerEvent(event) {
    const ev = event.toLowerCase();
    if (this._eventListeners[ev]) {
      this._eventListeners[ev].forEach(cb => {
        try {
          if (typeof cb === 'function') {
            cb();
          } else if (typeof cb === 'string') {
            // Run string code in global scope
            (new Function(cb))();
          }
        } catch (e) {
          console.error(`Error in WMP event listener for ${event}:`, e);
        }
      });
    }
  }

  get URL() {
    return this._url;
  }

  set URL(val) {
    if (this._url === val) return;
    this._url = val;
    this.setOpenState(osMediaClosed);

    if (val) {
      // Set audio source (using wmp-media:// if it's an absolute path)
      if (val.startsWith('http://') || val.startsWith('https://') || val.startsWith('wmp-media://')) {
        this.audio.src = val;
      } else {
        // Assume absolute local file path and convert
        const safePath = val.replace(/\\/g, '/');
        this.audio.src = `wmp-media://${encodeURIComponent(safePath)}`;
      }
      this.audio.load();
      this.audio.play().catch(e => console.log('Auto-play blocked or failed:', e));
    } else {
      this.audio.removeAttribute('src');
      this.setPlayState(wmppsStopped);
      this.setOpenState(osMediaClosed);
    }
  }

  get openState() { return this._openState; }
  setOpenState(state) {
    if (this._openState === state) return;
    this._openState = state;
    this.triggerEvent('OpenState_onchange');
    this.triggerEvent('openstate_onchange');
  }

  get playState() { return this._playState; }
  setPlayState(state) {
    if (this._playState === state) return;
    this._playState = state;
    this.triggerEvent('PlayState_onchange');
    this.triggerEvent('playstate_onchange');
  }
}

class WMPControls {
  constructor(player) {
    this.player = player;
  }

  play() {
    if (this.player.audio.src) {
      this.player.audio.play().catch(e => console.error(e));
    }
  }

  pause() {
    this.player.audio.pause();
  }

  stop() {
    this.player.audio.pause();
    this.player.audio.currentTime = 0;
    this.player.setPlayState(wmppsStopped);
  }

  next() {
    console.log('WMP: next() called (playlist not implemented)');
  }

  previous() {
    console.log('WMP: previous() called (playlist not implemented)');
  }

  isAvailable(action) {
    const act = String(action).toLowerCase();
    if (['play', 'pause', 'stop', 'next', 'previous'].includes(act)) {
      return true;
    }
    return false;
  }

  isavailable(action) {
    return this.isAvailable(action);
  }

  get currentPosition() {
    return this.player.audio.currentTime;
  }

  set currentPosition(val) {
    const num = parseFloat(val);
    if (!isNaN(num) && isFinite(num)) {
      this.player.audio.currentTime = num;
    }
  }

  // Double check case variants
  get currentposition() { return this.currentPosition; }
  set currentposition(val) { this.currentPosition = val; }

  get currentPositionString() {
    return this.formatTime(this.player.audio.currentTime);
  }

  get currentpositionstring() { return this.currentPositionString; }

  formatTime(secs) {
    if (isNaN(secs)) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
}

class WMPSettings {
  constructor(player) {
    this.player = player;
  }

  get volume() {
    return Math.round(this.player.audio.volume * 100);
  }

  set volume(val) {
    const v = parseInt(val);
    if (!isNaN(v) && v >= 0 && v <= 100) {
      this.player.audio.volume = v / 100;
      this.player.triggerEvent('volume_onchange');
    }
  }

  get mute() {
    return this.player.audio.muted;
  }

  set mute(val) {
    const m = !!val;
    this.player.audio.muted = m;
    this.player.triggerEvent('mute_onchange');
  }

  get balance() { return 0; }
  set balance(val) {}
  get playCount() { return 1; }
  set playCount(val) {}
}

class WMPMedia {
  constructor(player) {
    this.player = player;
  }

  get duration() {
    const d = this.player.audio.duration;
    return (isNaN(d) || !isFinite(d)) ? 0 : d;
  }

  get durationString() {
    return this.player.controls.formatTime(this.duration);
  }

  get name() {
    if (!this.player.URL) return 'No Track Loaded';
    // Return basename of the URL/path
    const url = decodeURIComponent(this.player.URL);
    const parts = url.split(/[\\/]/);
    const filename = parts[parts.length - 1];
    return filename.substring(0, filename.lastIndexOf('.')) || filename;
  }

  getiteminfo(infoType) {
    return this.getItemInfo(infoType);
  }

  getItemInfo(infoType) {
    const type = infoType.toLowerCase();
    if (type === 'author' || type === 'artist') {
      return 'Unknown Artist';
    }
    if (type === 'title') {
      return this.name;
    }
    return '';
  }
}

class WMPView {
  constructor() {
    this._width = 300;
    this._height = 200;
  }

  get width() { return this._width; }
  set width(val) {
    const w = parseInt(val);
    if (!isNaN(w) && w > 0) {
      this._width = w;
      window.electronAPI.resizeWindow(w, this._height);
    }
  }

  get height() { return this._height; }
  set height(val) {
    const h = parseInt(val);
    if (!isNaN(h) && h > 0) {
      this._height = h;
      window.electronAPI.resizeWindow(this._width, h);
    }
  }

  minimize() {
    window.electronAPI.minimizeWindow();
  }

  close() {
    window.electronAPI.closeWindow();
  }

  returnToMediaCenter() {
    if (window.returnToMediaCenter) {
      window.returnToMediaCenter();
    }
  }
}

class WMPTheme {
  constructor() {
    this.views = {};
  }

  savePreference(pref, val) {
    localStorage.setItem(`wmp_pref_${pref}`, String(val));
    console.log(`WMP Saved Preference: ${pref} = ${val}`);
    
    // If saving ExitView or MinimizeView preferences (standard in HL2 skin)
    if (pref === 'exitView' && String(val) === 'true') {
      window.electronAPI.closeWindow();
    } else if (pref === 'minimizeView' && String(val) === 'true') {
      this.savePreference('minimizeView', 'false'); // reset
      window.electronAPI.minimizeWindow();
    }
  }

  savepreference(pref, val) {
    return this.savePreference(pref, val);
  }

  loadPreference(pref) {
    return localStorage.getItem(`wmp_pref_${pref}`) || '';
  }

  loadpreference(pref) {
    return this.loadPreference(pref);
  }

  openView(id) {
    console.log('WMP: openView called for id:', id);
    // WMP skins can have multiple view tags, we usually just show the first one or toggle layouts.
  }

  openview(id) {
    return this.openView(id);
  }
}

class WMPMediaCenter {
  constructor() {
    this.effectType = 'Bars';
    this.effectPreset = 0;
  }
}

// Instantiate and expose globally
const audioEl = document.getElementById('audio-backend');
window.player = new WMPPlayer(audioEl);
window.view = new WMPView();
window.theme = new WMPTheme();
window.mediacenter = new WMPMediaCenter();
window.mediaCenter = window.mediacenter;
