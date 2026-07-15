"use client";

/**
 * A floating, glowing, slowly-spinning glass cube - pure CSS 3D transforms
 * (6 faces + translateZ, the standard CSS cube recipe), no canvas/WebGL.
 * Each face is a stack of layered radial gradients that drift independently
 * to fake a churning energy/cloud interior, plus a bright glowing edge
 * outline and an outer drop-shadow bloom so it reads as a self-lit object
 * floating in empty space rather than a panel widget.
 */

const FACES = [
  { name: "front", transform: "translateZ(var(--h))" },
  { name: "back", transform: "rotateY(180deg) translateZ(var(--h))" },
  { name: "right", transform: "rotateY(90deg) translateZ(var(--h))" },
  { name: "left", transform: "rotateY(-90deg) translateZ(var(--h))" },
  { name: "top", transform: "rotateX(90deg) translateZ(var(--h))" },
  { name: "bottom", transform: "rotateX(-90deg) translateZ(var(--h))" },
] as const;

export function Tesseract({ height = 220 }: { height?: number }) {
  const size = Math.round(height * 0.62);
  return (
    <div className="flex h-full w-full items-center justify-center overflow-hidden" style={{ height, perspective: 1000 }}>
      <style>{`
        @keyframes tsrct-float { 0%, 100% { transform: translateY(-8px); } 50% { transform: translateY(8px); } }
        @keyframes tsrct-spin { from { transform: rotateX(-18deg) rotateY(0deg); } to { transform: rotateX(-18deg) rotateY(360deg); } }
        @keyframes tsrct-swirl-a { 0% { background-position: 0% 0%, 50% 50%; } 50% { background-position: 30% 60%, 65% 35%; } 100% { background-position: 0% 0%, 50% 50%; } }
        @keyframes tsrct-swirl-b { 0% { background-position: 100% 100%, 20% 80%; } 50% { background-position: 60% 40%, 45% 55%; } 100% { background-position: 100% 100%, 20% 80%; } }
        .tsrct-float { animation: tsrct-float 6s ease-in-out infinite; transform-style: preserve-3d; }
        .tsrct-spin { animation: tsrct-spin 16s linear infinite; transform-style: preserve-3d; position: relative; }
        .tsrct-face {
          position: absolute; inset: 0;
          border: 1px solid rgba(160, 230, 255, 0.85);
          box-shadow: inset 0 0 30px rgba(90, 200, 255, 0.55), inset 0 0 70px rgba(20, 90, 140, 0.5), 0 0 2px rgba(200, 245, 255, 0.9);
          background-blend-mode: screen, screen, normal;
          background-color: rgba(6, 22, 34, 0.55);
          background-size: 180% 180%, 160% 160%;
          background-repeat: no-repeat;
        }
        .tsrct-face-odd {
          background-image:
            radial-gradient(circle at 30% 30%, rgba(140, 235, 255, 0.85), transparent 55%),
            radial-gradient(circle at 70% 65%, rgba(60, 160, 255, 0.55), transparent 60%);
          animation: tsrct-swirl-a 9s ease-in-out infinite;
        }
        .tsrct-face-even {
          background-image:
            radial-gradient(circle at 65% 35%, rgba(180, 245, 255, 0.8), transparent 55%),
            radial-gradient(circle at 25% 70%, rgba(70, 150, 255, 0.5), transparent 60%);
          animation: tsrct-swirl-b 11s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .tsrct-float, .tsrct-spin, .tsrct-face-odd, .tsrct-face-even { animation: none; }
        }
      `}</style>
      <div className="tsrct-float" style={{ filter: "drop-shadow(0 0 24px rgba(90,210,255,0.85)) drop-shadow(0 0 60px rgba(50,150,255,0.5))" }}>
        <div className="tsrct-spin" style={{ width: size, height: size, ["--h" as string]: `${size / 2}px` }}>
          {FACES.map((face, i) => (
            <div key={face.name} className={`tsrct-face ${i % 2 === 0 ? "tsrct-face-odd" : "tsrct-face-even"}`} style={{ width: size, height: size, transform: face.transform }} />
          ))}
        </div>
      </div>
    </div>
  );
}
