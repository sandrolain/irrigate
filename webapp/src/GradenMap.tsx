import { useEffect, useRef, useState } from "react";
import { Garden } from "./model";
import { configSprinkler } from "./SprinklerLi";


const sprinklerRadius = 20;

export function GardenMap(props: {width: number, height: number, garden: Garden | null}) {
  const {width, height, garden} = props;
  const canvasRef = useRef(null)
  const [grassImage, setGrassImage] = useState<HTMLImageElement | null>(null);

  const draw = (ctx: CanvasRenderingContext2D): void => {
    ctx.fillStyle = '#224400'
    ctx.beginPath()
    ctx.fillRect(0, 0, width, height)
    if (grassImage) {
      ctx.drawImage(grassImage, 0, 0, grassImage.width, grassImage.height, 0, 0, width, height);
    }
    if (!garden) {
      return;
    }
    for(const s of Object.values(garden.status)) {
      const cx = sprinklerRadius + (width - (sprinklerRadius*2)) * s.x;
      const cy = sprinklerRadius + (height - (sprinklerRadius*2)) * s.y;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((s.direction - 180 + 45) * (Math.PI / 180));
      ctx.translate(-cx, -cy);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, 2, 0, Math.PI *2);
      ctx.closePath();
      ctx.fillStyle = "#FFF";
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, sprinklerRadius * s.pressure, 0, Math.PI / 2);
      ctx.closePath();
      ctx.fillStyle = "rgba(0, 180, 255, 0.5)";
      ctx.fill();

      ctx.rotate(-s.direction * Math.PI / 180);
      ctx.restore();
    }

  };

  useEffect(() => {
    const grassImage = new Image();
    grassImage.src = "grass.webp";
    setGrassImage(grassImage);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current as unknown as HTMLCanvasElement;
    const context = canvas.getContext('2d') as CanvasRenderingContext2D;
    let animationFrameId: number;

        //Our draw came here
    const render = () => {
      draw(context)
      animationFrameId = window.requestAnimationFrame(render)
    }
    render();

    return () => {
      window.cancelAnimationFrame(animationFrameId)
    }
  }, [draw])

  return (<canvas {...props} ref={canvasRef} onClick={(e) => {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width; //x position within the element.
    const y = (e.clientY - rect.top) / rect.height;  //y position within the element.
    configSprinkler({
      x, y,
      id: Math.random().toString(),
      direction: 0,
      pressure: 1,
      open: true
    });
  }}></canvas>);
}

