// Legacy WMP Skin Renderer and Runtime Engine
const dashboard = document.getElementById('dashboard');
const skinContainer = document.getElementById('skin-container');
const skinList = document.getElementById('skin-list');
const btnCustomSkin = document.getElementById('btn-custom-skin');
const btnLoadAudio = document.getElementById('btn-load-audio');
const infoTitle = document.getElementById('info-title');
const infoStatus = document.getElementById('info-status');

let activeSkinDir = '';
let activeBindings = [];
let audioAnalyser = null;
let audioSourceNode = null;
let audioContext = null;
let animationFrameId = null;

// Wrapper class to map HTML DOM elements to WMP JScript skin expectations
class WMPElementWrapper {
  constructor(domElement, xmlNode) {
    this.el = domElement;
    this.node = xmlNode;
    this.id = xmlNode.getAttribute('id');
    this._value = xmlNode.getAttribute('value') || '';
    
    // Fallback variables for elements without DOM nodes (e.g. mapped buttons)
    this._visible = xmlNode.getAttribute('visible') !== 'false';
    this._width = parseInt(xmlNode.getAttribute('width')) || 0;
    this._height = parseInt(xmlNode.getAttribute('height')) || 0;
    this._left = parseInt(xmlNode.getAttribute('left')) || 0;
    this._top = parseInt(xmlNode.getAttribute('top')) || 0;
    this._tooltip = xmlNode.getAttribute('toolTip') || xmlNode.getAttribute('tooltip') || '';
  }

  get visible() {
    return this.el ? this.el.style.display !== 'none' : this._visible;
  }

  set visible(val) {
    const show = (val === true || val === 'true' || val === 1 || val === '1');
    this._visible = show;
    if (this.el) {
      this.el.style.display = show ? 'block' : 'none';
    }
    // Call layout update when visibility shifts on views
    if (this.node && this.node.nodeName.toLowerCase() === 'view' && window.updateVirtualLayout) {
      if (show && (this.vx === undefined || this.vy === undefined)) {
        positionNewView(this);
      }
      window.updateVirtualLayout();
    }
  }

  get value() {
    if (this.el) {
      if (this.el.tagName === 'SPAN' || this.el.classList.contains('wmp-text')) {
        return this.el.textContent;
      }
    }
    return this._value;
  }

  set value(val) {
    this._value = val;
    if (this.el) {
      if (this.el.tagName === 'SPAN' || this.el.classList.contains('wmp-text')) {
        this.el.textContent = val;
      }
    }
    if (this.updateSliderUI) {
      this.updateSliderUI(val);
    }
  }

  // Dimensions & Coordinates
  get width() { return this.el ? (parseInt(this.el.style.width) || 0) : this._width; }
  set width(val) {
    this._width = parseInt(val) || 0;
    if (this.el) this.el.style.width = this._width + 'px';
    if (this.node && this.node.nodeName.toLowerCase() === 'view' && window.updateVirtualLayout) {
      window.updateVirtualLayout();
    }
  }

  get height() { return this.el ? (parseInt(this.el.style.height) || 0) : this._height; }
  set height(val) {
    this._height = parseInt(val) || 0;
    if (this.el) this.el.style.height = this._height + 'px';
    if (this.node && this.node.nodeName.toLowerCase() === 'view' && window.updateVirtualLayout) {
      window.updateVirtualLayout();
    }
  }

  get minWidth() { return this.node ? (parseInt(this.node.getAttribute('minWidth') || this.node.getAttribute('minwidth')) || this.width) : this.width; }
  get minwidth() { return this.minWidth; }
  
  get minHeight() { return this.node ? (parseInt(this.node.getAttribute('minHeight') || this.node.getAttribute('minheight')) || this.height) : this.height; }
  get minheight() { return this.minHeight; }

  get left() { return this.el ? (parseInt(this.el.style.left) || 0) : this._left; }
  set left(val) {
    this._left = parseInt(val) || 0;
    if (this.el) {
      this.el.style.left = this._left + 'px';
      updateElementMaskPosition(this.el);
    }
  }

  get top() { return this.el ? (parseInt(this.el.style.top) || 0) : this._top; }
  set top(val) {
    this._top = parseInt(val) || 0;
    if (this.el) {
      this.el.style.top = this._top + 'px';
      updateElementMaskPosition(this.el);
    }
  }

  get textWidth() { return this.el ? (this.el.scrollWidth || 0) : 0; }
  get textwidth() { return this.textWidth; }

  // Tooltip bindings
  get toolTip() { return this.el ? this.el.title : this._tooltip; }
  set toolTip(val) {
    this._tooltip = val;
    if (this.el) this.el.title = val;
  }
  get tooltip() { return this.toolTip; }
  set tooltip(val) { this.toolTip = val; }

  // Effects & Visualizer cycling properties
  get currentEffectType() {
    return window.mediacenter.effectType;
  }
  set currentEffectType(val) {
    window.mediacenter.effectType = val;
  }
  get currentPreset() {
    return window.mediacenter.effectPreset;
  }
  set currentPreset(val) {
    const preset = parseInt(val) || 0;
    window.mediacenter.effectPreset = preset;
    if (window.electronAPI && window.electronAPI.setVisualizerPreset) {
      window.electronAPI.setVisualizerPreset(preset);
    }
  }
  get currentEffectTitle() {
    const preset = this.currentPreset;
    if (preset === 0) return 'Bars';
    if (preset === 1) return 'Waveform';
    return 'Off';
  }
  get currentPresetTitle() {
    const preset = this.currentPreset;
    if (preset === 0) return 'Scope Bars';
    if (preset === 1) return 'Oscilloscope';
    return 'Visualization Off';
  }
  next() {
    this.currentPreset = (this.currentPreset + 1) % 3;
    console.log('WMP Visualizer cycled preset to:', this.currentPreset);
  }
  nextPreset() {
    this.next();
  }
  nextpreset() {
    this.next();
  }
  previousPreset() {
    this.currentPreset = (this.currentPreset - 1 + 3) % 3;
  }
  previouspreset() {
    this.previousPreset();
  }
  previous() {
    this.previousPreset();
  }

  // Window view control delegates (to support views overridden as elements)
  minimize() {
    window.electronAPI.minimizeWindow();
  }
  close() {
    if (this.id === 'mainView' || this.id === 'controlView') {
      window.electronAPI.closeWindow();
    } else {
      this.visible = false;
      if (window.updateVirtualLayout) {
        window.updateVirtualLayout();
      }
    }
  }
  returnToMediaCenter() {
    const container = document.getElementById('skin-container');
    const dashboard = document.getElementById('dashboard');
    if (container && dashboard) {
      container.style.display = 'none';
      container.innerHTML = '';
      dashboard.style.display = 'flex';
      window.electronAPI.setIgnoreMouseEvents(false);
      window.electronAPI.resizeWindow(450, 520);
    }
  }
  returntoMediaCenter() {
    this.returnToMediaCenter();
  }

  moveTo(left, top, duration) {
    const l = parseInt(left);
    const t = parseInt(top);
    const dur = parseInt(duration) || 0;

    if (this.el) {
      if (dur > 0) {
        this.el.style.transition = `left ${dur}ms ease, top ${dur}ms ease`;
        setTimeout(() => {
          if (this.el) this.el.style.transition = '';
          const onEndMove = this.node.getAttribute('onEndMove') || this.node.getAttribute('onendmove');
          if (onEndMove) {
            executeScriptWithContext(onEndMove, currentContextView);
          }
        }, dur);
      } else {
        this.el.style.transition = '';
      }
      this.left = l;
      this.top = t;
    } else {
      this._left = l;
      this._top = t;
    }
  }

  moveto(left, top, duration) {
    return this.moveTo(left, top, duration);
  }

  setColumnResizeMode(index, mode) {
    console.log(`WMP playlist.setColumnResizeMode(${index}, ${mode}) called`);
  }

  setcolumnresizemode(index, mode) {
    return this.setColumnResizeMode(index, mode);
  }
}

// Global views and scripts registries
let wmpViews = [];
let loadedScripts = new Set();
let currentContextView = null;
let draggedView = null;
let dragStartX = 0;
let dragStartY = 0;

// Fallback view object when no skin is loaded (e.g. dashboard)
const dashboardViewFallback = {
  minimize: () => window.electronAPI.minimizeWindow(),
  close: () => window.electronAPI.closeWindow(),
  returnToMediaCenter: () => {
    const container = document.getElementById('skin-container');
    const dashboard = document.getElementById('dashboard');
    if (container && dashboard) {
      container.style.display = 'none';
      container.innerHTML = '';
      dashboard.style.display = 'flex';
      window.electronAPI.setIgnoreMouseEvents(false);
      window.electronAPI.resizeWindow(450, 520);
    }
  }
};

// Expose context-sensitive window.view object
Object.defineProperty(window, 'view', {
  get: () => {
    return currentContextView || window.mainView || wmpViews.find(v => v.id === 'mainView') || wmpViews[0] || dashboardViewFallback;
  },
  set: (val) => {},
  configurable: true
});

// Snapping and Layout Positioning
function positionNewView(viewWrapper) {
  const main = wmpViews.find(v => (v.id === 'mainView' || v.id === 'mediaSwitcherView') && v.visible);
  if (!main) {
    viewWrapper.vx = 0;
    viewWrapper.vy = 0;
    return;
  }

  const gap = 0; // standard WMP border-to-border snap
  if (viewWrapper.id === 'plView' || viewWrapper.id === 'visView') {
    viewWrapper.vx = main.vx;
    viewWrapper.vy = main.vy + main.height + gap;
  } else if (viewWrapper.id === 'eqView') {
    const pl = window['plView'];
    if (pl && pl.visible) {
      viewWrapper.vx = pl.vx;
      viewWrapper.vy = pl.vy + pl.height + gap;
    } else {
      viewWrapper.vx = main.vx;
      viewWrapper.vy = main.vy + main.height + gap;
    }
  } else if (viewWrapper.id === 'videoView') {
    viewWrapper.vx = main.vx + main.width + gap;
    viewWrapper.vy = main.vy;
  } else if (viewWrapper.id === 'infoView') {
    viewWrapper.vx = main.vx - viewWrapper.width - gap;
    viewWrapper.vy = main.vy;
  } else {
    viewWrapper.vx = main.vx + main.width + gap;
    viewWrapper.vy = main.vy;
  }
}

function updateVirtualLayout() {
  const visibleViews = wmpViews.filter(v => v.visible && v.width > 0 && v.height > 0);
  if (visibleViews.length === 0) return;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const v of visibleViews) {
    if (v.vx === undefined) v.vx = 0;
    if (v.vy === undefined) v.vy = 0;
    minX = Math.min(minX, v.vx);
    minY = Math.min(minY, v.vy);
    maxX = Math.max(maxX, v.vx + v.width);
    maxY = Math.max(maxY, v.vy + v.height);
  }

  const width = maxX - minX;
  const height = maxY - minY;

  const shiftX = minX;
  const shiftY = minY;

  if (shiftX !== 0 || shiftY !== 0) {
    for (const v of wmpViews) {
      if (v.vx !== undefined) v.vx -= shiftX;
      if (v.vy !== undefined) v.vy -= shiftY;
    }
    window.electronAPI.dragWindow(shiftX, shiftY);
  }

  window.electronAPI.resizeWindow(width, height);

  for (const v of wmpViews) {
    if (v.el) {
      if (v.visible && v.width > 0 && v.height > 0) {
        v.el.style.display = 'block';
        v.el.style.left = (v.vx || 0) + 'px';
        v.el.style.top = (v.vy || 0) + 'px';
        v.el.style.width = v.width + 'px';
        v.el.style.height = v.height + 'px';
      } else {
        v.el.style.display = 'none';
      }
    }
  }
}

function setupWindowDragging(element, viewWrapper) {
  element.addEventListener('mousedown', (e) => {
    // Check if the click was inside an interactive control
    const interactive = e.target.closest('.wmp-button, .wmp-button-group, .wmp-slider, .wmp-effects, .wmp-playlist, button, input');
    if (!interactive) {
      draggedView = viewWrapper;
      dragStartX = e.screenX;
      dragStartY = e.screenY;
    }
  });
}

// Global Drag & Snapping + Click-through handler
window.addEventListener('mousemove', (e) => {
  // Dragging logic
  if (draggedView) {
    if (e.buttons !== 1) {
      draggedView = null;
    } else {
      const deltaX = e.screenX - dragStartX;
      const deltaY = e.screenY - dragStartY;
      dragStartX = e.screenX;
      dragStartY = e.screenY;

      if (draggedView.vx === undefined) draggedView.vx = 0;
      if (draggedView.vy === undefined) draggedView.vy = 0;

      draggedView.vx += deltaX;
      draggedView.vy += deltaY;

      const snapTolerance = 12;
      const visibleViews = wmpViews.filter(v => v.visible && v.width > 0 && v.height > 0 && v !== draggedView);

      for (const other of visibleViews) {
        // Horizontal Snapping
        if (Math.abs(draggedView.vx - (other.vx + other.width)) < snapTolerance) {
          draggedView.vx = other.vx + other.width;
          if (Math.abs(draggedView.vy - other.vy) < snapTolerance) draggedView.vy = other.vy;
        } else if (Math.abs((draggedView.vx + draggedView.width) - other.vx) < snapTolerance) {
          draggedView.vx = other.vx - draggedView.width;
          if (Math.abs(draggedView.vy - other.vy) < snapTolerance) draggedView.vy = other.vy;
        }

        // Vertical Snapping
        if (Math.abs(draggedView.vy - (other.vy + other.height)) < snapTolerance) {
          draggedView.vy = other.vy + other.height;
          if (Math.abs(draggedView.vx - other.vx) < snapTolerance) draggedView.vx = other.vx;
        } else if (Math.abs((draggedView.vy + draggedView.height) - other.vy) < snapTolerance) {
          draggedView.vy = other.vy - draggedView.height;
          if (Math.abs(draggedView.vx - other.vx) < snapTolerance) draggedView.vx = other.vx;
        }

        // Align coordinates if close
        if (Math.abs(draggedView.vx - other.vx) < snapTolerance) {
          draggedView.vx = other.vx;
        }
        if (Math.abs(draggedView.vy - other.vy) < snapTolerance) {
          draggedView.vy = other.vy;
        }
      }

      updateVirtualLayout();
    }
  }

  // Mouse click-through ignore check
  if (wmpViews.length > 0) {
    if (draggedView || window.isDraggingSlider) {
      window.electronAPI.setIgnoreMouseEvents(false);
    } else {
      const insideView = e.target && e.target.closest && e.target.closest('.wmp-view');
      if (insideView) {
        window.electronAPI.setIgnoreMouseEvents(false);
      } else {
        window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
      }
    }
  }
});

window.addEventListener('mouseup', () => {
  draggedView = null;
});

function executeScriptWithContext(code, contextViewWrapper) {
  const oldView = window.view;
  if (contextViewWrapper) {
    currentContextView = contextViewWrapper;
  }
  try {
    executeScript(code);
  } finally {
    currentContextView = oldView;
  }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  setupDashboard();
  setupDragAndDrop();
  setupAudioListeners();
  setupMenuListeners();
});

function setupMenuListeners() {
  window.electronAPI.onMenuOpenMedia((filePath) => {
    window.player.URL = filePath;
    const titleEl = document.getElementById('info-title');
    if (titleEl) titleEl.textContent = window.player.currentMedia.name;
  });

  window.electronAPI.onMenuLoadSkin((skinPath) => {
    loadSkin(skinPath);
  });

  window.electronAPI.onMenuReturnDashboard(() => {
    window.view.returnToMediaCenter();
  });

  window.electronAPI.onMenuPlayback((action) => {
    if (action === 'play') window.player.controls.play();
    else if (action === 'pause') window.player.controls.pause();
    else if (action === 'stop') window.player.controls.stop();
  });

  window.electronAPI.onMenuVisualizer((preset) => {
    window.mediacenter.effectPreset = preset;
    if (window.displayVisText) {
      try {
        window.displayVisText();
      } catch (e) {
        console.error('Failed to trigger displayVisText:', e);
      }
    }
  });
}

// Setup Dashboard UI
async function setupDashboard() {
  btnCustomSkin.addEventListener('click', async () => {
    const filePath = await window.electronAPI.selectSkinFile();
    if (filePath) {
      loadSkin(filePath);
    }
  });

  btnLoadAudio.addEventListener('click', async () => {
    const filePath = await window.electronAPI.selectMediaFile();
    if (filePath) {
      window.player.URL = filePath;
      infoTitle.textContent = window.player.currentMedia.name;
    }
  });

  // Load available local skins
  try {
    const skins = await window.electronAPI.listLocalSkins();
    skinList.innerHTML = '';
    
    if (skins.length === 0) {
      skinList.innerHTML = '<div class="skin-card loading">No skins found in skins/ folder</div>';
      return;
    }

    skins.forEach(skin => {
      const card = document.createElement('div');
      card.className = 'skin-card';
      card.innerHTML = `
        <div class="skin-name">${skin.name}</div>
        <div class="skin-meta">${skin.type === 'archive' ? 'Packed (.wmz)' : 'Unpacked folder'}</div>
      `;
      card.addEventListener('click', () => {
        loadSkin(skin.path);
      });
      skinList.appendChild(card);
    });
  } catch (e) {
    console.error('Failed to list skins:', e);
    skinList.innerHTML = '<div class="skin-card loading">Error scanning skins</div>';
  }
}

// Track file dragging and dropping onto the window
function setupDragAndDrop() {
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  window.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const filePath = files[0].path;
      const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
      
      if (['.wms', '.wmz', '.zip'].includes(ext)) {
        loadSkin(filePath);
      } else if (['.mp3', '.wav', '.ogg', '.aac', '.m4a', '.flac'].includes(ext)) {
        window.player.URL = filePath;
        infoTitle.textContent = window.player.currentMedia.name;
      }
    }
  });
}

function setupAudioListeners() {
  window.player.addEventListener('PlayState_onchange', () => {
    const state = window.player.playState;
    if (state === wmppsPlaying) {
      infoStatus.textContent = 'Playing';
      infoStatus.style.color = '#10b981';
      initAudioVisualizer();
    } else if (state === wmppsPaused) {
      infoStatus.textContent = 'Paused';
      infoStatus.style.color = '#f59e0b';
    } else {
      infoStatus.textContent = 'Stopped';
      infoStatus.style.color = '#64748b';
    }
  });

  window.player.addEventListener('OpenState_onchange', () => {
    if (window.player.openState === osMediaOpen) {
      infoTitle.textContent = window.player.currentMedia.name;
    }
  });
}

// Setup real Web Audio visualizer for <effects> visualizer elements
function initAudioVisualizer() {
  if (audioAnalyser) return;
  try {
    const audioEl = document.getElementById('audio-backend');
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    // Connect audio element to Web Audio
    if (!audioSourceNode) {
      audioSourceNode = audioContext.createMediaElementSource(audioEl);
      audioAnalyser = audioContext.createAnalyser();
      audioAnalyser.fftSize = 64;
      audioSourceNode.connect(audioAnalyser);
      audioAnalyser.connect(audioContext.destination);
    }
  } catch (e) {
    console.error('Failed to init Web Audio visualizer:', e);
  }
}

// ==========================================
// SKIN PARSER AND COMPILER ENGINE
// ==========================================

async function loadSkin(skinPathOrZip) {
  // Clear any existing visualizer loops, bindings, and views
  activeBindings = [];
  wmpViews = [];
  loadedScripts.clear();
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }

  // Load the skin content
  const result = await window.electronAPI.loadSkin(skinPathOrZip);
  if (!result.success) {
    alert('Failed to load skin: ' + result.error);
    return;
  }

  activeSkinDir = result.skinDir;
  
  // Parse WMS XML
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(result.wmsContent, 'text/xml');
  
  // Clean skin container and show it
  skinContainer.innerHTML = '';
  skinContainer.style.display = 'block';
  dashboard.style.display = 'none';

  // WMP skins root can be theme (or case-insensitive variations)
  let themeNode = xmlDoc.getElementsByTagName('theme')[0] || xmlDoc.getElementsByTagName('THEME')[0];
  if (!themeNode) {
    // If case-insensitive match failed, look manually
    for (let child of xmlDoc.childNodes) {
      if (child.nodeName.toLowerCase() === 'theme') {
        themeNode = child;
        break;
      }
    }
  }

  if (!themeNode) {
    alert('Invalid WMP Skin: Missing <theme> root tag');
    // Go back to dashboard
    window.view.returnToMediaCenter();
    return;
  }

  // 1. Traverse and render XML elements into HTML
  await renderSkinTheme(themeNode);

  // Override WMPTheme view manipulation dynamically
  if (window.theme) {
    window.theme.openView = (id) => {
      console.log('WMP theme.openView called for:', id);
      const v = window[id];
      if (v) {
        v.visible = true;
      }
    };
    window.theme.openview = window.theme.openView;

    window.theme.closeView = (id) => {
      console.log('WMP theme.closeView called for:', id);
      const v = window[id];
      if (v) {
        v.visible = false;
      }
    };
    window.theme.closeview = window.theme.closeView;
  }

  // 2. Parse and evaluate scripts associated with all views
  const viewNodes = findChildNodes(themeNode, 'view');
  for (const viewNode of viewNodes) {
    await loadSkinScripts(viewNode);
  }

  // 3. Call onload of player events if defined
  for (const viewNode of viewNodes) {
    const playerNode = findChildNode(viewNode, 'player');
    if (playerNode) {
      for (let attr of playerNode.attributes) {
        if (attr.name.toLowerCase().endsWith('_onchange')) {
          const eventName = attr.name.substring(0, attr.name.indexOf('_'));
          window.player.addEventListener(eventName, attr.value);
        }
      }
    }
  }

  // 4. Default secondary views to hidden initially (to be opened by onload events)
  let primaryView = wmpViews.find(v => v.id === 'mainView');
  if (!primaryView) {
    primaryView = wmpViews.find(v => v.width > 0 && v.height > 0 && v.id !== 'mediaSwitcherView');
  }

  wmpViews.forEach(v => {
    if (v !== primaryView && v.id !== 'controlView' && v.id !== 'mediaSwitcherView') {
      v.visible = false;
    } else {
      v.visible = true;
    }
  });

  // 5. Call onLoad event of all views if defined
  for (const viewNode of viewNodes) {
    const viewId = viewNode.getAttribute('id');
    const viewWrapper = window[viewId];
    const onLoadScript = viewNode.getAttribute('onLoad') || viewNode.getAttribute('onload');
    if (onLoadScript && viewWrapper) {
      executeScriptWithContext(onLoadScript, viewWrapper);
    }
  }

  // 6. Update layout
  updateVirtualLayout();

  // 7. Start binding loop
  updateBindingsLoop();
}

// Helper to find child nodes case-insensitively
function findChildNode(parent, nodeName) {
  const name = nodeName.toLowerCase();
  for (let child of parent.childNodes) {
    if (child.nodeType === Node.ELEMENT_NODE && child.nodeName.toLowerCase() === name) {
      return child;
    }
  }
  return null;
}

// Find all children matching tag case-insensitively
function findChildNodes(parent, nodeName) {
  const name = nodeName.toLowerCase();
  const results = [];
  for (let child of parent.childNodes) {
    if (child.nodeType === Node.ELEMENT_NODE && child.nodeName.toLowerCase() === name) {
      results.push(child);
    }
  }
  return results;
}

// Recursively traverse and build skin DOM
async function renderSkinTheme(themeNode) {
  // A theme usually contains a view
  const viewNodes = findChildNodes(themeNode, 'view');
  for (let viewNode of viewNodes) {
    await renderView(viewNode);
  }
}

async function renderView(viewNode) {
  const width = viewNode.getAttribute('width') || '300';
  const height = viewNode.getAttribute('height') || '200';
  const clippingColor = viewNode.getAttribute('clippingColor') || viewNode.getAttribute('clippingcolor');
  const transparencyColor = viewNode.getAttribute('transparencyColor') || viewNode.getAttribute('transparencycolor');

  const viewDiv = document.createElement('div');
  viewDiv.className = 'wmp-view';
  viewDiv.style.width = width + 'px';
  viewDiv.style.height = height + 'px';
  
  // Establish stacking context
  const zIndex = viewNode.getAttribute('zIndex') || viewNode.getAttribute('zindex') || '1';
  viewDiv.style.zIndex = zIndex;
  
  const bgImage = viewNode.getAttribute('backgroundImage') || viewNode.getAttribute('backgroundimage');
  if (bgImage) {
    const processedBg = await getProcessedSkinImageURL(bgImage, transparencyColor, clippingColor);
    const maskBg = await getProcessedSkinMaskURL(bgImage, transparencyColor, clippingColor);
    const bgDiv = document.createElement('div');
    bgDiv.className = 'wmp-view-bg';
    bgDiv.style.position = 'absolute';
    bgDiv.style.left = '0';
    bgDiv.style.top = '0';
    bgDiv.style.width = '100%';
    bgDiv.style.height = '100%';
    bgDiv.style.backgroundImage = `url("${processedBg}")`;
    bgDiv.style.backgroundRepeat = 'no-repeat';
    bgDiv.style.backgroundPosition = 'top left';
    bgDiv.style.zIndex = '0';
    bgDiv.style.pointerEvents = 'none';
    viewDiv.appendChild(bgDiv);

    // Store mask image on dataset so children (like visualizers) can mask themselves dynamically
    viewDiv.dataset.maskImage = maskBg;
  } else {
    viewDiv.style.backgroundColor = viewNode.getAttribute('backgroundColor') || viewNode.getAttribute('backgroundcolor') || 'transparent';
  }

  // Expose view to global scripts
  const viewId = viewNode.getAttribute('id') || 'view';
  const wrapper = new WMPElementWrapper(viewDiv, viewNode);
  window[viewId] = wrapper;
  wmpViews.push(wrapper);

  // Implement Window Dragging on background click
  setupWindowDragging(viewDiv, wrapper);

  // Render children
  for (let child of viewNode.childNodes) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      await renderElement(child, viewDiv, transparencyColor, clippingColor, wrapper);
    }
  }

  skinContainer.appendChild(viewDiv);
}

// Render generic elements like subviews, buttongroups, sliders, text
async function renderElement(xmlNode, parentEl, parentTransColor, parentClipColor, contextViewWrapper) {
  const tagName = xmlNode.nodeName.toLowerCase();
  
  if (tagName === 'player') return; // Handled separately
  
  const id = xmlNode.getAttribute('id');
  const left = xmlNode.getAttribute('left') || '0';
  const top = xmlNode.getAttribute('top') || '0';
  const width = xmlNode.getAttribute('width');
  const height = xmlNode.getAttribute('height');
  const visible = xmlNode.getAttribute('visible');

  // Handle position parameters (sometimes JScript evaluations like "jscript:metadata.top")
  let leftVal = left;
  let topVal = top;
  if (left.startsWith('jscript:')) {
    leftVal = 0; // fallback initially
  }
  if (top.startsWith('jscript:')) {
    topVal = 0; // fallback initially
  }

  let el = null;
  let customState = null;

  if (tagName === 'subview') {
    el = document.createElement('div');
    el.className = 'wmp-subview';
    el.style.left = leftVal + 'px';
    el.style.top = topVal + 'px';

    const transColor = xmlNode.getAttribute('transparencyColor') || xmlNode.getAttribute('transparencycolor') || parentTransColor;
    const clipColor = xmlNode.getAttribute('clippingColor') || xmlNode.getAttribute('clippingcolor') || parentClipColor;

    const bgImage = xmlNode.getAttribute('backgroundImage') || xmlNode.getAttribute('backgroundimage');
    let sWidth = width;
    let sHeight = height;

    let processedBg = '';
    if (bgImage) {
      processedBg = await getProcessedSkinImageURL(bgImage, transColor, clipColor);

      // Auto-resolve dimensions from background image if not set in attributes
      if (!sWidth || !sHeight) {
        await new Promise(r => {
          const img = new Image();
          img.src = processedBg;
          img.onload = () => {
            if (!sWidth) sWidth = img.width;
            if (!sHeight) sHeight = img.height;
            r();
          };
          img.onerror = r;
        });
      }
    }

    // Set layout dimensions, fallback to 100% of parent if unresolved
    if (!sWidth) {
      el.style.width = '100%';
    } else {
      el.style.width = sWidth + 'px';
    }
    if (!sHeight) {
      el.style.height = '100%';
    } else {
      el.style.height = sHeight + 'px';
    }

    if (processedBg) {
      const bgDiv = document.createElement('div');
      bgDiv.className = 'wmp-subview-bg';
      bgDiv.style.position = 'absolute';
      bgDiv.style.left = '0';
      bgDiv.style.top = '0';
      bgDiv.style.width = '100%';
      bgDiv.style.height = '100%';
      bgDiv.style.backgroundImage = `url("${processedBg}")`;
      bgDiv.style.backgroundRepeat = 'no-repeat';
      bgDiv.style.backgroundPosition = 'top left';
      bgDiv.style.zIndex = '0';
      bgDiv.style.pointerEvents = 'none';
      el.appendChild(bgDiv);

      // Store mask image on dataset so children (like visualizers) can mask themselves dynamically
      const maskBg = await getProcessedSkinMaskURL(bgImage, transColor, clipColor);
      el.dataset.maskImage = maskBg;
    }

    if (visible === 'false') {
      el.style.display = 'none';
    }

    // Recursively render subview elements
    for (let child of xmlNode.childNodes) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        await renderElement(child, el, transColor, clipColor, contextViewWrapper);
      }
    }

  } else if (tagName === 'buttongroup') {
    el = await createButtonGroup(xmlNode, parentTransColor, parentClipColor, contextViewWrapper);
    
  } else if (tagName === 'slider' || tagName === 'customslider') {
    el = await createSlider(xmlNode, parentTransColor, parentClipColor, contextViewWrapper);

  } else if (tagName === 'text') {
    el = createText(xmlNode);

  } else if (tagName === 'effects') {
    el = createVisualizer(xmlNode, parentEl);

  } else if (tagName === 'playlist') {
    el = createPlaylist(xmlNode);

  } else if (tagName === 'video') {
    el = createVideoElement(xmlNode);

  } else if (tagName === 'videosettings') {
    el = createVideoSettings(xmlNode);

  } else if (tagName === 'equalizersettings') {
    const res = createEqualizerSettings(xmlNode);
    el = res.el;
    customState = res.state;

  } else if (['button', 'playbutton', 'playelement', 'pausebutton', 'pauseelement', 'stopbutton', 'stopelement', 'prevbutton', 'prevbuttonselement', 'nextbutton', 'nextbuttonselement'].includes(tagName)) {
    el = await createStandaloneButton(xmlNode, parentTransColor, parentClipColor, contextViewWrapper);
  }

  if (el) {
    parentEl.appendChild(el);

    // Create wrapper for script lookup
    const wrapper = new WMPElementWrapper(el, xmlNode);
    if (customState) {
      Object.assign(wrapper, customState);
      if (customState.reset) wrapper.reset = customState.reset.bind(wrapper);
      if (customState.nextPreset) wrapper.nextPreset = customState.nextPreset.bind(wrapper);
      if (customState.previousPreset) wrapper.previousPreset = customState.previousPreset.bind(wrapper);
      if (customState.nextpreset) wrapper.nextpreset = customState.nextpreset.bind(wrapper);
      if (customState.previouspreset) wrapper.previouspreset = customState.previouspreset.bind(wrapper);
    }
    if (id) {
      window[id] = wrapper;
    }

    // Apply zIndex stacking to allow visualizer elements to render behind background textures
    const zIndex = xmlNode.getAttribute('zIndex') || xmlNode.getAttribute('zindex');
    let defaultZIndex = '1';
    if (tagName === 'effects') {
      defaultZIndex = '-1';
    }
    el.style.zIndex = zIndex || defaultZIndex;

    // Set up data binding for attributes
    for (let attr of xmlNode.attributes) {
      const attrName = attr.name.toLowerCase();
      const attrVal = attr.value;
      
      // Bindings look like "wmpprop:player.currentMedia.duration"
      if (attrVal.startsWith('wmpprop:')) {
        const propPath = attrVal.substring(8);
        
        if (attrName === 'value') {
          activeBindings.push({
            wrapper,
            targetProperty: 'value',
            propPath,
            contextView: contextViewWrapper,
            lastValue: undefined,
            updateFn: (val) => { wrapper.value = val; }
          });
        } else if (attrName === 'max') {
          activeBindings.push({
            wrapper,
            targetProperty: 'max',
            propPath,
            contextView: contextViewWrapper,
            lastValue: undefined,
            updateFn: (val) => { 
              wrapper.max = val;
              if (wrapper.updateSliderUI) wrapper.updateSliderUI(wrapper.value);
            }
          });
        } else if (attrName === 'min') {
          activeBindings.push({
            wrapper,
            targetProperty: 'min',
            propPath,
            contextView: contextViewWrapper,
            lastValue: undefined,
            updateFn: (val) => { 
              wrapper.min = val;
              if (wrapper.updateSliderUI) wrapper.updateSliderUI(wrapper.value);
            }
          });
        } else if (attrName === 'visible') {
          activeBindings.push({
            wrapper,
            targetProperty: 'visible',
            propPath,
            contextView: contextViewWrapper,
            lastValue: undefined,
            updateFn: (val) => { wrapper.visible = val; }
          });
        } else if (attrName === 'down') {
          // Down parameter for toggle buttons (like mute)
          activeBindings.push({
            wrapper,
            targetProperty: 'down',
            propPath,
            contextView: contextViewWrapper,
            lastValue: undefined,
            updateFn: (val) => {
              wrapper.isDown = !!val;
              if (wrapper.updateButtonUI) wrapper.updateButtonUI();
            }
          });
        }
      } else if (attrVal.startsWith('jscript:')) {
        // Dynamic evaluation bindings
        const expr = attrVal.substring(8);
        const updateExpr = () => {
          try {
            const oldView = window.view;
            if (contextViewWrapper) {
              currentContextView = contextViewWrapper;
            }
            const val = (new Function(`return ${expr}`))();
            currentContextView = oldView;
            if (attrName === 'top') {
              el.style.top = val + 'px';
            } else if (attrName === 'left') {
              el.style.left = val + 'px';
            } else if (attrName === 'width') {
              el.style.width = val + 'px';
            } else if (attrName === 'height') {
              el.style.height = val + 'px';
            }
          } catch (e) {
            // Safe ignore if references aren't loaded yet
          }
        };
        activeBindings.push({
          wrapper,
          targetProperty: attrName,
          propPath: expr,
          contextView: contextViewWrapper,
          lastValue: undefined,
          updateFn: updateExpr
        });
      }
    }
  }
}

// ------------------------------------------
// MAPPING IMAGE HIT-TEST BUTTON GROUPS
// ------------------------------------------

async function createButtonGroup(xmlNode, parentTransColor, parentClipColor, contextViewWrapper) {
  const left = xmlNode.getAttribute('left') || '0';
  const top = xmlNode.getAttribute('top') || '0';
  const width = xmlNode.getAttribute('width');
  const height = xmlNode.getAttribute('height');

  const bgImage = xmlNode.getAttribute('image') || xmlNode.getAttribute('backgroundImage') || xmlNode.getAttribute('backgroundimage');
  const hoverImage = xmlNode.getAttribute('hoverImage') || xmlNode.getAttribute('hoverimage');
  const downImage = xmlNode.getAttribute('downImage') || xmlNode.getAttribute('downimage');
  const mappingImage = xmlNode.getAttribute('mappingImage') || xmlNode.getAttribute('mappingimage');

  const transColor = xmlNode.getAttribute('transparencyColor') || xmlNode.getAttribute('transparencycolor') || parentTransColor;
  const clipColor = xmlNode.getAttribute('clippingColor') || xmlNode.getAttribute('clippingcolor') || parentClipColor;

  const bgDiv = document.createElement('div');
  bgDiv.className = 'wmp-button-group';
  bgDiv.style.left = left + 'px';
  bgDiv.style.top = top + 'px';

  // Load and pre-process states
  let defaultBg = '';
  let hoverBg = '';
  let downBg = '';
  
  if (bgImage) {
    defaultBg = await getProcessedSkinImageURL(bgImage, transColor, clipColor);
    bgDiv.style.backgroundImage = `url("${defaultBg}")`;
  }
  if (hoverImage) hoverBg = await getProcessedSkinImageURL(hoverImage, transColor, clipColor);
  if (downImage) downBg = await getProcessedSkinImageURL(downImage, transColor, clipColor);

  const loadImg = (src) => {
    return new Promise((resolve) => {
      if (!src) return resolve(null);
      const img = new Image();
      img.src = src;
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
    });
  };

  const defaultImg = await loadImg(defaultBg);
  const hoverImg = await loadImg(hoverBg);
  const downImg = await loadImg(downBg);

  // Load mapping hit test image on offscreen canvas
  let mapCanvas = null;
  let mapCtx = null;
  let mapWidth = 0;
  let mapHeight = 0;

  if (mappingImage) {
    const mapImg = new Image();
    mapImg.src = `wmp-skin://local/${encodeURIComponent(mappingImage)}`;
    await new Promise(r => {
      mapImg.onload = () => {
        mapCanvas = document.createElement('canvas');
        mapWidth = mapImg.width;
        mapHeight = mapImg.height;
        mapCanvas.width = mapWidth;
        mapCanvas.height = mapHeight;
        mapCtx = mapCanvas.getContext('2d');
        mapCtx.drawImage(mapImg, 0, 0);
        
        // Match container size to map image size if size not specified
        if (!width) bgDiv.style.width = mapWidth + 'px';
        if (!height) bgDiv.style.height = mapHeight + 'px';
        r();
      };
      mapImg.onerror = () => {
        console.error('Failed to load mapping image:', mappingImage);
        r();
      };
    });
  } else {
    if (width) bgDiv.style.width = width + 'px';
    if (height) bgDiv.style.height = height + 'px';
  }

  const w = mapWidth || (defaultImg ? defaultImg.width : 0) || parseInt(width) || 100;
  const h = mapHeight || (defaultImg ? defaultImg.height : 0) || parseInt(height) || 20;

  const renderCanvas = document.createElement('canvas');
  renderCanvas.width = w;
  renderCanvas.height = h;
  const renderCtx = renderCanvas.getContext('2d');

  // Parse button elements inside button group
  const buttons = [];
  const buttonTags = ['buttonelement', 'playelement', 'pauseelement', 'stopelement', 'prevelement', 'nextelement'];
  for (let tag of buttonTags) {
    const elNodes = findChildNodes(xmlNode, tag);
    elNodes.forEach(node => {
      const btnId = node.getAttribute('id');
      const btnObj = {
        node,
        mappingColor: (node.getAttribute('mappingColor') || node.getAttribute('mappingcolor') || '').toLowerCase(),
        onClick: node.getAttribute('onClick') || node.getAttribute('onclick'),
        toolTip: node.getAttribute('upToolTip') || node.getAttribute('uptooltip') || node.getAttribute('toolTip') || node.getAttribute('tooltip'),
        tag
      };
      buttons.push(btnObj);

      // Expose the button's ID as a global WMPElementWrapper (with a null DOM element)
      if (btnId) {
        window[btnId] = new WMPElementWrapper(null, node);
      }
    });
  }

  const parseHex = (hex) => {
    if (!hex) return null;
    hex = hex.replace('#', '').trim().toLowerCase();
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16)
      };
    }
    if (hex.length === 6) {
      return {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16)
      };
    }
    return null;
  };

  // Helper to pre-render masked button states
  const createMaskedCanvas = (srcImg, mappingColor) => {
    if (!srcImg || !mapCtx) return null;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(srcImg, 0, 0);

    try {
      const srcData = ctx.getImageData(0, 0, w, h);
      const mapData = mapCtx.getImageData(0, 0, w, h).data;
      const data = srcData.data;
      const targetColor = parseHex(mappingColor);

      if (targetColor) {
        for (let i = 0; i < data.length; i += 4) {
          const mx = mapData[i];
          const mg = mapData[i + 1];
          const mb = mapData[i + 2];
          const ma = mapData[i + 3];

          const matches = ma > 0 && Math.abs(mx - targetColor.r) < 10 && Math.abs(mg - targetColor.g) < 10 && Math.abs(mb - targetColor.b) < 10;
          if (!matches) {
            data[i + 3] = 0; // Transparent
          }
        }
        ctx.putImageData(srcData, 0, 0);
      }
    } catch (e) {
      console.error('Failed to mask button group state:', e);
    }
    return canvas;
  };

  // Pre-generate masked state layers for each button
  buttons.forEach(btn => {
    btn.hoverMask = createMaskedCanvas(hoverImg, btn.mappingColor);
    btn.downMask = createMaskedCanvas(downImg, btn.mappingColor);
  });

  // Hit-Test logic
  let activeBtn = null;
  let isMouseDown = false;

  const findButtonAtCoords = (x, y) => {
    if (!mapCtx) return null;
    if (x < 0 || y < 0 || x >= mapWidth || y >= mapHeight) return null;
    
    const pixel = mapCtx.getImageData(x, y, 1, 1).data;
    const r = pixel[0];
    const g = pixel[1];
    const b = pixel[2];
    const a = pixel[3];
    
    if (a === 0) return null; // fully transparent pixel on map is ignored

    // Convert pixel to hex format #rrggbb
    const hex = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    
    // Find matching button mappingColor
    return buttons.find(btn => btn.mappingColor === hex);
  };

  const updateCompositeUI = () => {
    if (!renderCtx) return;
    renderCtx.clearRect(0, 0, w, h);

    if (defaultImg) {
      renderCtx.drawImage(defaultImg, 0, 0);
    }

    if (activeBtn) {
      if (isMouseDown) {
        if (activeBtn.downMask) {
          renderCtx.drawImage(activeBtn.downMask, 0, 0);
        } else if (downImg) {
          renderCtx.drawImage(downImg, 0, 0);
        }
      } else {
        if (activeBtn.hoverMask) {
          renderCtx.drawImage(activeBtn.hoverMask, 0, 0);
        } else if (hoverImg) {
          renderCtx.drawImage(hoverImg, 0, 0);
        }
      }
    }

    bgDiv.style.backgroundImage = `url("${renderCanvas.toDataURL()}")`;
  };

  // Render initial static composite background
  updateCompositeUI();

  bgDiv.addEventListener('mousemove', (e) => {
    const rect = bgDiv.getBoundingClientRect();
    const x = Math.floor(e.clientX - rect.left);
    const y = Math.floor(e.clientY - rect.top);
    
    const btn = findButtonAtCoords(x, y);
    
    if (btn) {
      if (activeBtn !== btn) {
        activeBtn = btn;
        bgDiv.style.cursor = 'pointer';
        bgDiv.title = btn.toolTip || '';
        updateCompositeUI();
      }
    } else {
      if (activeBtn !== null) {
        activeBtn = null;
        bgDiv.style.cursor = 'default';
        bgDiv.title = '';
        updateCompositeUI();
      }
    }
  });

  bgDiv.addEventListener('mousedown', (e) => {
    if (activeBtn) {
      isMouseDown = true;
      updateCompositeUI();
    }
  });

  bgDiv.addEventListener('mouseup', (e) => {
    if (isMouseDown && activeBtn) {
      triggerButtonAction(activeBtn, contextViewWrapper);
      isMouseDown = false;
      updateCompositeUI();
    }
  });

  bgDiv.addEventListener('mouseleave', () => {
    activeBtn = null;
    isMouseDown = false;
    updateCompositeUI();
  });

  return bgDiv;
}

function triggerButtonAction(btn, contextViewWrapper) {
  if (btn.onClick) {
    executeScriptWithContext(btn.onClick, contextViewWrapper);
    return;
  }
  
  // Standard built-in button actions
  switch (btn.tag) {
    case 'playelement':
      window.player.controls.play();
      break;
    case 'pauseelement':
      window.player.controls.pause();
      break;
    case 'stopelement':
      window.player.controls.stop();
      break;
    case 'prevelement':
      window.player.controls.previous();
      break;
    case 'nextelement':
      window.player.controls.next();
      break;
  }
}

// ------------------------------------------
// STANDALONE BUTTONS (non-grouped)
// ------------------------------------------

async function createStandaloneButton(xmlNode, parentTransColor, parentClipColor, contextViewWrapper) {
  const left = xmlNode.getAttribute('left') || '0';
  const top = xmlNode.getAttribute('top') || '0';
  const width = xmlNode.getAttribute('width');
  const height = xmlNode.getAttribute('height');
  const tagName = xmlNode.nodeName.toLowerCase();

  const bgImage = xmlNode.getAttribute('image') || xmlNode.getAttribute('backgroundImage') || xmlNode.getAttribute('backgroundimage');
  const hoverImage = xmlNode.getAttribute('hoverImage') || xmlNode.getAttribute('hoverimage');
  const downImage = xmlNode.getAttribute('downImage') || xmlNode.getAttribute('downimage');

  const transColor = xmlNode.getAttribute('transparencyColor') || xmlNode.getAttribute('transparencycolor') || parentTransColor;
  const clipColor = xmlNode.getAttribute('clippingColor') || xmlNode.getAttribute('clippingcolor') || parentClipColor;

  const btnDiv = document.createElement('div');
  btnDiv.className = 'wmp-button';
  btnDiv.style.left = left + 'px';
  btnDiv.style.top = top + 'px';

  let defaultBg = '';
  let hoverBg = '';
  let downBg = '';

  if (bgImage) {
    defaultBg = await getProcessedSkinImageURL(bgImage, transColor, clipColor);
    btnDiv.style.backgroundImage = `url("${defaultBg}")`;
    
    // Auto-detect dimensions from default image
    if (!width || !height) {
      const img = new Image();
      img.src = defaultBg;
      await new Promise(r => {
        img.onload = () => {
          if (!width) btnDiv.style.width = img.width + 'px';
          if (!height) btnDiv.style.height = img.height + 'px';
          r();
        };
        img.onerror = r;
      });
    }
  }

  if (width) btnDiv.style.width = width + 'px';
  if (height) btnDiv.style.height = height + 'px';

  if (hoverImage) hoverBg = await getProcessedSkinImageURL(hoverImage, transColor, clipColor);
  if (downImage) downBg = await getProcessedSkinImageURL(downImage, transColor, clipColor);

  const onClick = xmlNode.getAttribute('onClick') || xmlNode.getAttribute('onclick');
  const sticky = xmlNode.getAttribute('sticky') === 'true';
  const toolTip = xmlNode.getAttribute('upToolTip') || xmlNode.getAttribute('uptooltip') || xmlNode.getAttribute('toolTip') || xmlNode.getAttribute('tooltip');

  btnDiv.title = toolTip || '';

  // Wrapper states (useful if button is sticky like Mute)
  const wrapperState = {
    isDown: false,
    updateButtonUI: () => {
      if (wrapperState.isDown && downBg) {
        btnDiv.style.backgroundImage = `url("${downBg}")`;
      } else {
        btnDiv.style.backgroundImage = `url("${defaultBg}")`;
      }
    }
  };

  btnDiv.addEventListener('mouseenter', () => {
    if (!wrapperState.isDown && hoverBg) btnDiv.style.backgroundImage = `url("${hoverBg}")`;
  });

  btnDiv.addEventListener('mouseleave', () => {
    wrapperState.updateButtonUI();
  });

  btnDiv.addEventListener('mousedown', () => {
    if (downBg) btnDiv.style.backgroundImage = `url("${downBg}")`;
  });

  btnDiv.addEventListener('mouseup', () => {
    if (sticky) {
      wrapperState.isDown = !wrapperState.isDown;
    }
    
    if (onClick) {
      executeScriptWithContext(onClick, contextViewWrapper);
    } else {
      // Default tag actions
      if (tagName.startsWith('play')) window.player.controls.play();
      else if (tagName.startsWith('pause')) window.player.controls.pause();
      else if (tagName.startsWith('stop')) window.player.controls.stop();
      else if (tagName.startsWith('prev')) window.player.controls.previous();
      else if (tagName.startsWith('next')) window.player.controls.next();
    }

    wrapperState.updateButtonUI();
  });

  // Attach state to button element wrapper
  const wrapper = new WMPElementWrapper(btnDiv, xmlNode);
  Object.assign(wrapper, wrapperState);

  return btnDiv;
}

// ------------------------------------------
// CUSTOM SLIDERS & PROGRESS BARS
// ------------------------------------------

async function createSlider(xmlNode, parentTransColor, parentClipColor, contextViewWrapper) {
  const left = xmlNode.getAttribute('left') || '0';
  const top = xmlNode.getAttribute('top') || '0';
  const width = xmlNode.getAttribute('width');
  const height = xmlNode.getAttribute('height');

  const bgImage = xmlNode.getAttribute('backgroundImage') || xmlNode.getAttribute('backgroundimage') || xmlNode.getAttribute('image');
  const foregroundImage = xmlNode.getAttribute('foregroundImage') || xmlNode.getAttribute('foregroundimage');
  const thumbImage = xmlNode.getAttribute('thumbImage') || xmlNode.getAttribute('thumbimage');
  const positionImage = xmlNode.getAttribute('positionImage') || xmlNode.getAttribute('positionimage');

  const transColor = xmlNode.getAttribute('transparencyColor') || xmlNode.getAttribute('transparencycolor') || parentTransColor;
  const clipColor = xmlNode.getAttribute('clippingColor') || xmlNode.getAttribute('clippingcolor') || parentClipColor;

  const sliderDiv = document.createElement('div');
  sliderDiv.className = 'wmp-slider';
  sliderDiv.style.left = left + 'px';
  sliderDiv.style.top = top + 'px';

  let defaultBg = '';
  let fgBg = '';
  let thumbBg = '';

  if (bgImage) {
    defaultBg = await getProcessedSkinImageURL(bgImage, transColor, clipColor);
    sliderDiv.style.backgroundImage = `url("${defaultBg}")`;
  }
  if (foregroundImage) {
    fgBg = await getProcessedSkinImageURL(foregroundImage, transColor, clipColor);
  }
  if (thumbImage) {
    thumbBg = await getProcessedSkinImageURL(thumbImage, transColor, clipColor);
  }

  // Determine size
  let sWidth = parseInt(width) || 100;
  let sHeight = parseInt(height) || 20;

  if (bgImage && (!width || !height)) {
    const img = new Image();
    img.src = defaultBg;
    await new Promise(r => {
      img.onload = () => {
        if (!width) sWidth = img.width;
        if (!height) sHeight = img.height;
        r();
      };
      img.onerror = r;
    });
  }

  sliderDiv.style.width = sWidth + 'px';
  sliderDiv.style.height = sHeight + 'px';

  // Create Foreground Fill element
  let fillEl = null;
  const direction = xmlNode.getAttribute('direction') || 'horizontal';
  if (foregroundImage) {
    fillEl = document.createElement('div');
    fillEl.style.position = 'absolute';
    fillEl.style.left = '0';
    fillEl.style.backgroundImage = `url("${fgBg}")`;
    fillEl.style.backgroundRepeat = xmlNode.getAttribute('tiled') === 'true' ? 'repeat-x' : 'no-repeat';
    if (direction === 'vertical') {
      fillEl.style.bottom = '0';
      fillEl.style.width = '100%';
      fillEl.style.height = '0%';
      fillEl.style.backgroundPosition = 'bottom left';
    } else {
      fillEl.style.top = '0';
      fillEl.style.width = '0%';
      fillEl.style.height = '100%';
      fillEl.style.backgroundPosition = 'top left';
    }
    sliderDiv.appendChild(fillEl);
  }

  // Create Thumb element
  let thumbEl = null;
  let thumbW = 10;
  let thumbH = sHeight;

  if (thumbImage) {
    thumbEl = document.createElement('div');
    thumbEl.style.position = 'absolute';
    thumbEl.style.top = '0';
    thumbEl.style.backgroundImage = `url("${thumbBg}")`;
    thumbEl.style.backgroundRepeat = 'no-repeat';
    sliderDiv.appendChild(thumbEl);

    // Read thumb dimensions
    const tImg = new Image();
    tImg.src = thumbBg;
    await new Promise(r => {
      tImg.onload = () => {
        thumbW = tImg.width;
        thumbH = tImg.height;
        thumbEl.style.width = thumbW + 'px';
        thumbEl.style.height = thumbH + 'px';
        
        // Initial thumb position centering
        if (direction === 'vertical') {
          thumbEl.style.left = ((sWidth - thumbW) / 2) + 'px';
        } else {
          thumbEl.style.top = ((sHeight - thumbH) / 2) + 'px';
        }
        r();
      };
      tImg.onerror = r;
    });
  }

  // Read positional hit map for custom slider arcs if provided
  let mapCanvas = null;
  let mapCtx = null;
  if (positionImage) {
    const mapImg = new Image();
    mapImg.src = `wmp-skin://local/${encodeURIComponent(positionImage)}`;
    await new Promise(r => {
      mapImg.onload = () => {
        mapCanvas = document.createElement('canvas');
        mapCanvas.width = mapImg.width;
        mapCanvas.height = mapImg.height;
        mapCtx = mapCanvas.getContext('2d');
        mapCtx.drawImage(mapImg, 0, 0);
        r();
      };
      mapImg.onerror = () => {
        console.error('Failed to load positional hit map image:', positionImage);
        r();
      };
    });
  }

  // Slider State Attributes
  const state = {
    min: parseFloat(xmlNode.getAttribute('min')) || 0,
    max: parseFloat(xmlNode.getAttribute('max')) || 100,
    value: 0,
    direction: direction,
    
    // Updates the visual fill and thumb position from slider value
    updateSliderUI: (val) => {
      state.value = val;
      const range = state.max - state.min;
      const pct = range > 0 ? (val - state.min) / range : 0;
      const clampedPct = Math.max(0, Math.min(1, pct));

      if (state.direction === 'vertical') {
        const topPos = clampedPct * (sHeight - thumbH);
        if (thumbEl) {
          thumbEl.style.top = (sHeight - thumbH - topPos) + 'px';
          thumbEl.style.left = ((sWidth - thumbW) / 2) + 'px';
        }
        if (fillEl) fillEl.style.height = (clampedPct * 100) + '%';
      } else {
        const leftPos = clampedPct * (sWidth - thumbW);
        if (thumbEl) {
          thumbEl.style.left = leftPos + 'px';
          thumbEl.style.top = ((sHeight - thumbH) / 2) + 'px';
        }
        if (fillEl) fillEl.style.width = (clampedPct * 100) + '%';
      }
    }
  };

  // Slider Interaction logic
  const handlePositionSelection = (e) => {
    const rect = sliderDiv.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let pct = 0;

    if (mapCtx) {
      // Map pixel grayscale level to determine slider value (WMP positionImage standard)
      // Read pixel value at coordinates
      const pixel = mapCtx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
      const r = pixel[0];
      const a = pixel[3];
      if (a > 0) {
        // Pixel value range is 0 to 255
        pct = r / 255;
      } else {
        return; // Ignore clicks outside mapped shape
      }
    } else {
      // Linear slider fallback
      if (state.direction === 'vertical') {
        pct = 1 - (y / sHeight);
      } else {
        pct = x / sWidth;
      }
    }

    // Clamp pct to [0, 1] range to avoid sending out-of-bounds inputs (e.g. volume > 100 or < 0)
    pct = Math.max(0, Math.min(1, pct));
    const value = state.min + pct * (state.max - state.min);
    console.log(`[Slider] Selection: pct=${pct.toFixed(2)}, value=${value.toFixed(2)}`);
    state.updateSliderUI(value);

    // Invoke events
    const onChangeCode = xmlNode.getAttribute('value_onchange') || xmlNode.getAttribute('value_onclick');
    if (onChangeCode) {
      const codeStr = onChangeCode.replace(/value/gi, String(value));
      console.log(`[Slider] Executing event: ${codeStr}`);
      executeScriptWithContext(codeStr, contextViewWrapper);
    }
  };

  let isDragging = false;
  sliderDiv.addEventListener('mousedown', (e) => {
    isDragging = true;
    window.isDraggingSlider = true;
    handlePositionSelection(e);
  });

  window.addEventListener('mousemove', (e) => {
    if (isDragging) {
      handlePositionSelection(e);
    }
  });

  window.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      window.isDraggingSlider = false;
      const onDragEndCode = xmlNode.getAttribute('onDragEnd') || xmlNode.getAttribute('ondragend') || xmlNode.getAttribute('onmouseup');
      if (onDragEndCode) {
        executeScriptWithContext(onDragEndCode.replace(/value/g, String(state.value)), contextViewWrapper);
      }
    }
  });

  // Attach state fields to slider wrapper object
  const wrapper = new WMPElementWrapper(sliderDiv, xmlNode);
  Object.assign(wrapper, state);

  return sliderDiv;
}

// ------------------------------------------
// TEXT VIEWS & MARQUEES
// ------------------------------------------

function createText(xmlNode) {
  const left = xmlNode.getAttribute('left') || '0';
  const top = xmlNode.getAttribute('top') || '0';
  const width = xmlNode.getAttribute('width') || '100';
  const height = xmlNode.getAttribute('height') || '15';
  
  const span = document.createElement('span');
  span.className = 'wmp-text';
  span.style.left = left + 'px';
  span.style.top = top + 'px';
  span.style.width = width + 'px';
  span.style.height = height + 'px';
  
  // Custom styles
  span.style.color = xmlNode.getAttribute('foregroundColor') || xmlNode.getAttribute('foregroundcolor') || '#ffffff';
  span.style.fontSize = (xmlNode.getAttribute('fontSize') || xmlNode.getAttribute('fontsize') || '10') + 'px';
  span.style.textAlign = (xmlNode.getAttribute('justification') || xmlNode.getAttribute('justification') || 'left').toLowerCase();
  
  span.textContent = xmlNode.getAttribute('value') || '';

  // Scrolling behavior if enabled
  const scrolling = xmlNode.getAttribute('scrolling') === 'true';
  if (scrolling) {
    span.style.overflow = 'hidden';
    span.style.whiteSpace = 'nowrap';
    
    // Add scrolling behavior
    let scrollPos = 0;
    setInterval(() => {
      const scrollWidth = span.scrollWidth;
      const containerWidth = span.clientWidth;
      if (scrollWidth > containerWidth) {
        scrollPos += 1;
        if (scrollPos > scrollWidth) {
          scrollPos = -containerWidth;
        }
        span.scrollLeft = scrollPos;
      } else {
        span.scrollLeft = 0;
      }
    }, parseInt(xmlNode.getAttribute('scrollingDelay') || '40'));
  }

  return span;
}

// ------------------------------------------
// AUDIO VISUALIZERS (<effects>)
// ------------------------------------------

function createVisualizer(xmlNode, parentEl) {
  const left = xmlNode.getAttribute('left') || '0';
  const top = xmlNode.getAttribute('top') || '0';
  const width = xmlNode.getAttribute('width') || '60';
  const height = xmlNode.getAttribute('height') || '60';

  const container = document.createElement('div');
  container.className = 'wmp-effects';
  container.style.position = 'absolute';
  container.style.left = left + 'px';
  container.style.top = top + 'px';
  container.style.width = width + 'px';
  container.style.height = height + 'px';
  container.style.overflow = 'hidden';
  container.style.backgroundColor = '#000'; // Black background by default like original media player

  // Find the nearest ancestor with a mask image to clip visualizer to the window shape
  if (parentEl) {
    let ancestor = parentEl;
    let maskImage = null;
    let accumLeft = parseInt(left) || 0;
    let accumTop = parseInt(top) || 0;

    while (ancestor) {
      if (ancestor.dataset && ancestor.dataset.maskImage) {
        maskImage = ancestor.dataset.maskImage;
        break;
      }
      accumLeft += ancestor.offsetLeft || 0;
      accumTop += ancestor.offsetTop || 0;
      ancestor = ancestor.parentElement;
    }

    if (maskImage) {
      container.style.webkitMaskImage = `url("${maskImage}")`;
      container.style.webkitMaskPosition = `-${accumLeft}px -${accumTop}px`;
      container.style.webkitMaskRepeat = 'no-repeat';
      container.style.webkitMaskSize = 'auto';
      container.style.maskImage = `url("${maskImage}")`;
      container.style.maskPosition = `-${accumLeft}px -${accumTop}px`;
      container.style.maskRepeat = 'no-repeat';
      container.style.maskSize = 'auto';
    }
  }
  if (xmlNode.getAttribute('visible') === 'false') {
    container.style.display = 'none';
  }

  const canvas = document.createElement('canvas');
  canvas.width = parseInt(width);
  canvas.height = parseInt(height);
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  
  // Custom click cycle effect type
  const onClick = xmlNode.getAttribute('onClick') || xmlNode.getAttribute('onclick');
  if (onClick) {
    container.addEventListener('click', () => {
      executeScript(onClick);
    });
  }

  // Draw audio visualizer animation loop
  const drawVis = () => {
    if (!ctx) return;
    
    // Clear and fill with black to guarantee a solid black background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const isPlaying = window.player.playState === wmppsPlaying;
    const currentPreset = window.mediacenter ? (window.mediacenter.effectPreset % 3) : 0;

    if (currentPreset === 2) {
      // Preset 2 is "Off" - do not draw visualizer
      requestAnimationFrame(drawVis);
      return;
    }
    
    if (isPlaying && audioAnalyser) {
      if (currentPreset === 0) {
        // Preset 0: Bars
        const bufferLength = audioAnalyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        audioAnalyser.getByteFrequencyData(dataArray);

        // Draw standard green dancing visualizer bars matching WMP retro themes
        const barWidth = (canvas.width / bufferLength) * 1.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * canvas.height;
          ctx.fillStyle = '#48E163'; // retro green
          ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
          x += barWidth;
        }
      } else if (currentPreset === 1) {
        // Preset 1: Waveform / Scope (Oscilloscope)
        const bufferLength = audioAnalyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        audioAnalyser.getByteTimeDomainData(dataArray);

        ctx.strokeStyle = '#48E163';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const sliceWidth = canvas.width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * canvas.height) / 2;
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
      }
    } else {
      // Draw idle line matching the preset type
      ctx.strokeStyle = '#48E163';
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (currentPreset === 0) {
        // Draw flat line at the bottom for bars
        ctx.moveTo(0, canvas.height - 2);
        ctx.lineTo(canvas.width, canvas.height - 2);
      } else {
        // Draw flat line in the center for waveform
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
      }
      ctx.stroke();
    }

    requestAnimationFrame(drawVis);
  };
  requestAnimationFrame(drawVis);

  return container;
}

// ==========================================
// SKIN INTERNALS UTILITIES
// ==========================================

// Process Hex Color Transparency mapping
const imageCache = new Map();
async function getProcessedSkinImageURL(imageName, transColor, clipColor) {
  const cacheKey = `${imageName}_${transColor}_${clipColor}`;
  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey);
  }
  const url = `wmp-skin://local/${encodeURIComponent(imageName)}`;
  const processedUrl = await loadAndProcessImage(url, transColor, clipColor);
  imageCache.set(cacheKey, processedUrl);
  return processedUrl;
}

function loadAndProcessImage(src, transparencyColor, clippingColor) {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = src;
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        if (transparencyColor || clippingColor) {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imgData.data;

          const parseHex = (hex) => {
            if (!hex) return null;
            hex = hex.replace('#', '').trim();
            if (hex.length === 3) {
              return {
                r: parseInt(hex[0] + hex[0], 16),
                g: parseInt(hex[1] + hex[1], 16),
                b: parseInt(hex[2] + hex[2], 16)
              };
            }
            if (hex.length === 6) {
              return {
                r: parseInt(hex.substring(0, 2), 16),
                g: parseInt(hex.substring(2, 4), 16),
                b: parseInt(hex.substring(4, 6), 16)
              };
            }
            return null;
          };

          const tColor = parseHex(transparencyColor);
          const cColor = parseHex(clippingColor);

          const matchColor = (r, g, b, target) => {
            if (!target) return false;
            // Standard color key matching requires strict or small tolerance
            return Math.abs(r - target.r) < 10 && Math.abs(g - target.g) < 10 && Math.abs(b - target.b) < 10;
          };

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            if (matchColor(r, g, b, tColor) || matchColor(r, g, b, cColor)) {
              data[i + 3] = 0; // Transparent alpha channel
            }
          }
          ctx.putImageData(imgData, 0, 0);
        }
        resolve(canvas.toDataURL());
      } catch (e) {
        console.error('Error processing image transparency, falling back to raw:', e);
        resolve(src);
      }
    };
    img.onerror = () => {
      resolve(src); // Fallback to raw if load fails
    };
  });
}

// Load external JScripts associated with view
async function loadSkinScripts(viewNode) {
  const scriptFilesAttr = viewNode.getAttribute('scriptFile') || viewNode.getAttribute('scriptfile') || '';
  const scriptFiles = scriptFilesAttr.split(';').map(s => s.trim()).filter(s => s && !s.startsWith('res://'));

  for (let scriptName of scriptFiles) {
    if (loadedScripts.has(scriptName)) continue;
    loadedScripts.add(scriptName);
    const code = await window.electronAPI.readSkinTextFile(scriptName);
    if (code) {
      try {
        // Evaluate code in global window scope
        window.eval(code);
        console.log(`Executed skin script: ${scriptName}`);
      } catch (e) {
        console.error(`Error executing script ${scriptName}:`, e);
      }
    }
  }
}

// Execute JScript/JS events (e.g. from attributes)
function executeScript(scriptStr) {
  let cleanCode = scriptStr.trim();
  if (cleanCode.toLowerCase().startsWith('jscript:')) {
    cleanCode = cleanCode.substring(8);
  } else if (cleanCode.toLowerCase().startsWith('javascript:')) {
    cleanCode = cleanCode.substring(11);
  }

  try {
    // Run in global scope
    window.eval(cleanCode);
  } catch (e) {
    console.error('Error executing skin expression:', cleanCode, e);
  }
}

// Data bindings lookup frame loop
function updateBindingsLoop() {
  for (const binding of activeBindings) {
    const val = resolveWmpProp(binding.propPath);
    if (val !== undefined && val !== binding.lastValue) {
      binding.lastValue = val;
      binding.updateFn(val);
    }
  }
  animationFrameId = requestAnimationFrame(updateBindingsLoop);
}

function resolveWmpProp(path) {
  // Resolve string path like "player.settings.volume"
  // Normalize variations of currentMedia and player controls casing
  const cleanPath = path
    .replace(/player\./gi, 'window.player.')
    .replace(/view\./gi, 'window.view.')
    .replace(/theme\./gi, 'window.theme.')
    .replace(/\.currentmedia/gi, '.currentMedia')
    .replace(/\.controls/gi, '.controls')
    .replace(/\.settings/gi, '.settings')
    .replace(/\.duration/gi, '.duration')
    .replace(/\.currentposition/gi, '.currentPosition');
    
  try {
    return (new Function(`return ${cleanPath}`))();
  } catch (e) {
    return undefined;
  }
}

function createPlaylist(xmlNode) {
  const left = xmlNode.getAttribute('left') || '0';
  const top = xmlNode.getAttribute('top') || '0';
  const width = xmlNode.getAttribute('width') || '100%';
  const height = xmlNode.getAttribute('height') || '100%';

  const el = document.createElement('div');
  el.className = 'wmp-playlist';
  el.style.position = 'absolute';
  el.style.left = left.startsWith('jscript:') ? '0px' : (left + 'px');
  el.style.top = top.startsWith('jscript:') ? '0px' : (top + 'px');
  el.style.width = width.startsWith('jscript:') ? '100%' : (width + 'px');
  el.style.height = height.startsWith('jscript:') ? '100%' : (height + 'px');
  el.style.overflowY = 'auto';
  el.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
  el.style.border = '1px solid rgba(255, 255, 255, 0.1)';
  el.style.padding = '8px';
  el.style.fontFamily = 'monospace';
  el.style.fontSize = '11px';
  el.style.color = '#8ab4f8';

  const updatePlaylistUI = () => {
    const mediaName = window.player.currentMedia.name || 'No Track Loaded';
    el.innerHTML = `
      <div class="wmp-playlist-title" style="font-weight: bold; margin-bottom: 8px; color: #e8eaed; border-bottom: 1px solid rgba(255, 255, 255, 0.15); padding-bottom: 4px;">PLAYLIST</div>
      <div class="wmp-playlist-item active" style="padding: 4px 6px; background: rgba(99, 102, 241, 0.15); border-left: 2px solid #6366f1; color: #fff; display: flex; justify-content: space-between; align-items: center;">
        <span>▶ ${mediaName}</span>
        <span style="color: #94a3b8;">${window.player.currentMedia.durationString || '--:--'}</span>
      </div>
    `;
  };
  updatePlaylistUI();

  window.player.addEventListener('OpenState_onchange', updatePlaylistUI);
  window.player.addEventListener('PlayState_onchange', updatePlaylistUI);

  return el;
}

function createVideoElement(xmlNode) {
  const left = xmlNode.getAttribute('left') || '0';
  const top = xmlNode.getAttribute('top') || '0';
  const width = xmlNode.getAttribute('width') || '100%';
  const height = xmlNode.getAttribute('height') || '100%';

  const el = document.createElement('div');
  el.className = 'wmp-video-screen';
  el.style.position = 'absolute';
  el.style.left = left.startsWith('jscript:') ? '0px' : (left + 'px');
  el.style.top = top.startsWith('jscript:') ? '0px' : (top + 'px');
  el.style.width = width.startsWith('jscript:') ? '100%' : (width + 'px');
  el.style.height = height.startsWith('jscript:') ? '100%' : (height + 'px');
  el.style.backgroundColor = '#000';
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.style.color = '#374151';
  el.style.fontFamily = 'sans-serif';
  el.style.fontSize = '12px';
  el.innerHTML = '<span style="color: #4b5563;">[ Video Screen ]</span>';

  return el;
}

function createVideoSettings(xmlNode) {
  const el = document.createElement('div');
  el.style.display = 'none';
  return el;
}

class WMPEqualizerSettings {
  constructor() {
    this.gainLevel1 = 0;
    this.gainLevel2 = 0;
    this.gainLevel3 = 0;
    this.gainLevel4 = 0;
    this.gainLevel5 = 0;
    this.gainLevel6 = 0;
    this.gainLevel7 = 0;
    this.gainLevel8 = 0;
    this.gainLevel9 = 0;
    this.gainLevel10 = 0;
    this.crossFade = false;
    this.crossFadeWindow = 0;
    this.enhancedAudio = false;
    this.truBassLevel = 0;
    this.wowLevel = 0;
    this.currentPresetTitle = "Custom";
    this.currentSpeakerName = "Stereo Speakers";
  }

  reset() {
    console.log('WMP: eq.reset() called');
    this.gainLevel1 = 0;
    this.gainLevel2 = 0;
    this.gainLevel3 = 0;
    this.gainLevel4 = 0;
    this.gainLevel5 = 0;
    this.gainLevel6 = 0;
    this.gainLevel7 = 0;
    this.gainLevel8 = 0;
    this.gainLevel9 = 0;
    this.gainLevel10 = 0;
    this.truBassLevel = 0;
    this.wowLevel = 0;
  }

  nextPreset() {
    console.log('WMP: eq.nextPreset() called');
  }

  nextpreset() {
    this.nextPreset();
  }

  previousPreset() {
    console.log('WMP: eq.previousPreset() called');
  }

  previouspreset() {
    this.previousPreset();
  }
}

function createEqualizerSettings(xmlNode) {
  const el = document.createElement('div');
  el.style.display = 'none';
  const eqState = new WMPEqualizerSettings();
  return { el, state: eqState };
}

// Visualizer Masking & Clipping Helpers
const maskCache = new Map();
async function getProcessedSkinMaskURL(imageName, transColor, clipColor) {
  // Generate a mask where ONLY the clippingColor is transparent (and transColor is opaque)
  const cacheKey = `${imageName}_mask_${clipColor}`;
  if (maskCache.has(cacheKey)) {
    return maskCache.get(cacheKey);
  }
  const url = `wmp-skin://local/${encodeURIComponent(imageName)}`;
  const processedUrl = await loadAndProcessImage(url, null, clipColor);
  maskCache.set(cacheKey, processedUrl);
  return processedUrl;
}

function updateElementMaskPosition(el) {
  if (!el || !el.style.webkitMaskImage || el.style.webkitMaskImage === 'none') return;
  
  let ancestor = el.parentElement;
  let accumLeft = parseInt(el.style.left) || 0;
  let accumTop = parseInt(el.style.top) || 0;
  
  while (ancestor) {
    if (ancestor.dataset && ancestor.dataset.maskImage) {
      break;
    }
    accumLeft += ancestor.offsetLeft || 0;
    accumTop += ancestor.offsetTop || 0;
    ancestor = ancestor.parentElement;
  }
  
  const maskPos = `-${accumLeft}px -${accumTop}px`;
  el.style.webkitMaskPosition = maskPos;
  el.style.maskPosition = maskPos;
}


