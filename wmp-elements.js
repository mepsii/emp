// WMP Element Wrapper Class and DOM Component Factories

// Wrapper class to map HTML DOM elements to WMP JScript skin expectations
class WMPElementWrapper {
  constructor(domElement, xmlNode) {
    this.el = domElement;
    this.node = xmlNode;
    this.id = xmlNode ? xmlNode.getAttribute('id') : null;
    this._value = xmlNode ? (xmlNode.getAttribute('value') || '') : '';
    
    // Fallback variables for elements without DOM nodes (e.g. mapped buttons)
    this._visible = xmlNode ? (xmlNode.getAttribute('visible') !== 'false') : true;
    this._width = xmlNode ? (parseInt(xmlNode.getAttribute('width')) || 0) : 0;
    this._height = xmlNode ? (parseInt(xmlNode.getAttribute('height')) || 0) : 0;
    this._left = xmlNode ? (parseInt(xmlNode.getAttribute('left')) || 0) : 0;
    this._top = xmlNode ? (parseInt(xmlNode.getAttribute('top')) || 0) : 0;
    this._enabled = xmlNode ? (xmlNode.getAttribute('enabled') !== 'false') : true;
    this._tabStop = xmlNode ? (xmlNode.getAttribute('tabStop') !== 'false' && xmlNode.getAttribute('tabstop') !== 'false') : true;
    
    this._tooltip = xmlNode ? (
      xmlNode.getAttribute('upToolTip') || 
      xmlNode.getAttribute('uptooltip') || 
      xmlNode.getAttribute('toolTip') || 
      xmlNode.getAttribute('tooltip') || 
      ''
    ) : '';

    // Supply standard defaults if not specified
    if (xmlNode && !this._tooltip) {
      const tag = xmlNode.nodeName.toLowerCase();
      const idLower = (xmlNode.getAttribute('id') || '').toLowerCase();
      if (tag.startsWith('play')) this._tooltip = 'Play';
      else if (tag.startsWith('pause')) this._tooltip = 'Pause';
      else if (tag.startsWith('stop')) this._tooltip = 'Stop';
      else if (tag.startsWith('prev')) this._tooltip = 'Previous';
      else if (tag.startsWith('next')) this._tooltip = 'Next';
      else if (tag === 'slider' || tag === 'customslider') {
        if (idLower.includes('volume')) this._tooltip = 'Volume';
        else if (idLower.includes('seek')) this._tooltip = 'Seek';
      }
    }

    if (this.el && this._tooltip) {
      this.el.title = this._tooltip;
    }
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
        if (this.el.classList.contains('wmp-text-scrolling')) {
          const segment1 = this.el.querySelector('.wmp-text-seg1');
          return segment1 ? segment1.textContent : this._value;
        }
        return this.el.textContent;
      }
    }
    return this._value;
  }

  set value(val) {
    this._value = val;
    if (this.el) {
      if (this.el.tagName === 'SPAN' || this.el.classList.contains('wmp-text')) {
        if (this.el.classList.contains('wmp-text-scrolling')) {
          const segment1 = this.el.querySelector('.wmp-text-seg1');
          const segment2 = this.el.querySelector('.wmp-text-seg2');
          if (segment1 && segment2) {
            segment1.textContent = val;
            segment2.textContent = val;
          } else {
            this.el.textContent = val;
          }
        } else {
          this.el.textContent = val;
        }
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

  get minWidth() {
    if (this._minWidth !== undefined) return this._minWidth;
    return this.node ? (parseInt(this.node.getAttribute('minWidth') || this.node.getAttribute('minwidth')) || this.width) : this.width;
  }
  set minWidth(val) {
    this._minWidth = parseInt(val) || 0;
  }
  get minwidth() { return this.minWidth; }
  set minwidth(val) { this.minWidth = val; }
  
  get minHeight() {
    if (this._minHeight !== undefined) return this._minHeight;
    return this.node ? (parseInt(this.node.getAttribute('minHeight') || this.node.getAttribute('minheight')) || this.height) : this.height;
  }
  set minHeight(val) {
    this._minHeight = parseInt(val) || 0;
  }
  get minheight() { return this.minHeight; }
  set minheight(val) { this.minHeight = val; }

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

  get textWidth() {
    if (this._textWidth !== undefined) return this._textWidth;
    if (this.el) {
      if (this.el.classList.contains('wmp-text-scrolling')) {
        const seg1 = this.el.querySelector('.wmp-text-seg1');
        return seg1 ? (seg1.offsetWidth || seg1.scrollWidth || 0) : (this.el.scrollWidth || 0);
      }
      return this.el.scrollWidth || 0;
    }
    return 0;
  }
  set textWidth(val) {
    this._textWidth = parseInt(val) || 0;
  }
  get textwidth() { return this.textWidth; }
  set textwidth(val) { this.textWidth = val; }

  get scrolling() {
    return this.el ? this.el.classList.contains('wmp-text-scrolling') : this._scrolling;
  }
  set scrolling(val) {
    const isScroll = (val === true || val === 'true' || val === 1 || val === '1');
    this._scrolling = isScroll;
    if (this.el && (this.el.tagName === 'SPAN' || this.el.classList.contains('wmp-text'))) {
      const hasClass = this.el.classList.contains('wmp-text-scrolling');
      if (isScroll && !hasClass) {
        this.el.classList.add('wmp-text-scrolling');
        this.el.style.overflow = 'hidden';
        this.el.style.whiteSpace = 'nowrap';
        this.el.style.display = 'inline-block';
        
        let scrollerWrapper = this.el.querySelector('div');
        if (!scrollerWrapper) {
          const currentText = this.el.textContent;
          this.el.textContent = '';
          
          scrollerWrapper = document.createElement('div');
          scrollerWrapper.style.display = 'inline-block';
          scrollerWrapper.style.whiteSpace = 'nowrap';
          scrollerWrapper.style.width = 'max-content';

          const seg1 = document.createElement('span');
          seg1.className = 'wmp-text-seg1';
          seg1.textContent = currentText;

          const spacer = document.createElement('span');
          spacer.innerHTML = ' &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ';

          const seg2 = document.createElement('span');
          seg2.className = 'wmp-text-seg2';
          seg2.textContent = currentText;

          scrollerWrapper.appendChild(seg1);
          scrollerWrapper.appendChild(spacer);
          scrollerWrapper.appendChild(seg2);
          this.el.appendChild(scrollerWrapper);
        }
      } else if (!isScroll && hasClass) {
        this.el.classList.remove('wmp-text-scrolling');
        const seg1 = this.el.querySelector('.wmp-text-seg1');
        const textVal = seg1 ? seg1.textContent : this.el.textContent;
        this.el.textContent = textVal;
      }
    }
  }

  // Tooltip bindings
  get toolTip() { return this.el ? this.el.title : this._tooltip; }
  set toolTip(val) {
    this._tooltip = val;
    if (this.el) this.el.title = val;
  }
  get tooltip() { return this.toolTip; }
  set tooltip(val) { this.toolTip = val; }

  get upToolTip() { return this.toolTip; }
  set upToolTip(val) { this.toolTip = val; }
  get uptooltip() { return this.toolTip; }
  set uptooltip(val) { this.toolTip = val; }

  get image() { return this._image; }
  set image(val) {
    this._image = val;
    if (this.el) {
      getProcessedSkinImageURL(val, this.transColor, this.clipColor).then(url => {
        this._defaultBg = url;
        if (this.updateButtonUI) this.updateButtonUI();
      });
    }
  }

  get hoverImage() { return this._hoverImage; }
  set hoverImage(val) {
    this._hoverImage = val;
    if (this.el) {
      getProcessedSkinImageURL(val, this.transColor, this.clipColor).then(url => {
        this._hoverBg = url;
        if (this.updateButtonUI) this.updateButtonUI();
      });
    }
  }
  get hoverimage() { return this.hoverImage; }
  set hoverimage(val) { this.hoverImage = val; }

  get downImage() { return this._downImage; }
  set downImage(val) {
    this._downImage = val;
    if (this.el) {
      getProcessedSkinImageURL(val, this.transColor, this.clipColor).then(url => {
        this._downBg = url;
        if (this.updateButtonUI) this.updateButtonUI();
      });
    }
  }
  get downimage() { return this.downImage; }
  set downimage(val) { this.downImage = val; }

  get disabledImage() { return this._disabledImage; }
  set disabledImage(val) {
    this._disabledImage = val;
    if (this.el) {
      getProcessedSkinImageURL(val, this.transColor, this.clipColor).then(url => {
        this._disabledBg = url;
        if (this.updateButtonUI) this.updateButtonUI();
      });
    }
  }
  get disabledimage() { return this.disabledImage; }
  set disabledimage(val) { this.disabledImage = val; }

  get enabled() {
    return this._enabled !== false;
  }
  set enabled(val) {
    const isEnabled = (val === true || val === 'true' || val === 1 || val === '1');
    this._enabled = isEnabled;
    if (this.el) {
      if (isEnabled) {
        this.el.classList.remove('disabled');
        this.el.style.pointerEvents = '';
      } else {
        this.el.classList.add('disabled');
        this.el.style.pointerEvents = 'none';
      }
    }
    if (this.updateButtonUI) this.updateButtonUI();
  }

  get tabStop() {
    return this.el ? this.el.tabIndex >= 0 : this._tabStop !== false;
  }
  set tabStop(val) {
    const isStop = (val === true || val === 'true' || val === 1 || val === '1');
    this._tabStop = isStop;
    if (this.el) {
      this.el.tabIndex = isStop ? 0 : -1;
    }
  }
  get tabstop() { return this.tabStop; }
  set tabstop(val) { this.tabStop = val; }

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
    if (this._currentEffectTitle !== undefined) return this._currentEffectTitle;
    const preset = this.currentPreset;
    if (preset === 0) return 'Bars';
    if (preset === 1) return 'Waveform';
    return 'Off';
  }
  set currentEffectTitle(val) {
    this._currentEffectTitle = val;
  }
  get currentPresetTitle() {
    if (this._currentPresetTitle !== undefined) return this._currentPresetTitle;
    const preset = this.currentPreset;
    if (preset === 0) return 'Scope Bars';
    if (preset === 1) return 'Oscilloscope';
    return 'Visualization Off';
  }
  set currentPresetTitle(val) {
    this._currentPresetTitle = val;
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
    if (window.returnToMediaCenter) {
      window.returnToMediaCenter();
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

// Fallback view object when no skin is loaded (e.g. dashboard)
const dashboardViewFallback = {
  minimize: () => window.electronAPI.minimizeWindow(),
  close: () => window.electronAPI.closeWindow(),
  returnToMediaCenter: () => {
    if (window.returnToMediaCenter) {
      window.returnToMediaCenter();
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

async function createButtonGroup(xmlNode, parentTransColor, parentClipColor, contextViewWrapper) {
  const left = xmlNode.getAttribute('left') || '0';
  const top = xmlNode.getAttribute('top') || '0';
  const width = xmlNode.getAttribute('width');
  const height = xmlNode.getAttribute('height');

  const bgImage = xmlNode.getAttribute('image') || xmlNode.getAttribute('backgroundImage') || xmlNode.getAttribute('backgroundimage');
  const hoverImage = xmlNode.getAttribute('hoverImage') || xmlNode.getAttribute('hoverimage');
  const downImage = xmlNode.getAttribute('downImage') || xmlNode.getAttribute('downimage');
  const disabledImage = xmlNode.getAttribute('disabledImage') || xmlNode.getAttribute('disabledimage');
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
  let disabledBg = '';
  
  if (bgImage) {
    defaultBg = await getProcessedSkinImageURL(bgImage, transColor, clipColor);
    bgDiv.style.backgroundImage = `url("${defaultBg}")`;
  }
  if (hoverImage) hoverBg = await getProcessedSkinImageURL(hoverImage, transColor, clipColor);
  if (downImage) downBg = await getProcessedSkinImageURL(downImage, transColor, clipColor);
  if (disabledImage) disabledBg = await getProcessedSkinImageURL(disabledImage, transColor, clipColor);

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
  const disabledImg = await loadImg(disabledBg);

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

  const updateCompositeUI = () => {
    if (!renderCtx) return;
    renderCtx.clearRect(0, 0, w, h);

    if (defaultImg) {
      renderCtx.drawImage(defaultImg, 0, 0);
    }

    // Overlay disabled masks for any disabled buttons
    buttons.forEach(btn => {
      if (btn.wrapper && !btn.wrapper.enabled) {
        if (btn.disabledMask) {
          renderCtx.drawImage(btn.disabledMask, 0, 0);
        }
      }
    });

    if (activeBtn && activeBtn.wrapper && activeBtn.wrapper.enabled) {
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

  for (let tag of buttonTags) {
    const elNodes = findChildNodes(xmlNode, tag);
    elNodes.forEach(node => {
      const btnId = node.getAttribute('id');
      let toolTip = node.getAttribute('upToolTip') || node.getAttribute('uptooltip') || node.getAttribute('toolTip') || node.getAttribute('tooltip');
      if (!toolTip) {
        if (tag === 'playelement') toolTip = 'Play';
        else if (tag === 'pauseelement') toolTip = 'Pause';
        else if (tag === 'stopelement') toolTip = 'Stop';
        else if (tag === 'prevelement') toolTip = 'Previous';
        else if (tag === 'nextelement') toolTip = 'Next';
      }

      const wrapper = new WMPElementWrapper(null, node);
      wrapper.updateButtonUI = () => {
        updateCompositeUI();
      };

      const btnObj = {
        node,
        mappingColor: (node.getAttribute('mappingColor') || node.getAttribute('mappingcolor') || '').toLowerCase(),
        onClick: node.getAttribute('onClick') || node.getAttribute('onclick'),
        toolTip,
        tag,
        wrapper
      };
      buttons.push(btnObj);

      // Expose the button's ID as a global WMPElementWrapper
      if (btnId) {
        window[btnId] = wrapper;
      }

      // Automatically register availability bindings for standard buttons in the group
      let autoProp = null;
      if (tag === 'playelement') autoProp = 'player.controls.play';
      else if (tag === 'pauseelement') autoProp = 'player.controls.pause';
      else if (tag === 'stopelement') autoProp = 'player.controls.stop';
      else if (tag === 'prevelement') autoProp = 'player.controls.previous';
      else if (tag === 'nextelement') autoProp = 'player.controls.next';

      if (autoProp) {
        activeBindings.push({
          wrapper,
          targetProperty: 'enabled',
          propPath: autoProp,
          isWmpEnabled: true,
          contextView: contextViewWrapper,
          lastValue: undefined,
          updateFn: (val) => {
            wrapper.enabled = val;
          }
        });
      }
    });
  }

  // Pre-generate masked state layers for each button
  buttons.forEach(btn => {
    btn.hoverMask = createMaskedCanvas(hoverImg, btn.mappingColor);
    btn.downMask = createMaskedCanvas(downImg, btn.mappingColor);
    btn.disabledMask = createMaskedCanvas(disabledImg, btn.mappingColor);
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

  // Render initial static composite background
  updateCompositeUI();

  bgDiv.addEventListener('mousemove', (e) => {
    const rect = bgDiv.getBoundingClientRect();
    const x = Math.floor(e.clientX - rect.left);
    const y = Math.floor(e.clientY - rect.top);
    
    const btn = findButtonAtCoords(x, y);
    
    if (btn && btn.wrapper && btn.wrapper.enabled) {
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
    if (activeBtn && activeBtn.wrapper && activeBtn.wrapper.enabled) {
      isMouseDown = true;
      updateCompositeUI();
    }
  });

  bgDiv.addEventListener('mouseup', (e) => {
    if (isMouseDown && activeBtn && activeBtn.wrapper && activeBtn.wrapper.enabled) {
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

async function createStandaloneButton(xmlNode, parentTransColor, parentClipColor, contextViewWrapper) {
  const left = xmlNode.getAttribute('left') || '0';
  const top = xmlNode.getAttribute('top') || '0';
  const width = xmlNode.getAttribute('width');
  const height = xmlNode.getAttribute('height');
  const tagName = xmlNode.nodeName.toLowerCase();

  const bgImage = xmlNode.getAttribute('image') || xmlNode.getAttribute('backgroundImage') || xmlNode.getAttribute('backgroundimage');
  const hoverImage = xmlNode.getAttribute('hoverImage') || xmlNode.getAttribute('hoverimage');
  const downImage = xmlNode.getAttribute('downImage') || xmlNode.getAttribute('downimage');
  const disabledImage = xmlNode.getAttribute('disabledImage') || xmlNode.getAttribute('disabledimage');

  const transColor = xmlNode.getAttribute('transparencyColor') || xmlNode.getAttribute('transparencycolor') || parentTransColor;
  const clipColor = xmlNode.getAttribute('clippingColor') || xmlNode.getAttribute('clippingcolor') || parentClipColor;

  const btnDiv = document.createElement('div');
  btnDiv.className = 'wmp-button';
  btnDiv.style.left = left + 'px';
  btnDiv.style.top = top + 'px';

  let defaultBg = '';
  let hoverBg = '';
  let downBg = '';
  let disabledBg = '';

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
  if (disabledImage) disabledBg = await getProcessedSkinImageURL(disabledImage, transColor, clipColor);

  const onClick = xmlNode.getAttribute('onClick') || xmlNode.getAttribute('onclick');
  const sticky = xmlNode.getAttribute('sticky') === 'true';
  const toolTip = xmlNode.getAttribute('upToolTip') || xmlNode.getAttribute('uptooltip') || xmlNode.getAttribute('toolTip') || xmlNode.getAttribute('tooltip');

  btnDiv.title = toolTip || '';

  // Attach state to button element wrapper
  const wrapper = new WMPElementWrapper(btnDiv, xmlNode);
  wrapper.transColor = transColor;
  wrapper.clipColor = clipColor;
  wrapper._image = bgImage;
  wrapper._hoverImage = hoverImage;
  wrapper._downImage = downImage;
  wrapper._disabledImage = disabledImage;
  wrapper._defaultBg = defaultBg;
  wrapper._hoverBg = hoverBg;
  wrapper._downBg = downBg;
  wrapper._disabledBg = disabledBg;

  // Wrapper states (useful if button is sticky like Mute)
  wrapper.isDown = false;
  wrapper.updateButtonUI = () => {
    if (!wrapper.enabled && wrapper._disabledBg) {
      btnDiv.style.backgroundImage = `url("${wrapper._disabledBg}")`;
    } else if (wrapper.isDown && wrapper._downBg) {
      btnDiv.style.backgroundImage = `url("${wrapper._downBg}")`;
    } else {
      btnDiv.style.backgroundImage = `url("${wrapper._defaultBg}")`;
    }
  };

  btnDiv.addEventListener('mouseenter', () => {
    if (wrapper.enabled && !wrapper.isDown && wrapper._hoverBg) {
      btnDiv.style.backgroundImage = `url("${wrapper._hoverBg}")`;
    }
  });

  btnDiv.addEventListener('mouseleave', () => {
    wrapper.updateButtonUI();
  });

  btnDiv.addEventListener('mousedown', () => {
    if (wrapper.enabled && wrapper._downBg) {
      btnDiv.style.backgroundImage = `url("${wrapper._downBg}")`;
    }
  });

  btnDiv.addEventListener('mouseup', () => {
    if (!wrapper.enabled) return;
    if (sticky) {
      wrapper.isDown = !wrapper.isDown;
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

    wrapper.updateButtonUI();
  });

  btnDiv.wmpWrapper = wrapper;

  // Enforce initial disabled styling if necessary
  if (!wrapper.enabled) {
    btnDiv.classList.add('disabled');
    btnDiv.style.pointerEvents = 'none';
    wrapper.updateButtonUI();
  }

  return btnDiv;
}

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

  const borderSizeAttr = xmlNode.getAttribute('borderSize') || xmlNode.getAttribute('bordersize');
  const borderSize = borderSizeAttr ? parseInt(borderSizeAttr) : 0;
  const tiled = xmlNode.getAttribute('tiled') === 'true';
  const direction = xmlNode.getAttribute('direction') || 'horizontal';

  // Determine size
  let sWidth = parseInt(width) || 100;
  let sHeight = parseInt(height) || 20;

  let bgImgObj = null;
  if (bgImage) {
    defaultBg = await getProcessedSkinImageURL(bgImage, transColor, clipColor);
    const img = new Image();
    img.src = defaultBg;
    await new Promise(r => {
      img.onload = () => {
        bgImgObj = img;
        if (!width) sWidth = img.width;
        if (!height) sHeight = img.height;
        r();
      };
      img.onerror = r;
    });
  }
  if (foregroundImage) {
    fgBg = await getProcessedSkinImageURL(foregroundImage, transColor, clipColor);
  }
  if (thumbImage) {
    thumbBg = await getProcessedSkinImageURL(thumbImage, transColor, clipColor);
  }

  sliderDiv.style.width = sWidth + 'px';
  sliderDiv.style.height = sHeight + 'px';

  if (bgImgObj) {
    if (borderSize > 0) {
      const canvas = document.createElement('canvas');
      canvas.style.position = 'absolute';
      canvas.style.left = '0';
      canvas.style.top = '0';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.pointerEvents = 'none';
      sliderDiv.appendChild(canvas);

      canvas.width = sWidth;
      canvas.height = sHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (direction === 'vertical') {
          // Top cap
          ctx.drawImage(bgImgObj, 0, 0, bgImgObj.width, borderSize, 0, 0, sWidth, borderSize);
          // Bottom cap
          ctx.drawImage(bgImgObj, 0, bgImgObj.height - borderSize, bgImgObj.width, borderSize, 0, sHeight - borderSize, sWidth, borderSize);
          // Middle track
          const srcMiddleH = bgImgObj.height - 2 * borderSize;
          const destMiddleH = sHeight - 2 * borderSize;
          if (tiled && srcMiddleH > 0) {
            let y = borderSize;
            while (y < sHeight - borderSize) {
              const drawH = Math.min(srcMiddleH, sHeight - borderSize - y);
              ctx.drawImage(bgImgObj, 0, borderSize, bgImgObj.width, drawH, 0, y, sWidth, drawH);
              y += srcMiddleH;
            }
          } else if (srcMiddleH > 0) {
            ctx.drawImage(bgImgObj, 0, borderSize, bgImgObj.width, srcMiddleH, 0, borderSize, sWidth, destMiddleH);
          }
        } else {
          // Left cap
          ctx.drawImage(bgImgObj, 0, 0, borderSize, bgImgObj.height, 0, 0, borderSize, sHeight);
          // Right cap
          ctx.drawImage(bgImgObj, bgImgObj.width - borderSize, 0, borderSize, bgImgObj.height, sWidth - borderSize, 0, borderSize, sHeight);
          // Middle track
          const srcMiddleW = bgImgObj.width - 2 * borderSize;
          const destMiddleW = sWidth - 2 * borderSize;
          if (tiled && srcMiddleW > 0) {
            let x = borderSize;
            while (x < sWidth - borderSize) {
              const drawW = Math.min(srcMiddleW, sWidth - borderSize - x);
              ctx.drawImage(bgImgObj, borderSize, 0, drawW, bgImgObj.height, x, 0, drawW, sHeight);
              x += srcMiddleW;
            }
          } else if (srcMiddleW > 0) {
            ctx.drawImage(bgImgObj, borderSize, 0, srcMiddleW, bgImgObj.height, borderSize, 0, destMiddleW, sHeight);
          }
        }
      }
    } else {
      sliderDiv.style.backgroundImage = `url("${defaultBg}")`;
      sliderDiv.style.backgroundRepeat = 'no-repeat';
      sliderDiv.style.backgroundSize = '100% 100%';
    }
  }

  // Create Foreground Fill element
  let fillEl = null;
  if (foregroundImage) {
    fillEl = document.createElement('div');
    fillEl.style.position = 'absolute';
    fillEl.style.left = '0px';
    fillEl.style.backgroundImage = `url("${fgBg}")`;
    fillEl.style.backgroundRepeat = xmlNode.getAttribute('tiled') === 'true' ? 'repeat-x' : 'no-repeat';
    if (direction === 'vertical') {
      fillEl.style.bottom = '0px';
      fillEl.style.width = '100%';
      fillEl.style.height = '0%';
      fillEl.style.backgroundPosition = 'bottom left';
    } else {
      fillEl.style.top = '0';
      fillEl.style.left = '0px';
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

  // Attach state fields to slider wrapper object
  const wrapper = new WMPElementWrapper(sliderDiv, xmlNode);
  wrapper.min = parseFloat(xmlNode.getAttribute('min')) || 0;
  wrapper.max = parseFloat(xmlNode.getAttribute('max')) || 100;
  wrapper.value = 0;
  wrapper.direction = direction;
  wrapper.isDragging = false;
  sliderDiv.wmpWrapper = wrapper;

  // Updates the visual fill and thumb position from slider value
  wrapper.updateSliderUI = (val) => {
    const range = wrapper.max - wrapper.min;
    const pct = range > 0 ? (val - wrapper.min) / range : 0;
    const clampedPct = Math.max(0, Math.min(1, pct));

    if (wrapper.direction === 'vertical') {
      const slideHeight = sHeight - 2 * borderSize;
      const topPos = clampedPct * (slideHeight - thumbH);
      if (thumbEl) {
        thumbEl.style.top = (slideHeight - thumbH - topPos + borderSize) + 'px';
        thumbEl.style.left = ((sWidth - thumbW) / 2) + 'px';
      }
      if (fillEl) {
        fillEl.style.height = (clampedPct * 100) + '%';
      }
    } else {
      const slideWidth = sWidth - 2 * borderSize;
      const leftPos = clampedPct * (slideWidth - thumbW);
      if (thumbEl) {
        thumbEl.style.left = (leftPos + borderSize) + 'px';
        thumbEl.style.top = ((sHeight - thumbH) / 2) + 'px';
      }
      if (fillEl) {
        fillEl.style.width = (clampedPct * 100) + '%';
      }
    }
  };

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
        // Force reposition thumb now that correct dimensions are known
        wrapper.updateSliderUI(wrapper.value);
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

  // Slider Interaction logic
  const handlePositionSelection = (e) => {
    const rect = sliderDiv.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let pct = 0;

    if (mapCtx) {
      // Map pixel grayscale level to determine slider value (WMP positionImage standard)
      const pixel = mapCtx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
      const r = pixel[0];
      const a = pixel[3];
      if (a > 0) {
        pct = r / 255;
      } else {
        return; // Ignore clicks outside mapped shape
      }
    } else {
      // Linear slider fallback
      if (wrapper.direction === 'vertical') {
        const slideHeight = sHeight - 2 * borderSize;
        const yInside = y - borderSize;
        pct = 1 - (yInside / slideHeight);
      } else {
        const slideWidth = sWidth - 2 * borderSize;
        const xInside = x - borderSize;
        pct = xInside / slideWidth;
      }
    }

    // Clamp pct to [0, 1] range to avoid sending out-of-bounds inputs
    pct = Math.max(0, Math.min(1, pct));
    const value = wrapper.min + pct * (wrapper.max - wrapper.min);
    wrapper.value = value;

    // Invoke events
    const onChangeCode = xmlNode.getAttribute('value_onchange') || xmlNode.getAttribute('value_onclick');
    if (onChangeCode) {
      const codeStr = onChangeCode.replace(/value/gi, String(value));
      executeScriptWithContext(codeStr, contextViewWrapper);
    }
  };

  sliderDiv.addEventListener('mousedown', (e) => {
    wrapper.isDragging = true;
    window.isDraggingSlider = true;
    handlePositionSelection(e);
  });

  window.addEventListener('mousemove', (e) => {
    if (wrapper.isDragging) {
      handlePositionSelection(e);
    }
  });

  window.addEventListener('mouseup', () => {
    if (wrapper.isDragging) {
      wrapper.isDragging = false;
      window.isDraggingSlider = false;
      const onDragEndCode = xmlNode.getAttribute('onDragEnd') || xmlNode.getAttribute('ondragend') || xmlNode.getAttribute('onmouseup');
      if (onDragEndCode) {
        executeScriptWithContext(onDragEndCode.replace(/value/gi, String(wrapper.value)), contextViewWrapper);
      }
    }
  });

  return sliderDiv;
}

function createText(xmlNode, contextViewWrapper) {
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
  // Use pt (points) for a more prominent font size matching legacy players
  const fsAttr = xmlNode.getAttribute('fontSize') || xmlNode.getAttribute('fontsize') || '10';
  span.style.fontSize = fsAttr + 'pt';
  span.style.textAlign = (xmlNode.getAttribute('justification') || xmlNode.getAttribute('justification') || 'left').toLowerCase();

  const fontStyle = xmlNode.getAttribute('fontStyle') || xmlNode.getAttribute('fontstyle');
  if (fontStyle) {
    const fsLower = fontStyle.toLowerCase();
    if (fsLower.includes('italic')) {
      span.style.fontStyle = 'italic';
    }
    if (fsLower.includes('bold')) {
      span.style.fontWeight = 'bold';
    }
  }

  const cursor = xmlNode.getAttribute('cursor');
  if (cursor === 'hand') {
    span.style.cursor = 'pointer';
  } else if (cursor) {
    span.style.cursor = cursor;
  }
  
  const initialValue = xmlNode.getAttribute('value') || '';
  const scrolling = xmlNode.getAttribute('scrolling') === 'true';

  if (scrolling) {
    span.classList.add('wmp-text-scrolling');
    span.style.overflow = 'hidden';
    span.style.whiteSpace = 'nowrap';
    span.style.display = 'inline-block';

    // Create wrapper div
    const scrollerWrapper = document.createElement('div');
    scrollerWrapper.style.display = 'inline-block';
    scrollerWrapper.style.whiteSpace = 'nowrap';
    scrollerWrapper.style.width = 'max-content';

    // Create segment 1
    const seg1 = document.createElement('span');
    seg1.className = 'wmp-text-seg1';
    seg1.textContent = initialValue;

    // Create spacer
    const spacer = document.createElement('span');
    spacer.innerHTML = ' &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; '; // 8 non-breaking spaces for a clean gap

    // Create segment 2
    const seg2 = document.createElement('span');
    seg2.className = 'wmp-text-seg2';
    seg2.textContent = initialValue;

    scrollerWrapper.appendChild(seg1);
    scrollerWrapper.appendChild(spacer);
    scrollerWrapper.appendChild(seg2);
    span.appendChild(scrollerWrapper);

    // Scroll animation loop
    let scrollPos = 0;
    const scrollInterval = () => {
      // Calculate single width = width of seg1 + spacer width
      const seg1Width = seg1.offsetWidth;
      const spacerWidth = spacer.offsetWidth;
      const loopWidth = seg1Width + spacerWidth;

      if (seg1Width > span.clientWidth) {
        scrollPos += (window.textScrollSpeed || textScrollSpeed); // slow, smooth fractional increments
        if (scrollPos >= loopWidth) {
          scrollPos = 0; // seamless wrap reset
        }
        span.scrollLeft = Math.floor(scrollPos);
      } else {
        span.scrollLeft = 0;
        scrollPos = 0;
      }
    };

    // Run at 60fps (approx 16ms) for perfectly smooth, hardware-like constant scrolling
    setInterval(scrollInterval, 16);
  } else {
    span.textContent = initialValue;
  }

  const toolTip = xmlNode.getAttribute('toolTip') || xmlNode.getAttribute('tooltip') || xmlNode.getAttribute('upToolTip') || xmlNode.getAttribute('uptooltip');
  if (toolTip) {
    span.title = toolTip;
  }

  const wrapper = new WMPElementWrapper(span, xmlNode);
  span.wmpWrapper = wrapper;

  const onClick = xmlNode.getAttribute('onClick') || xmlNode.getAttribute('onclick');
  if (onClick) {
    span.addEventListener('click', () => {
      executeScriptWithContext(onClick, contextViewWrapper);
    });
  }

  return span;
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
    if (window.player) {
      if (window.player.audio) {
        window.player.audio.balance = 0;
      }
      if (window.player.settings) {
        window.player.settings.balance = 0;
      }
    }
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
