import React, {useRef, useEffect, useState} from 'react';
import './App.css';

const BFF_ADDRESS = "localhost:8080";

interface Sprinkler {
	id: string;
	open: boolean;
	pressure: number;
	x: number;
	y: number;
	direction: number;
}

interface Garden {
	time: string;
	raining: boolean;
	status: Record<string, Sprinkler>;
	config: Record<string, Sprinkler>;
}

interface AppState {
  garden: Garden | null;
}

type WSData = {topic: "garden/status", data: Garden};

const sprinklerRadius = 20;

function GardenMap(props: {width: number, height: number, garden: Garden | null}) {
  const {width, height, garden} = props;
  console.log("🚀 ~ file: App.tsx:27 ~ GardenMap ~ garden:", garden)
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
      ctx.fillStyle = "#0099CC";
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, sprinklerRadius * s.pressure, 0, Math.PI / 2);
      ctx.closePath();
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

  return (<canvas {...props} ref={canvasRef}></canvas>);
}

function SprinklerLi(props: Sprinkler) {
  return (<div className="Sprinkler" data-open={props.open}>
    <div className="Sprinkler-cnt">
      <div className="Sprinkler-id">{props.id}</div>
      <div className="Sprinkler-open">{props.open ? "Open" : "Close"}</div>
      <div className="Sprinkler-Pressure">Pressure: {props.pressure.toFixed(1)} bar</div>
    </div>
    <div className="Sprinkler-toggle" onClick={() => configSprinkler({...props, open: !props.open})}></div>
  </div>)
}

async  function configSprinkler(config: Sprinkler) {
  const response = await fetch(`http://${BFF_ADDRESS}/sprinkler/config`, {
    method: "POST",
    headers: new Headers({"Content-Type": "application/json"}),
    body: JSON.stringify(config)
  });
  if (response.status > 399) {
    const body = await response.json();
    alert(body.message);
  }
}



class App extends React.Component {
  #ws!: WebSocket;

  state: AppState = {
    garden: null
  }
  constructor(props: any) {
    super(props);

  }
  render() {
    const raining = this.state.garden?.raining;
    const configs = Object.entries(this.state.garden?.status ?? {});
    return (
      <div className="App">
        <div className="Sprinklers">
          {configs.map(([key, item]) => (<SprinklerLi key={key} {...item} />))}
        </div>
        <div className="Map">
          <GardenMap width={400} height={400} garden={this.state.garden} />
        </div>
        <div className="Weather">
          <div className="Weather-ico" onClick={this.#toggleWeather.bind(this)}>
            <img src={raining ? "rainy.svg" : "sunny.svg"} alt={raining ? "Rainy" : "Sunny"} />
          </div>
        </div>
      </div>
    )
  }

  componentDidMount() {
    // Create WebSocket connection.
    this.#ws = new WebSocket(`ws://${BFF_ADDRESS}`);

    // Connection opened
    this.#ws.addEventListener("open", (event) => {
      setTimeout(() => {
        this.#ws.send("Hello Server!");
      }, 100);
    });

    // Listen for messages
    this.#ws.addEventListener("message", (event: MessageEvent<string>) => {
      const msg = JSON.parse(event.data) as WSData;
      switch(msg.topic) {
        case "garden/status":
          this.setState({...this.state, garden: msg.data});
          break;
      }
    });

  }

  async #toggleWeather() {
    const raining = this.state.garden?.raining;
    const response = await fetch(`http://${BFF_ADDRESS}/weather/${raining ? "sunny" : "rainy"}`, {
      method: "POST"
    });
    if (response.status > 399) {
      const body = await response.json();
      alert(body.message);
    }
  }
}


export default App
