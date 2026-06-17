// WMP Audio Visualizer Module

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

// Draw audio visualizer animation loop
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
    if (!ctx || !canvas.isConnected) return;
    
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
