import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { makeGameConfig } from './config';

export default function PhaserGame() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const game = new Phaser.Game(makeGameConfig(containerRef.current));
    return () => {
      game.destroy(true);
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0" />;
}
