// Legacy WMP Shared State & Image/Mask Utilities

// Shared global state variables (declared as globals for WMS script sandbox visibility)
var activeSkinDir = '';
var activeBindings = [];
var audioAnalyser = null;
var audioSourceNode = null;
var audioContext = null;
var animationFrameId = null;
var wmpViews = [];
var loadedScripts = new Set();
var skinRegisteredGlobals = [];
var currentContextView = null;
var draggedView = null;
var dragStartX = 0;
var dragStartY = 0;
var isDraggingSlider = false;
var textScrollSpeed = 0.15; // Default slow crawl speed

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

const maskCache = new Map();
async function getProcessedSkinMaskURL(imageName, transColor, clipColor) {
  const cacheKey = `${imageName}_mask_${transColor}_${clipColor}`;
  if (maskCache.has(cacheKey)) {
    return maskCache.get(cacheKey);
  }
  const url = `wmp-skin://local/${encodeURIComponent(imageName)}`;
  const processedUrl = await loadAndProcessImage(url, transColor, clipColor, true);
  maskCache.set(cacheKey, processedUrl);
  return processedUrl;
}

function loadAndProcessImage(src, transparencyColor, clippingColor, isMask = false) {
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

        if (transparencyColor || clippingColor || isMask) {
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
            return Math.abs(r - target.r) < 10 && Math.abs(g - target.g) < 10 && Math.abs(b - target.b) < 10;
          };

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            const matches = matchColor(r, g, b, tColor) || matchColor(r, g, b, cColor);
            
            if (isMask) {
              data[i + 3] = matches ? 255 : 0;
            } else if (matches) {
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

function updateElementMaskPosition(el) {
  if (!el || !el.style.webkitMaskImage || el.style.webkitMaskImage === 'none') return;
  
  let ancestor = el.parentElement;
  let accumLeft = parseInt(el.style.left) || 0;
  let accumTop = parseInt(el.style.top) || 0;
  
  while (ancestor) {
    accumLeft += ancestor.offsetLeft || 0;
    accumTop += ancestor.offsetTop || 0;
    // Only use view-level masks, not intermediate subview masks
    if (ancestor.classList && ancestor.classList.contains('wmp-view') && ancestor.dataset && ancestor.dataset.maskImage) {
      break;
    }
    ancestor = ancestor.parentElement;
  }
  
  const maskPos = `-${accumLeft}px -${accumTop}px`;
  el.style.webkitMaskPosition = maskPos;
  el.style.maskPosition = maskPos;
}

function returnToMediaCenter() {
  const container = document.getElementById('skin-container');
  const dashboard = document.getElementById('dashboard');
  if (container && dashboard) {
    container.style.display = 'none';
    container.innerHTML = '';
    dashboard.style.display = 'flex';
    
    // Reset layout and binding states
    if (window.animationFrameId) {
      cancelAnimationFrame(window.animationFrameId);
      window.animationFrameId = null;
    }
    if (window.wmpViews) window.wmpViews.length = 0;
    if (window.activeBindings) window.activeBindings.length = 0;
    if (window.loadedScripts) window.loadedScripts.clear();

    // Clean up skin-registered global variables to avoid pollution
    if (window.skinRegisteredGlobals) {
      window.skinRegisteredGlobals.forEach(id => {
        try {
          delete window[id];
        } catch (e) {
          window[id] = undefined;
        }
      });
      window.skinRegisteredGlobals.length = 0;
    }

    // Reset player skin-specific event listeners
    if (window.player && window.player.clearSkinListeners) {
      window.player.clearSkinListeners();
    }
    
    // Stop ignoring mouse events on the main dashboard
    if (window.electronAPI && window.electronAPI.setIgnoreMouseEvents) {
      window.electronAPI.setIgnoreMouseEvents(false);
    }
    
    // Reset Electron window back to default size for dashboard
    window.electronAPI.resizeWindow(450, 520);
  }
}
window.returnToMediaCenter = returnToMediaCenter;
