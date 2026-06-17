// WMP Virtual Layout SNAP and dragging coordinate manager

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
  const dashboard = document.getElementById('dashboard');
  if (dashboard && dashboard.style.display !== 'none') {
    window.electronAPI.setIgnoreMouseEvents(false);
  } else if (wmpViews.length > 0) {
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
