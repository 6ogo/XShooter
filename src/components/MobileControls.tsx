// Enhance the MobileControls.tsx component for better mobile support
// Update the MobileControls component with these improvements:

import { useEffect, useRef, useState } from 'react';
import { Target, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

interface JoystickPosition {
  x: number;
  y: number;
}

interface MobileControlsProps {
  onMove: (dx: number, dy: number) => void;
  onShoot: (x: number, y: number) => void;
}

export function MobileControls({ onMove, onShoot }: MobileControlsProps) {
  const joystickRef = useRef<HTMLDivElement>(null);
  const joystickKnobRef = useRef<HTMLDivElement>(null);
  const joystickContainerRef = useRef<HTMLDivElement>(null);
  const [joystickActive, setJoystickActive] = useState(false);
  const [joystickPosition, setJoystickPosition] = useState<JoystickPosition>({ x: 0, y: 0 });
  const [joystickCenter, setJoystickCenter] = useState<JoystickPosition>({ x: 0, y: 0 });
  const [showDpadControls, setShowDpadControls] = useState(false);
  const [lastShootTime, setLastShootTime] = useState(0);
  const [shootButtonActive, setShootButtonActive] = useState(false);
  const [lastTouchId, setLastTouchId] = useState<number | null>(null);
  const maxDistance = 40; // Maximum joystick movement radius
  const shootCooldown = 100; // Minimum time between shots in ms to prevent spamming

  const toggleControlType = () => {
    setShowDpadControls(!showDpadControls);
    // Save preference
    localStorage.setItem('preferDpad', (!showDpadControls).toString());
  };

  useEffect(() => {
    // Load control preference
    const preferDpad = localStorage.getItem('preferDpad') === 'true';
    setShowDpadControls(preferDpad);

    if (joystickRef.current && joystickContainerRef.current) {
      const updateJoystickCenter = () => {
        const rect = joystickRef.current?.getBoundingClientRect();
        if (rect) {
          setJoystickCenter({
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
          });
        }
      };

      // Update center position initially and on resize/orientation change
      updateJoystickCenter();
      
      const resizeObserver = new ResizeObserver(updateJoystickCenter);
      resizeObserver.observe(joystickContainerRef.current);
      
      window.addEventListener('resize', updateJoystickCenter);
      window.addEventListener('orientationchange', updateJoystickCenter);
      
      return () => {
        if (joystickContainerRef.current) {
          resizeObserver.unobserve(joystickContainerRef.current);
        }
        window.removeEventListener('resize', updateJoystickCenter);
        window.removeEventListener('orientationchange', updateJoystickCenter);
      };
    }
  }, []);

  const handleJoystickStart = (e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    setLastTouchId(touch.identifier);
    setJoystickActive(true);
    handleJoystickMove(e);
  };

  const handleJoystickMove = (e: React.TouchEvent) => {
    if (!joystickActive) return;
    
    // Find the touch that started the joystick
    let touch: React.Touch | undefined;
    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === lastTouchId) {
        touch = e.touches[i];
        break;
      }
    }
    
    if (!touch) return;

    let dx = touch.clientX - joystickCenter.x;
    let dy = touch.clientY - joystickCenter.y;

    // Calculate the distance from center
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Normalize if beyond max distance
    if (distance > maxDistance) {
      dx = (dx / distance) * maxDistance;
      dy = (dy / distance) * maxDistance;
    }

    setJoystickPosition({ x: dx, y: dy });

    // Calculate movement direction with normalized values (0-1)
    const moveX = dx / maxDistance;
    const moveY = dy / maxDistance;
    
    // Call the onMove callback with normalized values
    onMove(moveX * 5, moveY * 5); // Multiply by desired speed
  };

  const handleJoystickEnd = (e: React.TouchEvent) => {
    // Only end if this is the touch that started the joystick
    let touchFound = false;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === lastTouchId) {
        touchFound = true;
        break;
      }
    }
    
    if (touchFound) {
      setJoystickActive(false);
      setJoystickPosition({ x: 0, y: 0 });
      setLastTouchId(null);
      onMove(0, 0); // Stop movement
    }
  };

  const handleShootStart = (e: React.TouchEvent) => {
    // Only handle shoot action if the touch is on the right side of the screen
    const touchX = e.touches[0].clientX;
    const screenWidth = window.innerWidth;
    
    if (touchX > screenWidth / 2) {
      e.preventDefault();
      const now = Date.now();
      
      // Check cooldown to prevent rapid fire spamming
      if (now - lastShootTime > shootCooldown) {
        setLastShootTime(now);
        setShootButtonActive(true);
        onShoot(touchX, e.touches[0].clientY);
        
        // Auto release after a short delay for visual feedback
        setTimeout(() => {
          setShootButtonActive(false);
        }, 100);
      }
    }
  };
  
  const handleDpadButton = (direction: 'up' | 'down' | 'left' | 'right') => {
    let dx = 0;
    let dy = 0;
    
    switch (direction) {
      case 'up':
        dy = -1;
        break;
      case 'down':
        dy = 1;
        break;
      case 'left':
        dx = -1;
        break;
      case 'right':
        dx = 1;
        break;
    }
    
    onMove(dx * 5, dy * 5); // Multiply by desired speed
  };
  
  const handleDpadButtonRelease = () => {
    onMove(0, 0); // Stop movement
  };

  return (
    <div className="fixed bottom-0 left-0 w-full h-40 pointer-events-none z-30">
      {/* Toggle Controls Button */}
      <button
        className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-full bg-gray-800 bg-opacity-60 text-white text-xs px-3 py-2 rounded-t-lg pointer-events-auto"
        onClick={toggleControlType}
      >
        {showDpadControls ? 'Switch to Joystick' : 'Switch to D-Pad'}
      </button>
      
      {/* Left side: Joystick or D-Pad */}
      {showDpadControls ? (
        <div className="absolute bottom-10 left-10 grid grid-cols-3 grid-rows-3 gap-1 w-32 h-32 pointer-events-auto">
          <div className="col-start-1 row-start-1"></div>
          <button
            className="col-start-2 row-start-1 bg-white bg-opacity-20 rounded-lg flex items-center justify-center active:bg-opacity-40"
            onTouchStart={() => handleDpadButton('up')}
            onTouchEnd={handleDpadButtonRelease}
            onTouchCancel={handleDpadButtonRelease}
            aria-label="Move Up"
          >
            <ChevronUp className="text-white" size={24} />
          </button>
          <div className="col-start-3 row-start-1"></div>
          
          <button
            className="col-start-1 row-start-2 bg-white bg-opacity-20 rounded-lg flex items-center justify-center active:bg-opacity-40"
            onTouchStart={() => handleDpadButton('left')}
            onTouchEnd={handleDpadButtonRelease}
            onTouchCancel={handleDpadButtonRelease}
            aria-label="Move Left"
          >
            <ChevronLeft className="text-white" size={24} />
          </button>
          <div className="col-start-2 row-start-2 bg-white bg-opacity-10 rounded-lg"></div>
          <button
            className="col-start-3 row-start-2 bg-white bg-opacity-20 rounded-lg flex items-center justify-center active:bg-opacity-40"
            onTouchStart={() => handleDpadButton('right')}
            onTouchEnd={handleDpadButtonRelease}
            onTouchCancel={handleDpadButtonRelease}
            aria-label="Move Right"
          >
            <ChevronRight className="text-white" size={24} />
          </button>
          
          <div className="col-start-1 row-start-3"></div>
          <button
            className="col-start-2 row-start-3 bg-white bg-opacity-20 rounded-lg flex items-center justify-center active:bg-opacity-40"
            onTouchStart={() => handleDpadButton('down')}
            onTouchEnd={handleDpadButtonRelease}
            onTouchCancel={handleDpadButtonRelease}
            aria-label="Move Down"
          >
            <ChevronDown className="text-white" size={24} />
          </button>
          <div className="col-start-3 row-start-3"></div>
        </div>
      ) : (
        <div 
          ref={joystickContainerRef}
          className="absolute bottom-10 left-10 pointer-events-auto"
        >
          <div 
            ref={joystickRef}
            className="w-24 h-24 bg-white bg-opacity-20 rounded-full border border-white border-opacity-30 backdrop-blur-sm"
            onTouchStart={handleJoystickStart}
            onTouchMove={handleJoystickMove}
            onTouchEnd={handleJoystickEnd}
            onTouchCancel={handleJoystickEnd}
          >
            <div 
              ref={joystickKnobRef}
              className="absolute w-12 h-12 bg-white bg-opacity-40 rounded-full shadow-lg"
              style={{ 
                transform: `translate(${joystickPosition.x}px, ${joystickPosition.y}px)`,
                top: 'calc(50% - 24px)',
                left: 'calc(50% - 24px)',
                transition: joystickActive ? 'none' : 'transform 0.2s ease-out'
              }}
            />
          </div>
          <div className="mt-2 text-white text-xs text-center opacity-60">Drag to move</div>
        </div>
      )}
      
      {/* Right side: Shoot button */}
      <div 
        className="absolute right-10 bottom-10 pointer-events-auto"
        onTouchStart={handleShootStart}
      >
        <div 
          className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg ${
            shootButtonActive 
              ? 'bg-red-600 scale-95' 
              : 'bg-red-500 hover:bg-red-600'
          } transition-all duration-100`}
        >
          <Target size={32} className="text-white" />
        </div>
        <div className="mt-2 text-white text-xs text-center opacity-60">Tap to shoot</div>
      </div>
      
      {/* Right side transparent touch area for shooting */}
      <div 
        className="absolute right-0 bottom-0 w-1/2 h-full pointer-events-auto opacity-0"
        onTouchStart={handleShootStart}
      />
    </div>
  );
}