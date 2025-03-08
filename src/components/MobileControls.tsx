// src/components/MobileControls.tsx
import { useEffect, useRef, useState } from 'react';

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
  const [joystickActive, setJoystickActive] = useState(false);
  const [joystickPosition, setJoystickPosition] = useState<JoystickPosition>({ x: 0, y: 0 });
  const [joystickCenter, setJoystickCenter] = useState<JoystickPosition>({ x: 0, y: 0 });
  const maxDistance = 40; // Maximum joystick movement radius

  useEffect(() => {
    if (joystickRef.current) {
      const rect = joystickRef.current.getBoundingClientRect();
      setJoystickCenter({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      });
    }
  }, []);

  const handleJoystickStart = (e: React.TouchEvent) => {
    e.preventDefault();
    setJoystickActive(true);
    handleJoystickMove(e);
  };

  const handleJoystickMove = (e: React.TouchEvent) => {
    if (!joystickActive) return;

    const touch = e.touches[0];
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

  const handleJoystickEnd = () => {
    setJoystickActive(false);
    setJoystickPosition({ x: 0, y: 0 });
    onMove(0, 0); // Stop movement
  };

  const handleShoot = (e: React.TouchEvent) => {
    // Only handle shoot action if the touch is on the right side of the screen
    const touchX = e.touches[0].clientX;
    const screenWidth = window.innerWidth;
    
    if (touchX > screenWidth / 2) {
      e.preventDefault();
      onShoot(touchX, e.touches[0].clientY);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 w-full h-40 pointer-events-none">
      {/* Left side: Joystick */}
      <div 
        ref={joystickRef}
        className="absolute bottom-10 left-10 w-24 h-24 bg-white bg-opacity-20 rounded-full pointer-events-auto"
        onTouchStart={handleJoystickStart}
        onTouchMove={handleJoystickMove}
        onTouchEnd={handleJoystickEnd}
      >
        <div 
          ref={joystickKnobRef}
          className="absolute w-12 h-12 bg-white bg-opacity-40 rounded-full"
          style={{ 
            transform: `translate(${joystickPosition.x}px, ${joystickPosition.y}px)`,
            top: 'calc(50% - 24px)',
            left: 'calc(50% - 24px)'
          }}
        />
      </div>
      
      {/* Right side: Shoot area */}
      <div 
        className="absolute right-0 bottom-0 w-1/2 h-full pointer-events-auto"
        onTouchStart={handleShoot}
      />
    </div>
  );
}