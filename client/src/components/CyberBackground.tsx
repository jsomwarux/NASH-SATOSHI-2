import { useEffect, useRef, useMemo } from 'react';

// Matrix rain characters
const MATRIX_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*(){}[]<>?/\\|~`';

interface Particle {
  x: number;
  y: number;
  speed: number;
  char: string;
  opacity: number;
  size: number;
}

export function CyberBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>();
  const mouseRef = useRef({ x: 0, y: 0 });

  // Generate initial particles
  const initParticles = (width: number, height: number) => {
    const particles: Particle[] = [];
    const columns = Math.floor(width / 20);

    for (let i = 0; i < columns; i++) {
      particles.push({
        x: i * 20,
        y: Math.random() * height,
        speed: 1 + Math.random() * 3,
        char: MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)],
        opacity: Math.random() * 0.5 + 0.1,
        size: 12 + Math.random() * 4,
      });
    }

    return particles;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      particlesRef.current = initParticles(canvas.width, canvas.height);
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);

    let frame = 0;

    const draw = () => {
      frame++;

      // Clear with fade effect
      ctx.fillStyle = 'rgba(8, 8, 15, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw grid
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.02)';
      ctx.lineWidth = 1;

      // Vertical lines
      for (let x = 0; x < canvas.width; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }

      // Horizontal lines
      for (let y = 0; y < canvas.height; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Draw matrix rain
      particlesRef.current.forEach((particle, index) => {
        // Update position
        particle.y += particle.speed;

        // Reset at bottom
        if (particle.y > canvas.height) {
          particle.y = -20;
          particle.char = MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
          particle.opacity = Math.random() * 0.5 + 0.1;
        }

        // Change character occasionally
        if (frame % 10 === 0 && Math.random() > 0.9) {
          particle.char = MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
        }

        // Calculate distance from mouse for interactive glow
        const dx = mouseRef.current.x - particle.x;
        const dy = mouseRef.current.y - particle.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const maxDistance = 200;
        const glowIntensity = distance < maxDistance ? 1 - distance / maxDistance : 0;

        // Draw character with glow
        ctx.font = `${particle.size}px "JetBrains Mono", monospace`;

        // Glow effect
        if (glowIntensity > 0) {
          ctx.shadowColor = '#0ff';
          ctx.shadowBlur = 20 * glowIntensity;
        } else {
          ctx.shadowBlur = 0;
        }

        // Alternate colors
        const isMagenta = index % 7 === 0;
        const baseColor = isMagenta ? 'rgba(255, 0, 255,' : 'rgba(0, 255, 255,';
        ctx.fillStyle = `${baseColor}${particle.opacity + glowIntensity * 0.3})`;
        ctx.fillText(particle.char, particle.x, particle.y);

        // Draw trail
        for (let i = 1; i < 8; i++) {
          const trailOpacity = particle.opacity * (1 - i * 0.12);
          if (trailOpacity > 0) {
            ctx.fillStyle = `${baseColor}${trailOpacity * 0.3})`;
            ctx.fillText(particle.char, particle.x, particle.y - i * 15);
          }
        }
      });

      // Draw scan line
      const scanY = (frame * 2) % (canvas.height + 100) - 50;
      const scanGradient = ctx.createLinearGradient(0, scanY - 50, 0, scanY + 50);
      scanGradient.addColorStop(0, 'transparent');
      scanGradient.addColorStop(0.5, 'rgba(0, 255, 255, 0.03)');
      scanGradient.addColorStop(1, 'transparent');
      ctx.fillStyle = scanGradient;
      ctx.fillRect(0, scanY - 50, canvas.width, 100);

      // Draw corner elements
      const cornerSize = 100;
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
      ctx.lineWidth = 2;

      // Top left corner
      ctx.beginPath();
      ctx.moveTo(0, cornerSize);
      ctx.lineTo(0, 0);
      ctx.lineTo(cornerSize, 0);
      ctx.stroke();

      // Top right corner
      ctx.beginPath();
      ctx.moveTo(canvas.width - cornerSize, 0);
      ctx.lineTo(canvas.width, 0);
      ctx.lineTo(canvas.width, cornerSize);
      ctx.stroke();

      // Bottom left corner
      ctx.beginPath();
      ctx.moveTo(0, canvas.height - cornerSize);
      ctx.lineTo(0, canvas.height);
      ctx.lineTo(cornerSize, canvas.height);
      ctx.stroke();

      // Bottom right corner
      ctx.beginPath();
      ctx.moveTo(canvas.width - cornerSize, canvas.height);
      ctx.lineTo(canvas.width, canvas.height);
      ctx.lineTo(canvas.width, canvas.height - cornerSize);
      ctx.stroke();

      // Magenta accent corners
      ctx.strokeStyle = 'rgba(255, 0, 255, 0.2)';
      ctx.lineWidth = 1;

      ctx.beginPath();
      ctx.moveTo(10, cornerSize - 20);
      ctx.lineTo(10, 10);
      ctx.lineTo(cornerSize - 20, 10);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(canvas.width - 10, cornerSize - 20);
      ctx.lineTo(canvas.width - 10, 10);
      ctx.lineTo(canvas.width - cornerSize + 20, 10);
      ctx.stroke();

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 0 }}
      />
      {/* Gradient overlays */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse at 20% 20%, rgba(0, 255, 255, 0.05) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 80%, rgba(255, 0, 255, 0.05) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 50%, rgba(0, 0, 0, 0.5) 0%, transparent 100%)
          `,
          zIndex: 1,
        }}
      />
      {/* Vignette */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at center, transparent 30%, rgba(0, 0, 0, 0.7) 100%)',
          zIndex: 2,
        }}
      />
    </>
  );
}

// Simpler static background for performance-sensitive pages
export function CyberBackgroundStatic() {
  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
      {/* Base gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            linear-gradient(180deg,
              hsl(240 10% 4%) 0%,
              hsl(260 15% 6%) 30%,
              hsl(280 20% 5%) 70%,
              hsl(240 10% 4%) 100%
            )
          `,
        }}
      />

      {/* Grid pattern */}
      <div
        className="absolute inset-0 cyber-grid"
        style={{ opacity: 0.5 }}
      />

      {/* Hexagon pattern */}
      <div
        className="absolute inset-0 hex-pattern"
        style={{ opacity: 0.3 }}
      />

      {/* Glow orbs */}
      <div
        className="absolute w-[600px] h-[600px] rounded-full"
        style={{
          top: '10%',
          left: '10%',
          background: 'radial-gradient(circle, rgba(0, 255, 255, 0.08) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
      <div
        className="absolute w-[500px] h-[500px] rounded-full"
        style={{
          bottom: '10%',
          right: '10%',
          background: 'radial-gradient(circle, rgba(255, 0, 255, 0.08) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />

      {/* Scan line */}
      <div
        className="absolute left-0 right-0 h-[2px]"
        style={{
          top: '50%',
          background: 'linear-gradient(90deg, transparent, rgba(0, 255, 255, 0.1), transparent)',
          animation: 'scan-line 8s linear infinite',
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle at center, transparent 40%, rgba(0, 0, 0, 0.6) 100%)',
        }}
      />

      {/* Noise texture overlay */}
      <div className="absolute inset-0 noise" />
    </div>
  );
}
