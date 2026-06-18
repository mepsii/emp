// Legacy WMP Skin Renderer and Runtime Engine
const dashboard = document.getElementById('dashboard');
const skinContainer = document.getElementById('skin-container');
const skinList = document.getElementById('skin-list');
const btnCustomSkin = document.getElementById('btn-custom-skin');
const btnLoadAudio = document.getElementById('btn-load-audio');
const infoTitle = document.getElementById('info-title');
const infoStatus = document.getElementById('info-status');

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

  window.electronAPI.onMenuScrollSpeed((speed) => {
    console.log('Menu scroll speed changed to:', speed);
    if (speed === 'slow') {
      window.textScrollSpeed = 0.15;
    } else if (speed === 'medium') {
      window.textScrollSpeed = 0.35;
    } else if (speed === 'fast') {
      window.textScrollSpeed = 0.75;
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
          const eventName = attr.name;
          window.player.addEventListener(eventName, attr.value);
          // Also register under the short name just in case
          if (attr.name.includes('_')) {
            const shortName = attr.name.substring(0, attr.name.indexOf('_'));
            window.player.addEventListener(shortName, attr.value);
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

  // 5. Call onLoad event of all views if defined (deferred slightly to ensure browser layout is calculated)
  setTimeout(() => {
    for (const viewNode of viewNodes) {
      const viewId = viewNode.getAttribute('id') || 'view';
      const viewWrapper = window[viewId];
      if (viewWrapper && wmpViews.includes(viewWrapper)) {
        const onLoadScript = viewNode.getAttribute('onLoad') || viewNode.getAttribute('onload');
        if (onLoadScript) {
          executeScriptWithContext(onLoadScript, viewWrapper);
        }
      }
    }
  }, 50);

  // 6. Update layout
  updateVirtualLayout();

  // 7. Start binding loop
  updateBindingsLoop();
}

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
  if (window.skinRegisteredGlobals) {
    window.skinRegisteredGlobals.push(viewId);
  }
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

    // Enforce visible="false" globally for all element types
    if (visible === 'false') {
      el.style.display = 'none';
    }

    // Create wrapper for script lookup
    const wrapper = el.wmpWrapper || new WMPElementWrapper(el, xmlNode);
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
      if (window.skinRegisteredGlobals) {
        window.skinRegisteredGlobals.push(id);
      }
    }

    // Apply zIndex stacking to allow visualizer elements to render behind background textures
    const zIndex = xmlNode.getAttribute('zIndex') || xmlNode.getAttribute('zindex');
    let defaultZIndex = '1';
    if (tagName === 'effects') {
      defaultZIndex = '-1';
    } else if (tagName === 'subview') {
      defaultZIndex = '2'; // Subviews default to a higher stacking index than standalone controls
    }
    
    let zIndexVal = zIndex || defaultZIndex;
    el.style.zIndex = zIndexVal;

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
